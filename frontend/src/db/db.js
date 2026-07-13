import Dexie from 'dexie';
import { encryptData, decryptData } from './crypto';

export const db = new Dexie('EduBridgeDatabase');

// Schema version 1 — keep for existing installations to migrate from
db.version(1).stores({
    users: '++id, username, role, tenantId',
    courses: '++id, title, tenantId',
    modules: '++id, title, courseId',
    content: '++id, title, moduleId, skillTag',
    quizzes: '++id, title, moduleId, skillTag',
    quizAttempts: '++id, syncUuid, studentId, quizId, score, synced',
    mastery: '++id, studentId, skillTag, masteryProbability',
    syncQueue: '++id, timestamp, endpoint, method'
});

// Schema version 2
//   syncQueue  — adds syncUuid (idempotency token), retryCount, nextRetryAt (backoff scheduling)
//   content    — adds sha256Verified flag (set by contentMesh after checksum confirmation)
//   quizAttempts — adds reviewPending flag (set by evaluator for free-text teacher review)
//   aiResponseCache — new store for AI Co-Pilot offline fallback (keyed by prompt hash)
db.version(2).stores({
    users: '++id, username, role, tenantId',
    courses: '++id, title, tenantId',
    modules: '++id, title, courseId',
    content: '++id, title, moduleId, skillTag, sha256Verified',
    quizzes: '++id, title, moduleId, skillTag',
    quizAttempts: '++id, syncUuid, studentId, quizId, score, synced, reviewPending',
    mastery: '++id, studentId, skillTag, masteryProbability',
    syncQueue: '++id, syncUuid, timestamp, endpoint, method, retryCount, nextRetryAt',
    aiResponseCache: '++id, promptHash, question, answer, cachedAt'
}).upgrade(tx => {
    // Backfill existing syncQueue rows with defaults so existing installs don't break
    return tx.table('syncQueue').toCollection().modify(item => {
        if (item.syncUuid === undefined) item.syncUuid = crypto.randomUUID();
        if (item.retryCount === undefined) item.retryCount = 0;
        if (item.nextRetryAt === undefined) item.nextRetryAt = 0;
    });
});

// Helper functions to save / retrieve encrypted student profile
export async function saveCurrentUser(user) {
    // Encrypt token and sensitive information before storing
    const encryptedToken = await encryptData(user.token);
    const encryptedUser = {
        ...user,
        token: encryptedToken
    };
    await db.users.clear();
    await db.users.add(encryptedUser);
}

export async function getCurrentUser() {
    const users = await db.users.toArray();
    if (users.length === 0) return null;
    const user = users[0];
    const decryptedToken = await decryptData(user.token);
    return {
        ...user,
        token: decryptedToken
    };
}

export async function clearCurrentUser() {
    await db.users.clear();
}
