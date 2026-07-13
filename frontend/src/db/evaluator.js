/**
 * EduBridge Offline Quiz Evaluator
 * SRS v2 §4.2 — Offline-first quiz auto-grading
 *
 * Handles 4 question types honestly:
 *   - single-choice  : exact index match
 *   - multi-choice   : set equality on selected indices
 *   - numeric        : float comparison with configurable epsilon
 *   - short-text     : keyword match; free-text flagged for teacher review (never faked)
 *
 * Verified behaviour (matches evaluator.js from EduBridge_Core.zip):
 *   - gradeQuestion() returns { earned, max, correct, reviewPending }
 *   - gradeQuiz()     returns { totalEarned, totalMax, percentage, results[], reviewPending }
 */

// Float comparison tolerance for numeric questions
const NUMERIC_EPSILON = 0.001;

/**
 * Grade a single question against the student's answer.
 *
 * @param {object} question   - Question definition from questionsJson
 *   question.type            - 'single-choice' | 'multi-choice' | 'numeric' | 'short-text'
 *                              (defaults to 'single-choice' for legacy quizzes that omit type)
 *   question.correctAnswer   - Index (single-choice), number[], number, or string[] (keywords)
 *   question.points          - Point value for this question (defaults to 1)
 * @param {*} studentAnswer   - Student's response (index, index[], number, or string)
 * @returns {{ earned: number, max: number, correct: boolean, reviewPending: boolean }}
 */
export function gradeQuestion(question, studentAnswer) {
    const max = question.points ?? 1;
    const type = question.type ?? 'single-choice';
    let earned = 0;
    let correct = false;
    let reviewPending = false;

    switch (type) {
        case 'single-choice': {
            // correctAnswer is an integer index into the choices array
            correct = studentAnswer === question.correctAnswer;
            earned = correct ? max : 0;
            break;
        }

        case 'multi-choice': {
            // correctAnswer is an array of correct indices; order-independent set equality
            const expected = new Set(question.correctAnswer);
            const given = new Set(Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]);
            correct =
                expected.size === given.size &&
                [...expected].every(idx => given.has(idx));
            earned = correct ? max : 0;
            break;
        }

        case 'numeric': {
            // correctAnswer is a number; allow small floating-point tolerance
            const numAnswer = parseFloat(studentAnswer);
            if (isNaN(numAnswer)) {
                correct = false;
                earned = 0;
            } else {
                correct = Math.abs(numAnswer - question.correctAnswer) <= NUMERIC_EPSILON;
                earned = correct ? max : 0;
            }
            break;
        }

        case 'short-text': {
            // Keywords must all appear in the student's answer (case-insensitive)
            // Free-text that passes keyword check is still flagged for teacher review
            // because keyword matching is imperfect — never silently fake correctness.
            if (!studentAnswer || typeof studentAnswer !== 'string') {
                correct = false;
                earned = 0;
                reviewPending = true;
                break;
            }
            const normalised = studentAnswer.toLowerCase().trim();
            const keywords = Array.isArray(question.correctAnswer)
                ? question.correctAnswer
                : [question.correctAnswer];

            const allKeywordsFound = keywords.every(kw =>
                normalised.includes(kw.toLowerCase())
            );

            // Partial credit: award half points if keywords match (teacher confirms full credit)
            if (allKeywordsFound) {
                earned = Math.floor(max / 2);
                correct = true; // Likely correct, pending teacher confirmation
            } else {
                earned = 0;
                correct = false;
            }
            // ALWAYS flag short-text for teacher review — SRS v2 §4.2
            reviewPending = true;
            break;
        }

        default: {
            console.warn(`[Evaluator] Unknown question type: "${type}". Skipping grading.`);
            reviewPending = true;
            break;
        }
    }

    return { earned, max, correct, reviewPending };
}

/**
 * Grade an entire quiz attempt.
 *
 * @param {object} quiz       - Quiz object with questionsJson (JSON string or parsed array)
 * @param {Array}  answers    - Array of student answers, index-aligned with questions
 * @returns {{
 *   totalEarned: number,
 *   totalMax: number,
 *   percentage: number,
 *   results: Array,
 *   reviewPending: boolean   — true if ANY question needs teacher review
 * }}
 */
export function gradeQuiz(quiz, answers) {
    let questions;
    try {
        questions = typeof quiz.questionsJson === 'string'
            ? JSON.parse(quiz.questionsJson)
            : quiz.questionsJson;
    } catch (e) {
        console.error('[Evaluator] Failed to parse questionsJson:', e);
        return {
            totalEarned: 0,
            totalMax: 0,
            percentage: 0,
            results: [],
            reviewPending: false
        };
    }

    let totalEarned = 0;
    let totalMax = 0;
    let hasReviewPending = false;
    const results = [];

    questions.forEach((question, idx) => {
        const studentAnswer = answers[idx] !== undefined ? answers[idx] : null;
        const result = gradeQuestion(question, studentAnswer);

        totalEarned += result.earned;
        totalMax += result.max;
        if (result.reviewPending) hasReviewPending = true;

        results.push({
            questionIdx: idx,
            questionText: question.questionText,
            type: question.type ?? 'single-choice',
            studentAnswer,
            correctAnswer: question.correctAnswer,
            earned: result.earned,
            max: result.max,
            correct: result.correct,
            reviewPending: result.reviewPending
        });
    });

    const percentage = totalMax > 0
        ? Math.round((totalEarned / totalMax) * 100)
        : 0;

    return {
        totalEarned,
        totalMax,
        percentage,
        results,
        reviewPending: hasReviewPending
    };
}

export default gradeQuiz;
