import { db, getCurrentUser } from './db';

const API_BASE_URL = 'http://localhost:8080';

// Max per-item retry attempts before giving up and leaving in queue for next online session
const MAX_RETRIES = 6;
// Backoff cap in milliseconds (2^6 * 1000 = 64s, but we cap at 32s = 32000ms)
const MAX_BACKOFF_MS = 32000;

// Register connection listeners — auto-sync when device comes back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Sync] Device is online. Triggering synchronization...');
        syncData();
    });
}

/**
 * Calculates exponential backoff delay for a given retry attempt.
 * Formula: min(2^attempt * 1000ms, MAX_BACKOFF_MS)
 * attempt=0 → 1s, 1 → 2s, 2 → 4s, 3 → 8s, 4 → 16s, 5+ → 32s
 */
function calcBackoffMs(attempt) {
    return Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);
}

/**
 * Pushes offline actions (attempts, BKT updates) to the server
 * and fetches new course/curriculum material.
 *
 * SRS v2 §6.7: write-ahead queue, idempotent sync, exponential backoff
 */
export async function syncData() {
    if (!navigator.onLine) {
        console.log('[Sync] Cannot sync: Device is currently offline.');
        return false;
    }

    const user = await getCurrentUser();
    if (!user || !user.token) {
        console.log('[Sync] Cannot sync: No authenticated user.');
        return false;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
    };

    // --- 1. Process local sync queue with exponential backoff ---
    const now = Date.now();
    // Only pick items whose backoff window has expired
    const queue = await db.syncQueue
        .filter(item => !item.nextRetryAt || item.nextRetryAt <= now)
        .toArray();

    console.log(`[Sync] Processing ${queue.length} eligible items from sync queue (${await db.syncQueue.count()} total)...`);

    for (const item of queue) {
        if (item.retryCount >= MAX_RETRIES) {
            console.warn(`[Sync] Item ${item.syncUuid} exceeded max retries (${MAX_RETRIES}). Skipping.`);
            continue;
        }

        try {
            const url = item.endpoint.startsWith('http')
                ? item.endpoint
                : `${API_BASE_URL}${item.endpoint}`;

            const response = await fetch(url, {
                method: item.method,
                headers: {
                    ...headers,
                    // Idempotency key lets the server deduplicate retransmits (SRS v2 §6.7)
                    'X-Idempotency-Key': item.syncUuid
                },
                body: JSON.stringify(item.payload)
            });

            if (response.ok || response.status === 409) {
                // 200/201 = success; 409 = server already has this (idempotent duplicate) — both are safe to remove
                await db.syncQueue.delete(item.id);
                console.log(`[Sync] ✓ Success for ${item.endpoint} (uuid: ${item.syncUuid})`);
            } else if (response.status >= 500) {
                // Server error — schedule backoff retry
                const nextRetry = item.retryCount + 1;
                const backoffMs = calcBackoffMs(nextRetry);
                await db.syncQueue.update(item.id, {
                    retryCount: nextRetry,
                    nextRetryAt: Date.now() + backoffMs
                });
                console.warn(`[Sync] ✗ Server error ${response.status} for ${item.endpoint}. Retry #${nextRetry} in ${backoffMs / 1000}s`);
            } else {
                // 4xx client error — not retriable, log and leave for manual review
                console.error(`[Sync] ✗ Client error ${response.status} for ${item.endpoint}. Not retrying.`);
            }
        } catch (networkErr) {
            // Network failure mid-queue — schedule backoff and stop processing remaining items
            const nextRetry = item.retryCount + 1;
            const backoffMs = calcBackoffMs(nextRetry);
            await db.syncQueue.update(item.id, {
                retryCount: nextRetry,
                nextRetryAt: Date.now() + backoffMs
            });
            console.warn(`[Sync] ✗ Network error for ${item.endpoint}. Retry #${nextRetry} in ${backoffMs / 1000}s`, networkErr);
            break; // Stop queue processing — device likely went offline again
        }
    }

    // --- 2. Fetch course curriculum updates from cloud ---
    try {
        console.log('[Sync] Fetching latest curriculum updates from cloud...');
        const resCourses = await fetch(`${API_BASE_URL}/api/courses`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (!resCourses.ok) throw new Error(`Courses fetch failed: ${resCourses.status}`);

        const courses = await resCourses.json();
        await db.courses.clear();
        await db.courses.bulkPut(courses);

        const localCourses = await db.courses.toArray();
        for (const course of localCourses) {
            // Fetch modules
            const resMod = await fetch(`${API_BASE_URL}/api/courses/${course.id}/modules`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (resMod.ok) {
                const modules = await resMod.json();
                for (const m of modules) {
                    await db.modules.put(m);

                    // Fetch Content Items
                    const resContent = await fetch(`${API_BASE_URL}/api/modules/${m.id}/content`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    if (resContent.ok) {
                        const contents = await resContent.json();
                        for (const c of contents) {
                            await db.content.put(c);
                        }
                    }

                    // Fetch Quizzes
                    const resQuiz = await fetch(`${API_BASE_URL}/api/modules/${m.id}/quizzes`, {
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    if (resQuiz.ok) {
                        const quizzes = await resQuiz.json();
                        for (const q of quizzes) {
                            await db.quizzes.put(q);
                        }
                    }
                }
            }
        }
        console.log('[Sync] ✓ Curriculum synchronization completed successfully.');
        return true;
    } catch (err) {
        console.error('[Sync] ✗ Failed to sync curriculum updates:', err);
        return false;
    }
}

/**
 * Adds an API operation to the local write-ahead sync queue and attempts sync if online.
 * Assigns a client-generated syncUuid for server-side idempotency deduplication (SRS v2 §6.7).
 *
 * @param {string} endpoint - Relative API path (e.g. '/api/sync/quiz-attempts')
 * @param {string} method - HTTP verb ('POST', 'PUT', etc.)
 * @param {object} payload - JSON-serializable request body
 */
export async function queueSyncItem(endpoint, method, payload) {
    const syncUuid = crypto.randomUUID(); // Client-generated idempotency token

    await db.syncQueue.add({
        syncUuid,
        timestamp: Date.now(),
        endpoint,
        method,
        payload,
        retryCount: 0,
        nextRetryAt: 0 // 0 = eligible immediately
    });

    if (navigator.onLine) {
        syncData(); // Fire-and-forget; errors handled internally with backoff
    } else {
        console.log(`[Sync] Queued offline (${syncUuid}): ${method} ${endpoint}`);
    }
}
