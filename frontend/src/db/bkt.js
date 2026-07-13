// Bayesian Knowledge Tracing (BKT) Engine
// Implements standard Corbett & Anderson BKT formulas for student mastery tracking

import { db } from './db';

// BKT Parameters (curated default values from educational literature)
export const BKT_PARAMS = {
    L0: 0.20,  // Initial Knowledge: probability student knows skill before practice
    T:  0.15,  // Transition: probability student learns skill during a task
    G:  0.20,  // Guess: probability student answers correctly without knowing skill
    S:  0.10   // Slip: probability student makes a mistake despite knowing skill
};

/**
 * Updates a mastery probability based on a single response.
 * @param {number} pL - Current probability of mastery P(L_t)
 * @param {boolean} isCorrect - Whether the student's response was correct
 * @returns {number} New probability of mastery P(L_t+1)
 */
export function calculateNextMastery(pL, isCorrect) {
    const { T, G, S } = BKT_PARAMS;
    let pL_given_response;

    if (isCorrect) {
        // P(L_t | Correct) = (P(L_t) * (1 - S)) / (P(L_t) * (1 - S) + (1 - P(L_t)) * G)
        const numerator = pL * (1 - S);
        const denominator = (pL * (1 - S)) + ((1 - pL) * G);
        pL_given_response = numerator / (denominator || 1);
    } else {
        // P(L_t | Incorrect) = (P(L_t) * S) / (P(L_t) * S + (1 - P(L_t)) * (1 - G))
        const numerator = pL * S;
        const denominator = (pL * S) + ((1 - pL) * (1 - G));
        pL_given_response = numerator / (denominator || 1);
    }

    // P(L_t+1) = P(L_t | Response) + (1 - P(L_t | Response)) * T
    const newMastery = pL_given_response + (1 - pL_given_response) * T;
    
    // Clamp between 0.01 and 0.99 for numerical stability
    return Math.max(0.01, Math.min(0.99, newMastery));
}

/**
 * Retrieves the current mastery probability for a student/skill, initializing it if absent.
 */
export async function getMastery(studentId, skillTag) {
    let record = await db.mastery
        .where({ studentId: Number(studentId), skillTag })
        .first();

    if (!record) {
        const now = Date.now();
        record = {
            studentId: Number(studentId),
            skillTag,
            masteryProbability: BKT_PARAMS.L0,
            lastUpdatedTimestamp: now,
            synced: 0
        };
        await db.mastery.add(record);
    }
    return record;
}

/**
 * Updates a student's BKT mastery sequence over quiz responses.
 * @param {number} studentId 
 * @param {string} skillTag 
 * @param {Array<boolean>} responses - List of correct (true) and incorrect (false) answers
 */
export async function updateStudentMastery(studentId, skillTag, responses) {
    const record = await getMastery(studentId, skillTag);
    let currentMastery = record.masteryProbability;

    // Apply the BKT formula sequentially for each answer
    for (const isCorrect of responses) {
        currentMastery = calculateNextMastery(currentMastery, isCorrect);
    }

    record.masteryProbability = currentMastery;
    record.lastUpdatedTimestamp = Date.now();
    record.synced = 0; // mark for cloud upload

    await db.mastery.put(record);
    return currentMastery;
}

/**
 * Recommends the next course material based on the current mastery vector.
 * If mastery is low (< 0.70), recommend foundation contents for that skill tag.
 * If mastery is high (>= 0.70), recommend advanced quizzes or advanced modules.
 */
export async function recommendNextContent(studentId, moduleId) {
    const contents = await db.content.where({ moduleId: Number(moduleId) }).toArray();
    const quizzes = await db.quizzes.where({ moduleId: Number(moduleId) }).toArray();

    if (contents.length === 0) return null;

    // Group contents by skill tag and fetch student mastery
    const recommendations = [];

    for (const content of contents) {
        const masteryRecord = await getMastery(studentId, content.skillTag);
        const pMastery = masteryRecord.masteryProbability;

        // Give weight score: we want to recommend content for skills that are not yet mastered (pMastery < 0.75)
        // but not completely out of reach (e.g. prioritize skills with mastery around 0.4 - 0.6)
        let priority = 0;
        if (pMastery < 0.75) {
            // High priority: content teaching unmastered material
            priority = (1 - pMastery) * 10;
        } else {
            // Low priority: student already mastered this topic
            priority = (1 - pMastery) * 2;
        }

        recommendations.push({
            type: 'content',
            item: content,
            priority,
            mastery: pMastery
        });
    }

    for (const quiz of quizzes) {
        const masteryRecord = await getMastery(studentId, quiz.skillTag);
        const pMastery = masteryRecord.masteryProbability;

        let priority = 0;
        if (pMastery >= 0.60 && pMastery < 0.90) {
            // High priority: attempt quiz if student has some basic understanding to test/solidify
            priority = pMastery * 8;
        } else if (pMastery < 0.60) {
            // Too hard for now, prioritize content first
            priority = pMastery * 2;
        } else {
            // Already mastered, low priority
            priority = (1 - pMastery) * 1;
        }

        recommendations.push({
            type: 'quiz',
            item: quiz,
            priority,
            mastery: pMastery
        });
    }

    // Sort by priority descending
    recommendations.sort((a, b) => b.priority - a.priority);
    return recommendations[0] || null;
}
export default calculateNextMastery;
