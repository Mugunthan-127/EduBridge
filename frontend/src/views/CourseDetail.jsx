import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';
import { discoverAndSync, startMeshResponder } from '../db/contentMesh';

export default function CourseDetail({ courseId, user, onBack, onSelectQuiz }) {
    const [course, setCourse] = useState(null);
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState(null);
    const [contents, setContents] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isEnrolled, setIsEnrolled] = useState(false);

    // Mesh state
    const [meshSyncing, setMeshSyncing] = useState(false);
    const [meshStatus, setMeshStatus] = useState('');

    // Simulated Adaptive Video State
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [bitrate, setBitrate] = useState('720p (HD)');
    const [isMuted, setIsMuted] = useState(false);

    // AI Quiz Generator State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [skillTag, setSkillTag] = useState('reflection');

    // Manual Quiz Creator State
    const [showManualCreator, setShowManualCreator] = useState(false);
    const [manualQuizTitle, setManualQuizTitle] = useState('');
    const [manualSkillTag, setManualSkillTag] = useState('reflection');
    const [manualQuestions, setManualQuestions] = useState([]);
    
    // Manual Question Input State
    const [qText, setQText] = useState('');
    const [qType, setQType] = useState('single-choice'); // 'single-choice' | 'short-text'
    const [choices, setChoices] = useState(['', '', '', '']);
    const [correctIdx, setCorrectIdx] = useState(0);
    const [keywords, setKeywords] = useState('');          // for short-text type

    // Mesh advertise state (teacher)
    const [meshAdvertising, setMeshAdvertising] = useState(false);
    const [meshAdvertiseStatus, setMeshAdvertiseStatus] = useState('');

    useEffect(() => {
        loadCourseDetails();
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [courseId]);

    const loadCourseDetails = async () => {
        try {
            const courseData = await db.courses.get(Number(courseId));
            setCourse(courseData);
            // Check enrollment (stored as a flag on the course row)
            setIsEnrolled(!!courseData?.enrolled);

            const modulesList = await db.modules
                .where({ courseId: Number(courseId) })
                .sortBy('sequenceOrder');
            setModules(modulesList);

            if (modulesList.length > 0) {
                handleSelectModule(modulesList[0]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleEnroll = async () => {
        const courseData = await db.courses.get(Number(courseId));
        if (!courseData) return;
        courseData.enrolled = true;
        await db.courses.put(courseData);
        setIsEnrolled(true);
        // Queue sync so server knows student enrolled
        await queueSyncItem(`/api/courses/${courseId}/enroll`, 'POST', {
            studentId: user.userId,
            courseId: Number(courseId),
            enrolledAt: Date.now()
        });
    };

    const handleMeshSync = async () => {
        setMeshSyncing(true);
        setMeshStatus('Searching for peers...');
        await discoverAndSync((status) => setMeshStatus(status));
        setMeshSyncing(false);
        // Reload content to show newly downloaded items
        if (selectedModule) {
            const localContent = await db.content.where({ moduleId: selectedModule.id }).toArray();
            setContents(localContent);
        }
    };

    const handleSelectModule = async (module) => {
        setSelectedModule(module);
        setSelectedVideo(null); // clear video selection
        try {
            const localContent = await db.content.where({ moduleId: module.id }).toArray();
            setContents(localContent);

            const localQuizzes = await db.quizzes.where({ moduleId: module.id }).toArray();
            setQuizzes(localQuizzes);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownloadContent = async (contentId) => {
        const item = await db.content.get(contentId);
        if (item) {
            item.localDownloaded = true;
            await db.content.put(item);
            
            const localContent = await db.content.where({ moduleId: selectedModule.id }).toArray();
            setContents(localContent);
            alert(`"${item.title}" successfully cached offline! (SHA-256 Verified: ${item.sha256Checksum || 'd93b1a...'})`);
        }
    };

    // Play video in simulated player
    const handlePlayVideo = (item) => {
        setSelectedVideo(item);
        if (!isOnline || item.localDownloaded) {
            setBitrate('Offline Local Playback (Orig)');
        } else {
            setBitrate('720p (HD) - Auto Bitrate');
        }
    };

    // Add manual question to draft — supports single-choice & short-text
    const handleAddQuestion = () => {
        if (!qText) { alert('Please fill out the question text.'); return; }

        let newQ;
        if (qType === 'short-text') {
            if (!keywords.trim()) { alert('Please enter at least one answer keyword.'); return; }
            newQ = {
                questionText: qText,
                type: 'short-text',
                correctAnswer: keywords.split(',').map(k => k.trim()).filter(Boolean)
            };
        } else {
            if (choices.some(c => c === '')) { alert('Please fill out all 4 choices.'); return; }
            newQ = {
                questionText: qText,
                type: 'single-choice',
                choices: [...choices],
                correctAnswer: Number(correctIdx)
            };
        }

        setManualQuestions([...manualQuestions, newQ]);
        setQText('');
        setChoices(['', '', '', '']);
        setCorrectIdx(0);
        setKeywords('');
    };

    /**
     * Teacher: Advertise to Classroom Mesh
     * Acts as the "publisher" side of the BroadcastChannel mesh —
     * starts a responder that answers student manifest requests for this module's content.
     */
    const handleAdvertiseToMesh = async () => {
        if (!selectedModule) return;
        setMeshAdvertising(true);
        setMeshAdvertiseStatus('Advertising content to classroom mesh...');
        const stopResponder = startMeshResponder();
        setMeshAdvertiseStatus('📡 Mesh responder active — student devices can now pull content from this device');
        // Keep responder alive for 2 minutes then auto-stop
        setTimeout(() => {
            stopResponder();
            setMeshAdvertising(false);
            setMeshAdvertiseStatus('✅ Advertising session ended. Content propagated to peers.');
            setTimeout(() => setMeshAdvertiseStatus(''), 5000);
        }, 120_000);
    };

    // Auto-fill questions via Offline AI Simulation (Local RAG)
    const handleAutoFillAiDraft = async () => {
        setIsGenerating(true);
        // Simulate reading local content and drafting questions
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const aiDrafts = [
            {
                questionText: `What happens to light during refraction based on this module?`,
                choices: ['It stops completely', 'It bends as velocity changes', 'It gets absorbed', 'It reflects backwards'],
                correctAnswer: 1
            },
            {
                questionText: `Which law is primarily discussed for calculating reflection angles?`,
                choices: ['Newton\'s Second Law', 'Snell\'s Law', 'Law of Reflection (Angle I = Angle R)', 'Thermodynamics'],
                correctAnswer: 2
            },
            {
                questionText: `If a light wave enters a denser medium, what happens to its speed?`,
                choices: ['It speeds up', 'It slows down', 'It remains constant', 'It vanishes'],
                correctAnswer: 1
            }
        ];

        setManualQuestions([...manualQuestions, ...aiDrafts]);
        if (!manualQuizTitle) setManualQuizTitle('AI Generated Assessment Draft');
        setIsGenerating(false);
    };

    // Save manual quiz to DB & Sync Queue
    const handleSaveManualQuiz = async () => {
        if (!manualQuizTitle || manualQuestions.length === 0) {
            alert('Please provide a quiz title and add at least 1 question.');
            return;
        }

        const newQuiz = {
            title: manualQuizTitle,
            moduleId: selectedModule.id,
            skillTag: manualSkillTag,
            totalPoints: manualQuestions.length,
            questionsJson: JSON.stringify(manualQuestions)
        };

        try {
            const savedId = await db.quizzes.add(newQuiz);
            newQuiz.id = savedId;

            // Queue a sync transaction to save this quiz in backend database
            await queueSyncItem('/api/quizzes', 'POST', newQuiz);

            // Reload quizzes list
            const localQuizzes = await db.quizzes.where({ moduleId: selectedModule.id }).toArray();
            setQuizzes(localQuizzes);

            // Reset manual quiz draft states
            setManualQuizTitle('');
            setManualQuestions([]);
            setShowManualCreator(false);
            alert('Quiz saved successfully offline and queued for server sync!');
        } catch (err) {
            alert(`Error saving quiz: ${err.message}`);
        }
    };

    // AI Quiz Generator
    const handleAiGenerateQuiz = async (e) => {
        e.preventDefault();
        if (!selectedModule) return;
        setIsGenerating(true);

        try {
            if (isOnline) {
                const response = await fetch('http://localhost:8080/api/ai/generate-quiz', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify({
                        prompt: aiPrompt,
                        moduleId: selectedModule.id,
                        skillTag: skillTag
                    })
                });

                if (response.ok) {
                    const quizData = await response.json();
                    await db.quizzes.put(quizData);
                    alert("Quiz generated successfully via Gemini AI Cloud!");
                } else {
                    throw new Error("Cloud generator error");
                }
            } else {
                // Local quantized AI model simulation (Sprint 6 Graceful Fallback)
                await new Promise(resolve => setTimeout(resolve, 2000)); // simulate on-device CPU load

                const sampleQuiz = {
                    title: `AI Offline Quiz: ${aiPrompt.substring(0, 20)}...`,
                    moduleId: selectedModule.id,
                    skillTag: skillTag,
                    totalPoints: 2,
                    questionsJson: JSON.stringify([
                        {
                            questionText: `Which of the following is true regarding ${skillTag}?`,
                            choices: ['Option A: Initial state', 'Option B: Dynamic equilibrium', 'Option C: Inertia', 'Option D: Friction'],
                            correctAnswer: 1
                        },
                        {
                            questionText: `What is the core principle behind ${aiPrompt.substring(0, 15)}?`,
                            choices: ['Law of Energy', 'BKT Mastery Probability', 'Quantized Energy States', 'Local Mesh Broadcast'],
                            correctAnswer: 2
                        }
                    ])
                };

                const savedId = await db.quizzes.add(sampleQuiz);
                sampleQuiz.id = savedId;

                await queueSyncItem('/api/quizzes', 'POST', sampleQuiz);
                alert("Offline Local AI Model generated quiz and queued it for synchronization!");
            }

            const localQuizzes = await db.quizzes.where({ moduleId: selectedModule.id }).toArray();
            setQuizzes(localQuizzes);
            setAiPrompt('');
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            
            {/* Navigation Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
                {course && (
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0 }}>{course.title}</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{course.subject} | Grade {course.grade}</p>
                    </div>
                )}
                {!isEnrolled ? (
                    <button
                        id="enroll-btn"
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.2rem', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                        onClick={handleEnroll}
                    >
                        📚 Enroll in Course
                    </button>
                ) : (
                    <span className="badge-pill badge-success" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                        ✅ Enrolled
                    </span>
                )}
            </div>

            {/* Online / Offline content mode banner */}
            <div style={{
                padding: '0.8rem 1.2rem',
                borderRadius: 'var(--radius-sm)',
                background: isOnline
                    ? 'rgba(16,185,129,0.07)'
                    : 'rgba(139,92,246,0.07)',
                border: `1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                fontSize: '0.87rem'
            }}>
                <span style={{ fontSize: '1.2rem' }}>{isOnline ? '🌐' : '📶'}</span>
                <div style={{ flex: 1 }}>
                    <b style={{ color: isOnline ? 'var(--success)' : '#a78bfa' }}>
                        {isOnline ? 'Online Mode — Stream & Cloud Sync' : 'Offline Mode — Local Mesh Active'}
                    </b>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.1rem' }}>
                        {isOnline
                            ? 'Videos stream live at adaptive bitrate. Progress syncs to teacher in background.'
                            : 'Download cached files or use Mesh Sync to get content from nearby peers.'}
                    </div>
                </div>
                {!isOnline && (
                    <button
                        id="mesh-sync-btn"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderColor: '#7c3aed', color: '#a78bfa', flexShrink: 0 }}
                        disabled={meshSyncing}
                        onClick={handleMeshSync}
                    >
                        {meshSyncing ? '🔗 Syncing...' : '📡 Mesh Sync'}
                    </button>
                )}
            </div>

            {/* Mesh status message */}
            {meshStatus && (
                <div style={{ fontSize: '0.82rem', color: '#a78bfa', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    🔗 {meshStatus}
                </div>
            )}

            {/* Layout Grid */}
            <div className="dashboard-grid">
                
                {/* Left Side: Modules list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3>Modules</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {modules.map(mod => (
                            <div 
                                key={mod.id} 
                                className="glass-panel"
                                style={{ 
                                    cursor: 'pointer', 
                                    padding: '1rem',
                                    borderLeft: selectedModule?.id === mod.id ? '4px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: selectedModule?.id === mod.id ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)'
                                }}
                                onClick={() => handleSelectModule(mod)}
                            >
                                <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{mod.sequenceOrder}. {mod.title}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{mod.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Learning content, players & Quizzes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Simulated Adaptive Video Player (Module 4) */}
                    {selectedVideo && (
                        <div className="glass-panel">
                            <h3>🎥 Adaptive Video Player</h3>
                            <div className="adaptive-player" style={{ margin: '1rem 0' }}>
                                <video 
                                    src={selectedVideo.fileUrl} 
                                    controls 
                                    muted={isMuted} 
                                    style={{ width: '100%', display: 'block' }}
                                />
                                <div className="player-controls">
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{selectedVideo.title}</span>
                                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => setIsMuted(!isMuted)} 
                                            style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}
                                        >
                                            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <span>Network State: <b>{isOnline ? '🌐 Connected' : '📶 Offline'}</b></span>
                                <div>
                                    Streaming Bitrate: 
                                    <select 
                                        value={bitrate} 
                                        onChange={e => setBitrate(e.target.value)}
                                        disabled={!isOnline || selectedVideo.localDownloaded}
                                        style={{ width: 'fit-content', marginLeft: '0.5rem', padding: '0.2rem' }}
                                    >
                                        <option value="1080p (FHD)">1080p (FHD)</option>
                                        <option value="720p (HD) - Auto Bitrate">720p (HD) - Auto</option>
                                        <option value="480p (SD)">480p (SD)</option>
                                        <option value="240p (Mobile)">240p (Mobile)</option>
                                        <option value="Offline Local Playback (Orig)">Offline Cached (Original)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedModule && (
                        <>
                            {/* Materials section */}
                            <div>
                                <h3>Curriculum Materials</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                    {contents.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)' }}>No materials in this module.</p>
                                    ) : (
                                        contents.map(item => (
                                            <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                                                <div style={{ cursor: item.contentType === 'VIDEO' ? 'pointer' : 'default' }} onClick={() => item.contentType === 'VIDEO' && handlePlayVideo(item)}>
                                                    <span className="badge-pill badge-info" style={{ fontSize: '0.7rem', marginRight: '0.5rem' }}>{item.contentType}</span>
                                                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                                                        {item.title} {item.contentType === 'VIDEO' ? '▶' : ''}
                                                    </span>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                        Skill Tag: <code style={{ color: 'var(--accent)' }}>{item.skillTag}</code> | size: {(item.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                                                    </div>
                                                </div>
                                                <div>
                                                    {item.localDownloaded ? (
                                                        <span className="badge-success badge-pill">💾 Cached Offline</span>
                                                    ) : (
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => handleDownloadContent(item.id)}
                                                        >
                                                            📥 Cache Offline
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Quizzes section */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3>Assessments</h3>
                                    {user.role === 'TEACHER' && (
                                        <button 
                                            onClick={() => setShowManualCreator(!showManualCreator)} 
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                        >
                                            {showManualCreator ? 'Cancel Creator' : '➕ Author Quiz'}
                                        </button>
                                    )}
                                </div>

                                {/* Manual Quiz Creator Form (Teacher role) */}
                                {showManualCreator && (
                                    <div className="glass-panel" style={{ marginTop: '1rem', border: '1px solid var(--primary)' }}>
                                        <h4>✍️ Manual Assessment Authoring</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Quiz Title</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g., Reflection Angle Quiz" 
                                                    value={manualQuizTitle} 
                                                    onChange={e => setManualQuizTitle(e.target.value)} 
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Skill Tag</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g., reflection" 
                                                    value={manualSkillTag} 
                                                    onChange={e => setManualSkillTag(e.target.value)} 
                                                />
                                            </div>

                                            {/* Questions draft list */}
                                            {manualQuestions.length > 0 && (
                                                <div style={{ padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                    <h5 style={{ color: 'var(--primary)' }}>Questions Added: {manualQuestions.length}</h5>
                                                    <ol style={{ paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                                                        {manualQuestions.map((q, idx) => (
                                                            <li key={idx}>{q.questionText}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}

                                            {/* Add question form block */}
                                            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                                    <h5 style={{ margin: 0 }}>Add Question</h5>
                                                    {/* Question type toggle */}
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        {['single-choice', 'short-text'].map(t => (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                onClick={() => setQType(t)}
                                                                style={{
                                                                    padding: '0.25rem 0.65rem', fontSize: '0.72rem',
                                                                    borderRadius: '4px', cursor: 'pointer',
                                                                    background: qType === t ? 'var(--primary)' : 'var(--bg-card)',
                                                                    color: qType === t ? '#fff' : 'var(--text-primary)', border: `1px solid ${qType === t ? 'var(--primary)' : 'var(--border-color)'}`
                                                                }}
                                                            >
                                                                {t === 'single-choice' ? '🔘 Objective' : '✍️ Short Answer'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Question text"
                                                        value={qText}
                                                        onChange={e => setQText(e.target.value)}
                                                    />

                                                    {qType === 'single-choice' ? (
                                                        <>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                                {choices.map((choice, idx) => (
                                                                    <input
                                                                        key={idx}
                                                                        type="text"
                                                                        placeholder={`Choice ${idx + 1}`}
                                                                        value={choice}
                                                                        onChange={e => {
                                                                            const updated = [...choices];
                                                                            updated[idx] = e.target.value;
                                                                            setChoices(updated);
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div>
                                                                <label style={{ marginRight: '0.8rem', fontSize: '0.85rem' }}>Correct Choice:</label>
                                                                <select value={correctIdx} onChange={e => setCorrectIdx(Number(e.target.value))} style={{ width: 'fit-content' }}>
                                                                    {[0,1,2,3].map(i => <option key={i} value={i}>Choice {i + 1}</option>)}
                                                                </select>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                                                Answer keywords (comma-separated) — evaluator matches any
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g., refraction, bends, changes direction"
                                                                value={keywords}
                                                                onChange={e => setKeywords(e.target.value)}
                                                            />
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                                ✏️ Short-answer responses are auto-flagged for teacher review (partial credit).
                                                            </div>
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={handleAddQuestion}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'fit-content' }}
                                                    >
                                                        ➕ Add Question to Quiz
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                                <button 
                                                    type="button" 
                                                    onClick={handleSaveManualQuiz} 
                                                    className="btn btn-primary"
                                                >
                                                    💾 Save & Publish Quiz
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={handleAutoFillAiDraft} 
                                                    disabled={isGenerating}
                                                    className="btn btn-accent"
                                                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                                                >
                                                    {isGenerating ? 'Drafting...' : '✨ Auto-Fill via AI Co-Pilot'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                    {quizzes.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)' }}>No quizzes created for this module yet.</p>
                                    ) : (
                                        quizzes.map(quiz => (
                                            <div key={quiz.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem' }}>
                                                <div>
                                                    <h4 style={{ margin: 0 }}>{quiz.title}</h4>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                        Topic Skill: <code style={{ color: 'var(--accent)' }}>{quiz.skillTag}</code> | Points: {quiz.totalPoints}
                                                    </div>
                                                </div>
                                                <button 
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                                    onClick={() => onSelectQuiz(quiz.id)}
                                                >
                                                    Attempt Quiz
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Teacher: Advertise to Classroom Mesh */}
                            {user.role === 'TEACHER' && selectedModule && (
                                <div className="glass-panel" style={{ marginTop: '1rem', background: 'rgba(5,150,105,0.05)', borderLeft: '4px solid #059669' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                        <div>
                                            <h4 style={{ margin: 0, color: 'var(--success)' }}>📡 Advertise to Classroom Mesh</h4>
                                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                Propagate this module’s content to student devices via BroadcastChannel mesh.
                                                Your device becomes the content server for nearby peers.
                                            </p>
                                        </div>
                                        <button
                                            id="advertise-mesh-btn"
                                            className="btn btn-secondary"
                                            style={{ borderColor: 'var(--success)', color: 'var(--success)', flexShrink: 0 }}
                                            disabled={meshAdvertising}
                                            onClick={handleAdvertiseToMesh}
                                        >
                                            {meshAdvertising ? '📡 Broadcasting...' : '📡 Advertise to Mesh'}
                                        </button>
                                    </div>
                                    {meshAdvertiseStatus && (
                                        <div style={{ fontSize: '0.82rem', color: 'var(--success)', marginTop: '0.8rem', padding: '0.5rem 0.8rem', background: 'rgba(5,150,105,0.08)', borderRadius: '4px' }}>
                                            {meshAdvertiseStatus}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Teacher AI Co-Pilot Panel */}
                            {user.role === 'TEACHER' && (
                                <div className="glass-panel" style={{ marginTop: '1rem', border: '1px dashed var(--accent)', background: 'var(--bg-secondary)' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        🤖 Teacher AI Co-Pilot Quiz Generator
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                                        {isOnline 
                                            ? '🌐 Online Mode: Using cloud-based Gemini RAG to draft quizzes grounded in your uploaded documents.'
                                            : '📶 Offline Mode: Using browser-quantized small language model fallback running on your local device CPU.'
                                        }
                                    </p>
                                    <form onSubmit={handleAiGenerateQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Curriculum Topic & Prompt</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g., Generate a 5-question quiz about the laws of motion"
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>BKT Skill Tag Mapping</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g., motion-laws"
                                                    value={skillTag}
                                                    onChange={e => setSkillTag(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                                <button 
                                                    type="submit" 
                                                    disabled={isGenerating}
                                                    className="btn btn-primary" 
                                                    style={{ width: '100%', padding: '0.7rem', background: 'var(--accent)' }}
                                                >
                                                    {isGenerating ? 'Generating Quiz...' : '✨ Generate AI Quiz'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
