import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';

export default function TeacherAnalytics({ onBack }) {
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'review' | 'notifications'
    const [students, setStudents] = useState([]);
    const [heatmapData, setHeatmapData] = useState([]);
    const [weakClusters, setWeakClusters] = useState({});
    const [syncLogs, setSyncLogs] = useState([]);
    const [pendingReviews, setPendingReviews] = useState([]);

    // Notifications state
    const [notifMessage, setNotifMessage] = useState('');
    const [notifType, setNotifType] = useState('Assignment');
    const [notifTarget, setNotifTarget] = useState('all');
    const [notifSending, setNotifSending] = useState(false);
    const [sentNotifications, setSentNotifications] = useState([]);

    useEffect(() => {
        loadTeacherData();
        loadPendingReviews();
    }, []);

    const loadPendingReviews = async () => {
        try {
            // Load all quiz attempts flagged for teacher review by the evaluator
            const pending = await db.quizAttempts
                .filter(a => a.reviewPending === true)
                .toArray();

            // Enrich with quiz titles
            const enriched = await Promise.all(pending.map(async attempt => {
                const quiz = await db.quizzes.get(attempt.quizId);
                return {
                    ...attempt,
                    quizTitle: quiz?.title || `Quiz #${attempt.quizId}`,
                    answers: attempt.answersJson ? JSON.parse(attempt.answersJson) : []
                };
            }));
            setPendingReviews(enriched);
        } catch (err) {
            console.error('[TeacherAnalytics] Failed to load pending reviews:', err);
        }
    };

    /**
     * Teacher approves a free-text answer — awards full credit and clears review flag.
     */
    const handleApprove = async (attempt) => {
        await db.quizAttempts.update(attempt.id, {
            score: attempt.maxScore ?? attempt.score,
            reviewPending: false,
            synced: 0
        });
        // Queue sync so the server gets the updated score
        await queueSyncItem('/api/sync/quiz-attempts', 'POST', {
            syncUuid: attempt.syncUuid,
            studentId: attempt.studentId,
            quizId: attempt.quizId,
            score: attempt.maxScore ?? attempt.score,
            reviewPending: false,
            attemptTimestamp: attempt.attemptTimestamp
        });
        setPendingReviews(prev => prev.filter(a => a.id !== attempt.id));
    };

    /**
     * Teacher marks a free-text answer as incorrect — zeroes score and clears review flag.
     */
    const handleReject = async (attempt) => {
        await db.quizAttempts.update(attempt.id, {
            score: 0,
            reviewPending: false,
            synced: 0
        });
        await queueSyncItem('/api/sync/quiz-attempts', 'POST', {
            syncUuid: attempt.syncUuid,
            studentId: attempt.studentId,
            quizId: attempt.quizId,
            score: 0,
            reviewPending: false,
            attemptTimestamp: attempt.attemptTimestamp
        });
        setPendingReviews(prev => prev.filter(a => a.id !== attempt.id));
    };

    const loadTeacherData = async () => {
        // Seed/retrieve mock students for class analytics demo
        const mockStudents = [
            { id: 101, name: 'Kirubashankar R', device: 'Android Tablet A', storageUsed: '42%' },
            { id: 102, name: 'Kirupa Sankar S', device: 'Android Tablet B', storageUsed: '38%' },
            { id: 103, name: 'Madhankumar R', device: 'Lenovo Lab PC 4', storageUsed: '61%' },
            { id: 104, name: 'Abinesh Kumar', device: 'Android Phone C', storageUsed: '25%' },
            { id: 105, name: 'Pranesh R', device: 'Intel i3 PC 12', storageUsed: '84%' }
        ];
        setStudents(mockStudents);

        // Mock BKT mastery values for the class heatmap
        const skills = ['reflection', 'refraction', 'equations', 'variables'];
        const heatmap = mockStudents.map(student => {
            const scores = {};
            skills.forEach(skill => {
                // Generate deterministic mock probabilities based on student ids
                scores[skill] = Number(((0.3 + ((student.id % 7) * 0.11) + (skill.length * 0.03)) % 1).toFixed(2));
            });
            return {
                id: student.id,
                name: student.name,
                scores
            };
        });
        setHeatmapData(heatmap);

        // Clustering: Group students having low mastery (< 0.60) by skill
        const clusters = {};
        skills.forEach(skill => {
            const weakStudents = heatmap
                .filter(row => row.scores[skill] < 0.60)
                .map(row => row.name);
            clusters[skill] = weakStudents;
        });
        setWeakClusters(clusters);

        // Sync health reports
        setSyncLogs([
            { id: 1, device: 'Teacher Phone (Mule)', timestamp: 'Just now', type: 'Mesh Sync', status: 'Success', details: 'Delivered 3 packages' },
            { id: 2, device: 'Android Tablet A', timestamp: '5 mins ago', type: 'Local Sync', status: 'Success', details: '1 attempt merged' },
            { id: 3, device: 'Lenovo Lab PC 4', timestamp: '12 mins ago', type: 'Local Sync', status: 'Conflict Resolved', details: 'Mastery timestamp LWW resolution' },
            { id: 4, device: 'Intel i3 PC 12', timestamp: '1 hour ago', type: 'Mesh Pull', status: 'Success', details: 'Optics notes cache updated' }
        ]);
    };

    const getMasteryColor = (prob) => {
        if (prob >= 0.75) return '#059669';
        if (prob >= 0.50) return '#d97706';
        return '#dc2626';
    };

    const handleSendNotification = async (e) => {
        e.preventDefault();
        if (!notifMessage.trim()) return;
        setNotifSending(true);

        const notification = {
            syncUuid: crypto.randomUUID(),
            message: notifMessage,
            type: notifType,
            target: notifTarget,
            sentAt: Date.now()
        };

        try {
            // Queue to server — server handles push (SMS / FCM / in-app)
            await queueSyncItem('/api/notify/broadcast', 'POST', notification);
            setSentNotifications(prev => [notification, ...prev].slice(0, 10));
            setNotifMessage('');
        } finally {
            setNotifSending(false);
        }
    };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
                <h2>Classroom Insights & Analytics Panel (Teacher)</h2>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <button
                    id="tab-analytics"
                    className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('analytics')}
                >
                    📊 Analytics
                </button>
                <button
                    id="tab-review"
                    className={`btn ${activeTab === 'review' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', position: 'relative' }}
                    onClick={() => setActiveTab('review')}
                >
                    ✏️ Pending Review
                    {pendingReviews.length > 0 && (
                        <span style={{
                            marginLeft: '0.4rem',
                            background: 'var(--danger)',
                            color: '#fff',
                            borderRadius: '999px',
                            padding: '1px 6px',
                            fontSize: '0.7rem',
                            fontWeight: '700'
                        }}>
                            {pendingReviews.length}
                        </span>
                    )}
                </button>
                <button
                    id="tab-notifications"
                    className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('notifications')}
                >
                    🔔 Send Notifications
                </button>
            </div>

            {/* Notifications Panel */}
            {activeTab === 'notifications' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <h3>🔔 Send Assignment & Quiz Alerts</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                            Notifications are queued and delivered via in-app push (and SMS fallback) when devices sync.
                        </p>
                        <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Notification Type</label>
                                    <select
                                        value={notifType}
                                        onChange={e => setNotifType(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    >
                                        <option value="Assignment">📚 Assignment Alert</option>
                                        <option value="Quiz">📝 Quiz Alert</option>
                                        <option value="General">📢 General Announcement</option>
                                        <option value="Remediation">🎯 Remediation Nudge</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Send To</label>
                                    <select
                                        value={notifTarget}
                                        onChange={e => setNotifTarget(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    >
                                        <option value="all">👥 All Students</option>
                                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Message *</label>
                                <textarea
                                    value={notifMessage}
                                    onChange={e => setNotifMessage(e.target.value)}
                                    placeholder="e.g., Quiz on Chapter 5 Optics due tomorrow. Review reflection laws!"
                                    required
                                    rows={3}
                                    style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={notifSending || !notifMessage.trim()}
                                style={{ width: 'fit-content' }}
                            >
                                {notifSending ? 'Sending...' : '🔔 Send Notification'}
                            </button>
                        </form>
                    </div>

                    {/* Sent Log */}
                    {sentNotifications.length > 0 && (
                        <div className="glass-panel">
                            <h4>📄 Recently Sent</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
                                {sentNotifications.map((n, i) => (
                                    <div key={i} style={{ padding: '0.7rem 1rem', background: 'rgba(47,110,99,0.05)', border: '1px solid rgba(47,110,99,0.15)', borderRadius: 'var(--radius-sm)', fontSize: '0.83rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{n.type}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{new Date(n.sentAt).toLocaleTimeString()}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)' }}>{n.message}</div>
                                        <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                                            To: {n.target === 'all' ? 'All Students' : `Student #${n.target}`}
                                            <span style={{ color: 'var(--success)', marginLeft: '0.5rem' }}>✓ Queued for sync</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Pending Review Panel */}
            {activeTab === 'review' && (
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--warning, #f59e0b)' }}>
                    <h3>✏️ Free-Text Answers Pending Teacher Review</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                        These answers were auto-graded with partial credit. Review each and confirm or reject.
                    </p>
                    {pendingReviews.length === 0 ? (
                        <div style={{ color: 'var(--success)', padding: '1rem', textAlign: 'center' }}>
                            ✅ No pending reviews — all answers have been graded!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {pendingReviews.map(attempt => (
                                <div key={attempt.id} style={{
                                    padding: '1rem',
                                    background: 'rgba(245, 158, 11, 0.05)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                        <div>
                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{attempt.quizTitle}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.8rem' }}>
                                                Student #{attempt.studentId} · Auto score: {attempt.score}/{attempt.maxScore ?? '?'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                                                onClick={() => handleApprove(attempt)}
                                            >
                                                ✅ Approve (Full Credit)
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                                onClick={() => handleReject(attempt)}
                                            >
                                                ✗ Incorrect
                                            </button>
                                        </div>
                                    </div>
                                    {attempt.answers.length > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <b>Student answers:</b>
                                            {attempt.answers.map((ans, idx) => (
                                                <div key={idx} style={{ marginLeft: '0.8rem', marginTop: '0.2rem' }}>
                                                    Q{idx + 1}: <em>"{String(ans)}"</em>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (

            <div className="dashboard-grid">
                {/* Left Side: Heatmap and Clustering */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Heatmap Card */}
                    <div className="glass-panel">
                        <h3>📊 Class-Wide BKT Mastery Heatmap</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Each cell displays the estimated probability of topic understanding tracked via BKT. Green indicates mastery.
                        </p>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Reflection</th>
                                        <th>Refraction</th>
                                        <th>Equations</th>
                                        <th>Variables</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {heatmapData.map(row => (
                                        <tr key={row.id}>
                                            <td style={{ fontWeight: '500' }}>{row.name}</td>
                                            {Object.keys(row.scores).map(skill => {
                                                const prob = row.scores[skill];
                                                return (
                                                    <td key={skill}>
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '0.5rem' 
                                                        }}>
                                                            <span style={{ 
                                                                width: '12px', 
                                                                height: '12px', 
                                                                borderRadius: '3px', 
                                                                backgroundColor: getMasteryColor(prob) 
                                                            }}></span>
                                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                                                {(prob * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Weak-Topic Student Clustering */}
                    <div className="glass-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
                        <h3>🎯 Weak-Topic Remediation Clusters</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                            These students are currently under 60% mastery on specific topics. Teachers should pull these groups for targeted help.
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {Object.keys(weakClusters).map(skill => {
                                const list = weakClusters[skill];
                                if (!list || list.length === 0) return null;
                                return (
                                    <div key={skill} style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                        <h4 style={{ textTransform: 'capitalize', color: 'var(--danger)', fontSize: '1rem', marginBottom: '0.5rem' }}>
                                            🚨 {skill.replace('-', ' ')} Gap
                                        </h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {list.map(name => (
                                                <span key={name} className="badge-pill badge-danger" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Right Side: Network Sync Health Dashboard */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Device Coverage Sync Status */}
                    <div className="glass-panel">
                        <h3>📶 Mesh Sync Health Check</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
                            Logs of device connections and local storage capacities.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {students.map(student => (
                                <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                                    <div>
                                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{student.device}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div>Storage: <b>{student.storageUsed}</b></div>
                                        <span className="badge-success badge-pill" style={{ fontSize: '0.7rem' }}>Connected</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Network Logs List */}
                    <div className="glass-panel">
                        <h3>📋 Transaction Sync Log</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            {syncLogs.map(log => (
                                <div key={log.id} style={{ fontSize: '0.8rem', padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{log.device}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                                    </div>
                                    <div>Type: <b>{log.type}</b> | Details: {log.details}</div>
                                    <div style={{ color: 'var(--success)', marginTop: '0.2rem' }}>Status: {log.status}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
            )}
        </div>
    );
}
