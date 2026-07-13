import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { updateStudentMastery, getMastery } from '../db/bkt';
import { queueSyncItem } from '../db/sync';
import { gradeQuiz } from '../db/evaluator';

export default function QuizView({ quizId, user, onBack, onOpenChatbot }) {
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [selectedChoice, setSelectedChoice] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [completed, setCompleted] = useState(false);
    const [isGrading, setIsGrading] = useState(false);

    // Results state
    const [gradeResult, setGradeResult] = useState(null);   // from evaluator.gradeQuiz()
    const [oldMastery, setOldMastery] = useState(0);
    const [newMastery, setNewMastery] = useState(0);
    const [parentSmsTriggered, setParentSmsTriggered] = useState(false);

    // Progress bar
    const progress = questions.length > 0
        ? Math.round((currentQuestionIdx / questions.length) * 100)
        : 0;

    useEffect(() => {
        loadQuiz();
    }, [quizId]);

    const loadQuiz = async () => {
        try {
            const data = await db.quizzes.get(Number(quizId));
            setQuiz(data);
            if (data?.questionsJson) {
                setQuestions(JSON.parse(data.questionsJson));
            }
            const mastery = await getMastery(user.userId, data.skillTag);
            setOldMastery(mastery.masteryProbability);
        } catch (err) {
            console.error('[QuizView] Load error:', err);
        }
    };

    const handleNextQuestion = () => {
        if (selectedChoice === null) return;

        const updatedAnswers = [...answers, selectedChoice];
        setAnswers(updatedAnswers);
        setSelectedChoice(null);

        if (currentQuestionIdx + 1 < questions.length) {
            setCurrentQuestionIdx(currentQuestionIdx + 1);
        } else {
            handleSubmit(updatedAnswers);
        }
    };

    const handleSubmit = async (studentAnswers) => {
        setIsGrading(true);

        // 1. Grade using evaluator.js (4-type grader, honest teacher-review flagging)
        const result = gradeQuiz(quiz, studentAnswers);
        setGradeResult(result);

        // 2. Build responses boolean array for BKT
        const responses = result.results.map(r => r.correct);

        // 3. Update BKT mastery locally
        const calculatedMastery = await updateStudentMastery(user.userId, quiz.skillTag, responses);
        setNewMastery(calculatedMastery);

        // 4. Persist attempt in IndexedDB
        const syncUuid = crypto.randomUUID();
        const attempt = {
            syncUuid,
            studentId: user.userId,
            quizId: quiz.id,
            score: result.totalEarned,
            maxScore: result.totalMax,
            answersJson: JSON.stringify(studentAnswers),
            attemptTimestamp: Date.now(),
            synced: 0,
            reviewPending: result.reviewPending
        };
        await db.quizAttempts.add(attempt);

        // 5. Queue sync — use plural endpoint per SRS v2
        await queueSyncItem('/api/sync/quiz-attempts', 'POST', attempt);

        // 6. Queue updated mastery
        const masteryRecord = await getMastery(user.userId, quiz.skillTag);
        await queueSyncItem('/api/sync/mastery', 'POST', masteryRecord);

        // 7. Parent SMS fallback
        if (user.parentPhone) {
            setParentSmsTriggered(true);
            await queueSyncItem('/api/sms/notify-parent', 'POST', {
                parentPhone: user.parentPhone,
                studentName: user.fullName,
                quizTitle: quiz.title,
                score: result.totalEarned,
                maxScore: result.totalMax
            });
        }

        setIsGrading(false);
        setCompleted(true);
    };

    // ─── Loading ──────────────────────────────────────────────────────────────
    if (!quiz || questions.length === 0) {
        return (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
                Loading assessment...
            </div>
        );
    }

    // ─── Grading Spinner ─────────────────────────────────────────────────────
    if (isGrading) {
        return (
            <div className="glass-panel animated-fade-in" style={{ textAlign: 'center', padding: '3rem', maxWidth: '500px', margin: '0 auto' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚡</div>
                <h3>Grading your answers locally...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    BKT mastery engine updating. No internet required.
                </p>
            </div>
        );
    }

    // ─── Results Screen ───────────────────────────────────────────────────────
    if (completed && gradeResult) {
        const pct = gradeResult.percentage;
        const scoreColor = pct >= 75 ? 'var(--success)' : pct >= 50 ? '#f59e0b' : 'var(--danger)';
        const masteryDelta = newMastery - oldMastery;

        return (
            <div className="animated-fade-in" style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Score Card */}
                <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem', borderTop: `4px solid ${scoreColor}` }}>
                    <span className="badge-pill badge-success" style={{ fontSize: '0.9rem', padding: '0.4rem 1.2rem', display: 'inline-block', marginBottom: '1rem', background: scoreColor }}>
                        🎉 Quiz Completed — Instant Local Grading
                    </span>
                    <div style={{ fontSize: '4rem', fontWeight: '800', color: scoreColor, lineHeight: 1 }}>
                        {pct}%
                    </div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        {gradeResult.totalEarned} / {gradeResult.totalMax} points
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        {quiz.title}
                    </div>
                </div>

                {/* BKT Mastery Update */}
                <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #7c3aed' }}>
                    <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🧠 Mastery Engine Updated <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Bayesian Knowledge Tracing)</span>
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '0.5rem 0 1rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Before</div>
                            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{(oldMastery * 100).toFixed(0)}%</div>
                        </div>
                        <div style={{ fontSize: '1.8rem', color: masteryDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {masteryDelta >= 0 ? '↗' : '↘'}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>After</div>
                            <div style={{ fontSize: '2rem', fontWeight: '700', color: masteryDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {(newMastery * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    {/* Mastery bar */}
                    <div style={{ width: '100%', height: '10px', background: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${newMastery * 100}%`,
                            height: '100%',
                            background: newMastery >= 0.75 ? 'var(--success)' : newMastery >= 0.5 ? '#f59e0b' : 'var(--danger)',
                            transition: 'width 0.8s ease'
                        }} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>
                        {newMastery >= 0.75
                            ? '✨ Excellent! You have mastered this topic. EduBridge will recommend advanced content next.'
                            : newMastery > oldMastery
                                ? '📈 Good progress! Keep practicing to reinforce understanding.'
                                : '💪 This topic needs more practice. The AI tutor can help explain concepts.'}
                    </p>
                </div>

                {/* Per-Question Results */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1rem' }}>📝 Answer Review</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {gradeResult.results.map((res, idx) => (
                            <div key={idx} style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${res.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                background: res.correct ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Q{idx + 1}. </span>
                                        {res.questionText}
                                    </div>
                                    <span style={{
                                        flexShrink: 0,
                                        fontSize: '0.75rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '999px',
                                        background: res.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                        color: res.correct ? 'var(--success)' : 'var(--danger)',
                                        fontWeight: '600'
                                    }}>
                                        {res.correct ? `✓ +${res.earned}` : `✗ 0`}
                                    </span>
                                </div>
                                {res.reviewPending && (
                                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.4rem' }}>
                                        ✏️ Your answer has been sent for teacher review (partial credit awarded)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Background Sync Notice */}
                <div style={{
                    padding: '0.8rem 1.2rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59,130,246,0.07)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    fontSize: '0.83rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                }}>
                    <span>🔄</span>
                    <span>
                        <b>Background sync queued.</b> Your score and mastery update will reach your teacher when this device connects to the internet.
                    </span>
                </div>

                {parentSmsTriggered && (
                    <div style={{
                        padding: '0.8rem 1.2rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(139,92,246,0.07)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        fontSize: '0.83rem',
                        color: 'var(--text-secondary)'
                    }}>
                        💬 SMS notification queued for parent at <b>{user.parentPhone}</b>
                    </div>
                )}

                {/* CTA Buttons */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={onBack}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                    >
                        ← Return to Course
                    </button>
                    {newMastery < 0.75 && (
                        <button
                            onClick={() => onOpenChatbot?.(`Explain the topic "${quiz.skillTag}" to me simply. I scored ${gradeResult.percentage}% on a quiz about it.`)}
                            className="btn btn-primary"
                            style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                                border: 'none'
                            }}
                        >
                            🤖 Ask AI Tutor to Explain
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ─── Active Quiz ──────────────────────────────────────────────────────────
    const currentQuestion = questions[currentQuestionIdx];

    return (
        <div className="animated-fade-in" style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header */}
            <div className="glass-panel" style={{ padding: '1.2rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Question <b style={{ color: 'var(--text-primary)' }}>{currentQuestionIdx + 1}</b> of {questions.length}
                    </span>
                    <span className="badge-pill badge-info" style={{ fontSize: '0.75rem' }}>
                        {quiz.skillTag}
                    </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--primary)',
                        transition: 'width 0.4s ease'
                    }} />
                </div>
            </div>

            {/* Question Card */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {currentQuestion.questionText}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {currentQuestion.choices?.map((choice, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedChoice(idx)}
                            style={{
                                cursor: 'pointer',
                                padding: '1rem 1.2rem',
                                borderRadius: 'var(--radius-sm)',
                                border: selectedChoice === idx
                                    ? '2px solid var(--primary)'
                                    : '1px solid var(--border-color)',
                                background: selectedChoice === idx
                                    ? 'var(--primary-light)'
                                    : 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span style={{
                                width: '24px', height: '24px', flexShrink: 0,
                                border: `2px solid ${selectedChoice === idx ? 'var(--primary)' : 'var(--border-color)'}`,
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: '700',
                                background: selectedChoice === idx ? 'var(--primary)' : 'transparent',
                                color: selectedChoice === idx ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.15s ease'
                            }}>
                                {String.fromCharCode(65 + idx)}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                {choice}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onBack} className="btn btn-secondary">Exit Quiz</button>
                <button
                    onClick={handleNextQuestion}
                    disabled={selectedChoice === null}
                    className="btn btn-primary"
                    style={{ minWidth: '160px' }}
                >
                    {currentQuestionIdx + 1 < questions.length ? 'Next Question →' : '✓ Submit Answers'}
                </button>
            </div>
        </div>
    );
}
