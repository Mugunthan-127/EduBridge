import React, { useState, useEffect } from 'react';
import { db, getCurrentUser, clearCurrentUser, saveCurrentUser } from './db/db';
import { syncData } from './db/sync';
import { discoverAndSync, startMeshResponder } from './db/contentMesh';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import CourseDetail from './views/CourseDetail';
import QuizView from './views/QuizView';
import TeacherAnalytics from './views/TeacherAnalytics';
import TeacherCourseManager from './views/TeacherCourseManager';
import SchoolAdmin from './views/SchoolAdmin';
import DistrictAdmin from './views/DistrictAdmin';
import OfflineChatbot from './views/OfflineChatbot';
import ParentDashboard from './views/ParentDashboard';

// Dynamic online simulation override
let onlineOverride = localStorage.getItem('online_override') !== 'false';
try {
    Object.defineProperty(navigator, 'onLine', {
        get: () => onlineOverride,
        configurable: true
    });
} catch (e) {
    console.warn('Failed to override navigator.onLine:', e);
}

export default function App() {
    const [view, setView] = useState('LOGIN');
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState(null);
    const [selectedQuizId, setSelectedQuizId] = useState(null);
    const [lang, setLang] = useState('en');

    // Chatbot — can be opened programmatically with an initial query (e.g. from QuizView)
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [chatbotInitialQuery, setChatbotInitialQuery] = useState('');

    // Connectivity, Sync, & Mesh states
    const [online, setOnline] = useState(onlineOverride);
    const [syncQueueCount, setSyncQueueCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState(Date.now());
    const [isSyncing, setIsSyncing] = useState(false);
    const [backoff, setBackoff] = useState(2);
    const [tick, setTick] = useState(0);

    // Mesh state
    const [meshConnectedPeers, setMeshConnectedPeers] = useState(0);
    const [meshStatus, setMeshStatus] = useState('Idle');
    const [isMeshActive, setIsMeshActive] = useState(false);

    const handleOpenChatbot = (initialQuery = '') => {
        setChatbotInitialQuery(initialQuery);
        setChatbotOpen(true);
    };

    const handleToggleOnline = () => {
        const nextVal = !online;
        onlineOverride = nextVal;
        localStorage.setItem('online_override', String(nextVal));
        setOnline(nextVal);
        window.dispatchEvent(new Event(nextVal ? 'online' : 'offline'));
    };

    useEffect(() => {
        const init = async () => {
            await seedLocalDatabase();
            const user = await getCurrentUser();
            if (user) {
                setCurrentUser(user);
                setView('DASHBOARD');
                if (navigator.onLine) syncData();
            }
        };
        init();

        // Start mesh responder so this tab can serve content to other tabs
        const stopMeshResponder = startMeshResponder();

        // Dynamic status strip ticks & sync queue checker
        const tickTimer = setInterval(() => {
            setTick(t => t + 1);
            setBackoff(b => {
                if (b > 1) return b - 1;
                return 2;
            });
        }, 1000);
        const queueTimer = setInterval(async () => {
            try {
                const count = await db.syncQueue.count();
                setSyncQueueCount(count);
            } catch (e) {
                console.error('[App] Failed to count syncQueue:', e);
            }
        }, 1500);

        return () => {
            stopMeshResponder();
            clearInterval(tickTimer);
            clearInterval(queueTimer);
        };
    }, []);

    const seedLocalDatabase = async () => {
        try {
            const count = await db.courses.count();
            if (count === 0) {
                console.log('Seeding IndexedDB with demo curriculum packs...');
                
                await db.courses.bulkPut([
                    {
                        id: 1,
                        title: "Physics of Light and Optics",
                        description: "Understand reflections, refraction, light waves, and optical lenses.",
                        subject: "Science",
                        grade: "8",
                        tenantId: "school-1"
                    },
                    {
                        id: 2,
                        title: "Introductory Algebraic Equations",
                        description: "Master variables, linear systems, and equation balancing.",
                        subject: "Mathematics",
                        grade: "8",
                        tenantId: "school-1"
                    }
                ]);

                await db.modules.bulkPut([
                    {
                        id: 1,
                        title: "Mirrors and Reflection Laws",
                        description: "Basic behavior of light waves on reflective surfaces.",
                        courseId: 1,
                        sequenceOrder: 1
                    },
                    {
                        id: 2,
                        title: "Refraction and Lenses",
                        description: "Study how light bends when passing between mediums.",
                        courseId: 1,
                        sequenceOrder: 2
                    },
                    {
                        id: 3,
                        title: "Linear Equations",
                        description: "Solving for variables on single-degree equations.",
                        courseId: 2,
                        sequenceOrder: 1
                    }
                ]);

                await db.content.bulkPut([
                    {
                        id: 1,
                        title: "Reflection Laws Video Tutorial",
                        description: "Animated demonstration of angle of incidence and plane reflection.",
                        contentType: "VIDEO",
                        fileUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4",
                        moduleId: 1,
                        skillTag: "reflection",
                        sha256Checksum: "f7a31b8d234ca9b9d0b5e43c5b8e91823a7cf8d123ea9d08e5c8e3a2b72da9a1",
                        fileSizeBytes: 8482910,
                        localDownloaded: false
                    },
                    {
                        id: 2,
                        title: "Mirrors Study Note",
                        description: "Text summary of concave, convex, and plane mirrors.",
                        contentType: "NOTES",
                        fileUrl: "https://example.com/mirrors-notes.pdf",
                        moduleId: 1,
                        skillTag: "reflection",
                        sha256Checksum: "b9d234ea7f89d0b5e43c5b8e91823a7cf8d123ea9d08e5c8e3a2b72da9a1a6c8",
                        fileSizeBytes: 1049102,
                        localDownloaded: false
                    },
                    {
                        id: 3,
                        title: "Refraction and Snell's Law Notes",
                        description: "Formula derivations and index of refraction charts.",
                        contentType: "NOTES",
                        fileUrl: "https://example.com/snell-law.pdf",
                        moduleId: 2,
                        skillTag: "refraction",
                        sha256Checksum: "234ea7f89d0b5e43c5b8e91823a7cf8d123ea9d08e5c8e3a2b72da9a1a6c8b9d",
                        fileSizeBytes: 1205310,
                        localDownloaded: false
                    }
                ]);

                await db.quizzes.bulkPut([
                    {
                        id: 1,
                        title: "Optics & Reflection Basics",
                        moduleId: 1,
                        skillTag: "reflection",
                        totalPoints: 3,
                        questionsJson: JSON.stringify([
                            {
                                questionText: "What is the law of reflection?",
                                choices: [
                                    "Angle of incidence is greater than angle of reflection",
                                    "Angle of incidence is equal to angle of reflection",
                                    "Angle of incidence is less than angle of reflection",
                                    "Light waves always bend at 90 degrees"
                                ],
                                correctAnswer: 1
                            },
                            {
                                questionText: "Which type of mirror forms a virtual, upright image of the same size as the object?",
                                choices: [
                                    "Concave mirror",
                                    "Convex mirror",
                                    "Plane mirror",
                                    "Parabolic mirror"
                                ],
                                correctAnswer: 2
                            },
                            {
                                questionText: "What happens to the speed of light when it passes from air into a glass block?",
                                choices: [
                                    "It speeds up",
                                    "It slows down",
                                    "It remains exactly the same",
                                    "It stops completely"
                                ],
                                correctAnswer: 1
                            }
                        ])
                    },
                    {
                        id: 2,
                        title: "Snell's Law Short Quiz",
                        moduleId: 2,
                        skillTag: "refraction",
                        totalPoints: 2,
                        questionsJson: JSON.stringify([
                            {
                                questionText: "Refraction occurs because light waves change what when passing between mediums?",
                                choices: ["Color", "Frequency", "Velocity", "Direction only"],
                                correctAnswer: 2
                            },
                            {
                                questionText: "Snell's Law relates which values?",
                                choices: ["Speed and temperature", "Mass and energy", "Angles and indices of refraction", "Angles and wave amplitudes"],
                                correctAnswer: 2
                            }
                        ])
                    }
                ]);
            }
        } catch (err) {
            console.error('Failed to seed DB:', err);
        }
    };

    const handleLoginSuccess = (user) => {
        setCurrentUser(user);
        setView(user.role === 'PARENT' ? 'PARENT_DASHBOARD' : 'DASHBOARD');
    };

    const handleLogout = async () => {
        await clearCurrentUser();
        setCurrentUser(null);
        setView('LOGIN');
    };

    // Role simulation triggers (critical for quick assessment demo panel)
    const handleSimulateRoleChange = async (targetRole) => {
        if (!currentUser) return;
        const updatedUser = {
            ...currentUser,
            role: targetRole
        };
        await saveCurrentUser(updatedUser);
        setCurrentUser(updatedUser);
        if (targetRole === 'PARENT') {
            setView('PARENT_DASHBOARD');
        } else if (targetRole === 'SCHOOL_ADMIN') {
            setView('SCHOOL_ADMIN');
        } else {
            setView('DASHBOARD');
        }
    };

    // Local Content Mesh — real BroadcastChannel-based sync (SRS v2 §5.4)
    const handleSimulateMeshSearch = async () => {
        setIsMeshActive(true);
        setMeshStatus('Broadcasting manifest request to mesh...');

        const result = await discoverAndSync((status) => {
            setMeshStatus(status);
        });

        setMeshConnectedPeers(result.peersFound);
        setIsMeshActive(false);
    };

    return (
        <div className="app-container" style={{ paddingBottom: '80px' }}>
            {/* Top Persistent Status Strip */}
            <div style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--text-primary)',
                color: '#CFE3DC',
                fontSize: '12px',
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
                borderBottom: '1px solid var(--border-color)',
                zIndex: 1010
            }}>
                <button
                    onClick={handleToggleOnline}
                    style={{
                        fontFamily: 'var(--font-mono)',
                        background: 'transparent',
                        border: 'none',
                        color: online ? '#8FD8AE' : '#E39A94',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        padding: 0,
                        margin: 0
                    }}
                    title="Click to simulate connectivity change"
                >
                    <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: online ? '#10b981' : '#ef4444'
                    }} />
                    {online ? 'online' : 'offline'}
                </button>
                <span>🔄 sync queue: <b>{syncQueueCount} items</b>{syncQueueCount > 0 && !online ? ` (retry in ${backoff}s)` : ''}</span>
                <span>📶 mesh peers: <b>{meshConnectedPeers} peers</b></span>
                <span>⏱️ last sync: {Math.max(0, Math.floor((Date.now() - lastSyncTime) / 1000))}s ago</span>
                <button
                    onClick={async () => {
                        setIsSyncing(true);
                        if (online) {
                            await syncData();
                            setLastSyncTime(Date.now());
                            setBackoff(2);
                        } else {
                            setBackoff(b => Math.min(32, b * 2));
                        }
                        setIsSyncing(false);
                    }}
                    disabled={isSyncing}
                    style={{
                        fontFamily: 'var(--font-mono)',
                        marginLeft: 'auto',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    {isSyncing ? 'syncing...' : 'sync now'}
                </button>
            </div>

            {/* Top Navigation Header */}
            <header className="navbar">
                <div className="navbar-brand">
                    <span>⚡ EduBridge</span>
                </div>
                {currentUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {/* Mesh Controller */}
                        <div className="glass-panel" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                📶 Mesh: <b>{meshConnectedPeers} peers</b>
                            </span>
                            <button 
                                onClick={handleSimulateMeshSearch} 
                                disabled={isMeshActive}
                                className="btn btn-secondary" 
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', margin: 0 }}
                            >
                                {isMeshActive ? 'Linking...' : 'Mesh Sync'}
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                {currentUser.fullName} ({currentUser.role})
                            </span>
                            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </header>

            {/* Mesh Banner */}
            {isMeshActive || meshStatus === 'Completed. Local Content Mesh synchronized!' ? (
                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.6rem 2rem', fontSize: '0.85rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: '0.8rem', alignItems: 'center' }}>
                    <span>🔗 <b>Local Content Mesh:</b> {meshStatus}</span>
                    {meshStatus === 'Completed. Local Content Mesh synchronized!' && (
                        <button 
                            onClick={() => setMeshStatus('Idle')} 
                            style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            ) : null}

            {/* Main Content View Dispatch */}
            <main className="main-content">
                {view === 'LOGIN' && (
                    <Login onLoginSuccess={handleLoginSuccess} />
                )}
                {view === 'DASHBOARD' && currentUser?.role !== 'PARENT' && (
                    <Dashboard 
                        user={currentUser} 
                        lang={lang}
                        setLang={setLang}
                        onSelectCourse={(courseId) => {
                            setSelectedCourseId(courseId);
                            setView('COURSE_DETAIL');
                        }} 
                        onNavigateTeacher={() => setView('TEACHER_ANALYTICS')}
                        onNavigateDistrict={() => setView('DISTRICT_ADMIN')}
                        onNavigateSchoolAdmin={() => setView('SCHOOL_ADMIN')}
                        onNavigateCourseManager={() => setView('TEACHER_COURSE_MANAGER')}
                    />
                )}
                {view === 'PARENT_DASHBOARD' && currentUser?.role === 'PARENT' && (
                    <ParentDashboard 
                        user={currentUser} 
                        onBack={() => setView('LOGIN')} 
                    />
                )}
                {view === 'COURSE_DETAIL' && (
                    <CourseDetail 
                        courseId={selectedCourseId}
                        user={currentUser}
                        onBack={() => setView('DASHBOARD')}
                        onSelectQuiz={(quizId) => {
                            setSelectedQuizId(quizId);
                            setView('QUIZ');
                        }}
                    />
                )}
                {view === 'QUIZ' && (
                    <QuizView
                        quizId={selectedQuizId}
                        user={currentUser}
                        onBack={() => setView('COURSE_DETAIL')}
                        onOpenChatbot={handleOpenChatbot}
                    />
                )}
                {view === 'TEACHER_ANALYTICS' && currentUser?.role === 'TEACHER' && (
                    <TeacherAnalytics onBack={() => setView('DASHBOARD')} />
                )}
                {view === 'TEACHER_COURSE_MANAGER' && currentUser?.role === 'TEACHER' && (
                    <TeacherCourseManager
                        user={currentUser}
                        onBack={() => setView('DASHBOARD')}
                        onOpenCourse={(courseId) => {
                            setSelectedCourseId(courseId);
                            setView('COURSE_DETAIL');
                        }}
                    />
                )}
                {view === 'TEACHER_ANALYTICS' && currentUser?.role !== 'TEACHER' && (
                    <div className="glass-panel" style={{ color: 'var(--danger)', margin: '2rem' }}>
                        Error: You do not have permission to view this page. <button className="btn btn-secondary" onClick={() => setView('DASHBOARD')}>Go Back</button>
                    </div>
                )}
                {view === 'DISTRICT_ADMIN' && currentUser?.role === 'DISTRICT_ADMIN' && (
                    <DistrictAdmin onBack={() => setView('DASHBOARD')} />
                )}
                {view === 'DISTRICT_ADMIN' && currentUser?.role !== 'DISTRICT_ADMIN' && (
                    <div className="glass-panel" style={{ color: 'var(--danger)', margin: '2rem' }}>
                        Error: You do not have permission to view this page. <button className="btn btn-secondary" onClick={() => setView('DASHBOARD')}>Go Back</button>
                    </div>
                )}
                {view === 'SCHOOL_ADMIN' && currentUser?.role === 'SCHOOL_ADMIN' && (
                    <SchoolAdmin user={currentUser} onBack={() => setView('DASHBOARD')} />
                )}
                {view === 'SCHOOL_ADMIN' && currentUser?.role !== 'SCHOOL_ADMIN' && (
                    <div className="glass-panel" style={{ color: 'var(--danger)', margin: '2rem' }}>
                        Error: You do not have permission to view this page. <button className="btn btn-secondary" onClick={() => setView('DASHBOARD')}>Go Back</button>
                    </div>
                )}
            </main>

            {/* Offline AI Tutor Chatbot */}
            {currentUser && (
                <OfflineChatbot
                    user={currentUser}
                    externalOpen={chatbotOpen}
                    initialQuery={chatbotInitialQuery}
                    onExternalClose={() => { setChatbotOpen(false); setChatbotInitialQuery(''); }}
                />
            )}

            {/* Fixed Bottom Demo Panel (allows reviewer to test roles without logging out) */}
            {currentUser && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, height: '60px',
                    background: 'var(--text-primary)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem',
                    zIndex: 1000, backdropFilter: 'blur(10px)'
                }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--bg-primary)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                        ⚡ QUICK SWITCHER:
                    </span>
                    <button 
                        onClick={() => handleSimulateRoleChange('STUDENT')} 
                        className={`btn ${currentUser.role === 'STUDENT' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                    >
                        🧑‍🎓 Student
                    </button>
                    <button 
                        onClick={() => handleSimulateRoleChange('TEACHER')} 
                        className={`btn ${currentUser.role === 'TEACHER' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                    >
                        👩‍🏫 Teacher
                    </button>
                    <button 
                        onClick={() => handleSimulateRoleChange('PARENT')} 
                        className={`btn ${currentUser.role === 'PARENT' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                    >
                        👪 Parent
                    </button>
                    <button 
                        onClick={() => handleSimulateRoleChange('SCHOOL_ADMIN')} 
                        className={`btn ${currentUser.role === 'SCHOOL_ADMIN' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                    >
                        🏫 School Admin
                    </button>
                    <button 
                        onClick={() => handleSimulateRoleChange('DISTRICT_ADMIN')} 
                        className={`btn ${currentUser.role === 'DISTRICT_ADMIN' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                    >
                        🏢 District Admin
                    </button>
                </div>
            )}
        </div>
    );
}
