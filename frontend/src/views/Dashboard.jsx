import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { recommendNextContent } from '../db/bkt';
import { syncData } from '../db/sync';
import { getTranslation } from '../db/translations';

export default function Dashboard({ user, onSelectCourse, onNavigateTeacher, onNavigateDistrict, onNavigateSchoolAdmin, onNavigateCourseManager, lang, setLang }) {
    const [courses, setCourses] = useState([]);
    const [recommendation, setRecommendation] = useState(null);
    const [masteryList, setMasteryList] = useState([]);
    const [syncQueueCount, setSyncQueueCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Gamification state
    const [badges, setBadges] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);

    // Quiz attempt history (My Marks)
    const [quizHistory, setQuizHistory] = useState([]);

    useEffect(() => {
        loadDashboardData();

        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        
        const interval = setInterval(() => {
            loadDashboardData();
        }, 4000);

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
            clearInterval(interval);
        };
    }, [user, lang]);

    const loadDashboardData = async () => {
        try {
            const localCourses = await db.courses.where({ tenantId: user.tenantId }).toArray();
            setCourses(localCourses);

            const queue = await db.syncQueue.toArray();
            setSyncQueueCount(queue.length);

            const mastery = await db.mastery.where({ studentId: user.userId }).toArray();
            setMasteryList(mastery);

            // Seeding gamification details dynamically
            const loadedBadges = [
                { id: 1, name: 'Optics Explorer', icon: '🔦', desc: 'Attempted optics quiz', active: mastery.some(m => m.skillTag === 'reflection') },
                { id: 2, name: 'BKT Master', icon: '🧠', desc: 'Achieved > 80% mastery', active: mastery.some(m => m.masteryProbability >= 0.8) },
                { id: 3, name: 'Sync Mule', icon: '🐴', desc: 'Synced changes offline', active: queue.length === 0 },
                { id: 4, name: 'Optimus Prime', icon: '⚖️', desc: 'Refraction quiz attempt', active: mastery.some(m => m.skillTag === 'refraction') }
            ];
            setBadges(loadedBadges);

            // Seed mock student leaderboard relative gains
            const mockLeaderboard = [
                { rank: 1, name: 'Kirubashankar R', gain: '24%', status: 'Mastered' },
                { rank: 2, name: user.fullName, gain: mastery.length > 0 ? `${(mastery[0].masteryProbability * 25).toFixed(0)}%` : '5%', status: 'Active' },
                { rank: 3, name: 'Kirupa Sankar S', gain: '18%', status: 'Practicing' },
                { rank: 4, name: 'Madhankumar R', gain: '12%', status: 'Needs Work' }
            ];
            // Sort leaderboard by gain value
            mockLeaderboard.sort((a,b) => parseFloat(b.gain) - parseFloat(a.gain));
            mockLeaderboard.forEach((item, index) => item.rank = index + 1);
            setLeaderboard(mockLeaderboard);

            if (localCourses.length > 0) {
                const modules = await db.modules.where({ courseId: localCourses[0].id }).toArray();
                if (modules.length > 0) {
                    const rec = await recommendNextContent(user.userId, modules[0].id);
                    setRecommendation(rec);
                }
            }

            // Load quiz attempt history for "My Marks"
            if (user.role === 'STUDENT' || user.role === 'TEACHER') {
                const attempts = await db.quizAttempts
                    .where('studentId').equals(Number(user.userId))
                    .reverse()
                    .limit(10)
                    .toArray();

                const enriched = await Promise.all(attempts.map(async (a) => {
                    const quiz = await db.quizzes.get(a.quizId);
                    return {
                        ...a,
                        quizTitle: quiz?.title || `Quiz #${a.quizId}`,
                        percentage: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0
                    };
                }));
                setQuizHistory(enriched);
            }
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    };

    const handleSync = async () => {
        if (!isOnline) return;
        setIsSyncing(true);
        const success = await syncData();
        setIsSyncing(false);
        if (success) {
            loadDashboardData();
        }
    };

    const getMasteryColor = (prob) => {
        if (prob >= 0.75) return 'var(--success)';
        if (prob >= 0.50) return 'var(--warning)';
        return 'var(--danger)';
    };

    const t = (key) => getTranslation(lang, key);

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            
            {/* Header Banner */}
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, var(--teal) 0%, var(--primary) 100%)', padding: '2rem', color: '#fff' }}>
                <div>
                    <h1 style={{ marginBottom: '0.2rem', color: '#fff' }}>{t('welcome')}, {user.fullName}!</h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {t('school')}: <b>{user.tenantId}</b> | {t('role')}: <b>{user.role}</b>
                    </p>
                    
                    {/* Role Access Shortcut links for quick user validation */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        {user.role === 'TEACHER' && (
                            <>
                                <button onClick={onNavigateCourseManager} className="btn btn-accent" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
                                    📚 Course Manager
                                </button>
                                <button onClick={onNavigateTeacher} className="btn btn-accent" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                    📊 Class Analytics Panel
                                </button>
                            </>
                        )}
                        {user.role === 'SCHOOL_ADMIN' && (
                            <button onClick={onNavigateSchoolAdmin} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                🏫 School Admin View
                            </button>
                        )}
                        {user.role === 'DISTRICT_ADMIN' && (
                            <button onClick={onNavigateDistrict} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                🏢 District Admin View
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                    
                    {/* Language Switcher Toggle */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => setLang('en')} 
                            style={{ 
                                padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '3px',
                                background: lang === 'en' ? 'var(--primary)' : 'none', color: '#fff' 
                            }}
                        >
                            EN
                        </button>
                        <button 
                            onClick={() => setLang('ta')} 
                            style={{ 
                                padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '3px',
                                background: lang === 'ta' ? 'var(--primary)' : 'none', color: '#fff' 
                            }}
                        >
                            தமிழ்
                        </button>
                    </div>

                    <div className="sync-indicator">
                        <span className={`sync-dot ${isOnline ? 'online' : 'offline'}`}></span>
                        <span>{isOnline ? t('connected') : t('offline')}</span>
                    </div>

                    {syncQueueCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <span className="badge-warning badge-pill">{syncQueueCount} {t('pendingChanges')}</span>
                            <button 
                                onClick={handleSync} 
                                disabled={isSyncing || !isOnline}
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            >
                                {isSyncing ? '...' : t('syncNow')}
                            </button>
                        </div>
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>✅ {t('synced')}</span>
                    )}
                </div>
            </div>

            {/* Main panels */}
            <div className="dashboard-grid">
                
                {/* Left Columns: recommendations, courses, gamification */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Adaptive suggestions */}
                    {user.role !== 'DISTRICT_ADMIN' && recommendation && (
                        <div className="glass-panel pulse-glow" style={{ borderLeft: '4px solid var(--accent)', background: 'rgba(47,110,99,0.03)' }}>
                            <span className="badge-pill badge-info" style={{ background: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '0.8rem', display: 'inline-block' }}>
                                🎯 {t('recommended')}
                            </span>
                            <h3 style={{ marginTop: '0.2rem', color: 'var(--text-primary)' }}>{recommendation.item.title}</h3>
                            <p style={{ fontSize: '0.9rem', marginBottom: '1.2rem' }}>
                                Suggested activity mapping to your BKT understanding value of {(recommendation.mastery * 100).toFixed(0)}%.
                            </p>
                            <button 
                                className="btn btn-accent"
                                onClick={async () => {
                                    const module = await db.modules.get(Number(recommendation.item.moduleId));
                                    if (module) onSelectCourse(module.courseId);
                                }}
                            >
                                {t('learn')}
                            </button>
                        </div>
                    )}

                    {/* Courses List */}
                    <div>
                        <h2>{t('courses')}</h2>
                        {courses.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                {t('noCourses')}
                            </div>
                        ) : (
                            <div className="card-grid">
                                {courses.map(course => (
                                    <div key={course.id} className="glass-panel" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '180px' }} onClick={() => onSelectCourse(course.id)}>
                                        <div>
                                            <span className="badge-pill badge-info" style={{ fontSize: '0.75rem' }}>{course.subject}</span>
                                            <h3 style={{ marginTop: '0.5rem', fontSize: '1.25rem' }}>{course.title}</h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{course.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('grade')} {course.grade}</span>
                                            <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem' }}>Open →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Gamification Badges */}
                    {user.role !== 'DISTRICT_ADMIN' && (
                        <div className="glass-panel">
                            <h3>🏆 {t('badges')}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Earn achievements by reviewing items and passing module tests.</p>
                            
                            <div className="badges-container">
                                {badges.map(badge => (
                                    <div key={badge.id} className={`badge-item ${badge.active ? 'active' : ''}`} title={badge.desc}>
                                        <div className="badge-icon-wrap">
                                            {badge.icon}
                                        </div>
                                        <div className="badge-name" style={{ color: badge.active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: badge.active ? '600' : '400' }}>
                                            {badge.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Marks — Quiz Attempt History */}
                    {user.role === 'STUDENT' && quizHistory.length > 0 && (
                        <div className="glass-panel">
                            <h3>📋 My Marks</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Your recent quiz attempts — graded instantly on-device.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {quizHistory.map(attempt => {
                                    const pctColor = attempt.percentage >= 75 ? 'var(--success)' : attempt.percentage >= 50 ? '#f59e0b' : 'var(--danger)';
                                    return (
                                        <div key={attempt.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.8rem 1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '500', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{attempt.quizTitle}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                    {new Date(attempt.attemptTimestamp).toLocaleDateString()}
                                                    {attempt.reviewPending && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>✏️ Pending Review</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: pctColor }}>
                                                    {attempt.percentage}%
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {attempt.score}/{attempt.maxScore} pts
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Columns: BKT Tracker & Leaderboard */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* BKT progress tracking */}
                    <div className="glass-panel">
                        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
                            📊 {t('masteryTracker')}
                        </h3>
                        {masteryList.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                                Complete quiz modules to map BKT intelligence.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                {masteryList.map(item => (
                                    <div key={item.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                                            <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>
                                                {item.skillTag.replace('-', ' ')}
                                            </span>
                                            <span style={{ color: getMasteryColor(item.masteryProbability), fontWeight: '600' }}>
                                                {(item.masteryProbability * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ 
                                                width: `${item.masteryProbability * 100}%`, 
                                                height: '100%', 
                                                backgroundColor: getMasteryColor(item.masteryProbability),
                                                transition: 'width 0.5s ease'
                                            }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* relative mastery Leaderboard */}
                    <div className="glass-panel">
                        <h3>🥇 {t('leaderboard')}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Rank is computed fairly based on relative knowledge improvements rather than connection durations.
                        </p>
                        
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>{t('rank')}</th>
                                    <th>{t('studentName')}</th>
                                    <th>{t('masteryGain')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map(row => (
                                    <tr key={row.rank} style={{ background: row.name === user.fullName ? 'var(--primary-light)' : 'none' }}>
                                        <td>{row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}</td>
                                        <td style={{ fontWeight: row.name === user.fullName ? 'bold' : 'normal', color: row.name === user.fullName ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                            {row.name} {row.name === user.fullName ? '(You)' : ''}
                                        </td>
                                        <td style={{ color: 'var(--success)', fontWeight: '600' }}>+{row.gain}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
}
