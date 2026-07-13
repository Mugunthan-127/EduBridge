import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';

/**
 * TeacherCourseManager — Teacher workflow Steps 2 & 3 (Advertise to Mesh handled in CourseDetail)
 *
 * Covers:
 *  - Create course (title, subject, grade, description)
 *  - Add modules to a course
 *  - Upload/add content items (PDF URL, video URL, notes, images) per module
 *  - Saves everything to IndexedDB + queues server sync
 */
export default function TeacherCourseManager({ user, onBack, onOpenCourse }) {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState(null);
    const [contents, setContents] = useState([]);

    // Create course form
    const [showCourseForm, setShowCourseForm] = useState(false);
    const [courseTitle, setCourseTitle] = useState('');
    const [courseSubject, setCourseSubject] = useState('Science');
    const [courseGrade, setCourseGrade] = useState('8');
    const [courseDesc, setCourseDesc] = useState('');

    // Add module form
    const [showModuleForm, setShowModuleForm] = useState(false);
    const [moduleTitle, setModuleTitle] = useState('');
    const [moduleDesc, setModuleDesc] = useState('');

    // Add content form
    const [showContentForm, setShowContentForm] = useState(false);
    const [contentTitle, setContentTitle] = useState('');
    const [contentType, setContentType] = useState('PDF');
    const [contentUrl, setContentUrl] = useState('');
    const [contentSkillTag, setContentSkillTag] = useState('');
    const [contentSize, setContentSize] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        const all = await db.courses.where({ tenantId: user.tenantId }).toArray();
        setCourses(all);
    };

    const loadModules = async (course) => {
        setSelectedCourse(course);
        setSelectedModule(null);
        setContents([]);
        const mods = await db.modules
            .where({ courseId: course.id })
            .sortBy('sequenceOrder');
        setModules(mods);
    };

    const loadContents = async (module) => {
        setSelectedModule(module);
        const items = await db.content.where({ moduleId: module.id }).toArray();
        setContents(items);
    };

    // ── Create Course ────────────────────────────────────────────────────────
    const handleCreateCourse = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const course = {
                title: courseTitle,
                subject: courseSubject,
                grade: Number(courseGrade),
                description: courseDesc,
                tenantId: user.tenantId,
                createdBy: user.userId,
                createdAt: Date.now()
            };
            const id = await db.courses.add(course);
            course.id = id;
            await queueSyncItem('/api/courses', 'POST', course);

            setCourseTitle(''); setCourseSubject('Science'); setCourseGrade('8'); setCourseDesc('');
            setShowCourseForm(false);
            await loadCourses();
            await loadModules(course);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Add Module ───────────────────────────────────────────────────────────
    const handleAddModule = async (e) => {
        e.preventDefault();
        if (!selectedCourse) return;
        setIsSaving(true);
        try {
            const module = {
                courseId: selectedCourse.id,
                title: moduleTitle,
                description: moduleDesc,
                sequenceOrder: modules.length + 1
            };
            const id = await db.modules.add(module);
            module.id = id;
            await queueSyncItem('/api/modules', 'POST', module);

            setModuleTitle(''); setModuleDesc('');
            setShowModuleForm(false);
            await loadModules(selectedCourse);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Add Content Item ─────────────────────────────────────────────────────
    const handleAddContent = async (e) => {
        e.preventDefault();
        if (!selectedModule) return;
        setIsSaving(true);
        try {
            const item = {
                moduleId: selectedModule.id,
                title: contentTitle,
                contentType: contentType,
                fileUrl: contentUrl,
                skillTag: contentSkillTag,
                fileSizeBytes: Number(contentSize) * 1024 * 1024 || 1048576,
                localDownloaded: false,
                sha256Verified: false
            };
            const id = await db.content.add(item);
            item.id = id;
            await queueSyncItem('/api/content', 'POST', item);

            setContentTitle(''); setContentUrl(''); setContentSkillTag(''); setContentSize('');
            setContentType('PDF'); setShowContentForm(false);
            await loadContents(selectedModule);
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const CONTENT_TYPE_ICONS = { PDF: '📄', VIDEO: '🎥', NOTES: '📝', IMAGE: '🖼️' };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0 }}>📚 Course & Material Manager</h2>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
                        Create courses, add modules, upload PDFs · videos · notes · images
                    </p>
                </div>
                <button
                    id="create-course-btn"
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                    onClick={() => setShowCourseForm(v => !v)}
                >
                    {showCourseForm ? '✕ Cancel' : '➕ New Course'}
                </button>
            </div>

            {/* Create Course Form */}
            {showCourseForm && (
                <div className="glass-panel animated-fade-in" style={{ borderLeft: '4px solid #059669' }}>
                    <h3>🆕 Create New Course</h3>
                    <form onSubmit={handleCreateCourse} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={lbl}>Course Title *</label>
                            <input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g., Physics — Optics & Light" required />
                        </div>
                        <div>
                            <label style={lbl}>Subject *</label>
                            <select value={courseSubject} onChange={e => setCourseSubject(e.target.value)} style={sel}>
                                {['Science', 'Mathematics', 'English', 'Social Studies', 'Tamil', 'Computer Science'].map(s => (
                                    <option key={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={lbl}>Grade *</label>
                            <select value={courseGrade} onChange={e => setCourseGrade(e.target.value)} style={sel}>
                                {['6','7','8','9','10','11','12'].map(g => (
                                    <option key={g} value={g}>Grade {g}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={lbl}>Description</label>
                            <input value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="Brief overview for students" />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                {isSaving ? 'Saving...' : '💾 Create Course & Start Adding Modules'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Three-column workspace */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1.4fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* Column 1: Courses List */}
                <div>
                    <h4 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: '0.8rem' }}>
                        Your Courses
                    </h4>
                    {courses.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No courses yet.<br />Create your first course above.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {courses.map(c => (
                                <div
                                    key={c.id}
                                    className="glass-panel"
                                    onClick={() => loadModules(c)}
                                    style={{
                                        padding: '0.8rem 1rem',
                                        cursor: 'pointer',
                                        borderLeft: selectedCourse?.id === c.id ? '3px solid var(--primary)' : '3px solid transparent',
                                        background: selectedCourse?.id === c.id ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)'
                                    }}
                                >
                                    <div style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{c.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        {c.subject} · Gr {c.grade}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedCourse && (
                        <button
                            className="btn btn-secondary"
                            style={{ width: '100%', marginTop: '1rem', fontSize: '0.8rem', padding: '0.4rem' }}
                            onClick={() => onOpenCourse?.(selectedCourse.id)}
                        >
                            📖 Open Full Course View →
                        </button>
                    )}
                </div>

                {/* Column 2: Modules */}
                <div>
                    {selectedCourse ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                <h4 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em', margin: 0 }}>
                                    Modules — {selectedCourse.title}
                                </h4>
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                                    onClick={() => setShowModuleForm(v => !v)}
                                >
                                    {showModuleForm ? '✕' : '+ Module'}
                                </button>
                            </div>

                            {showModuleForm && (
                                <form onSubmit={handleAddModule} className="glass-panel animated-fade-in"
                                    style={{ padding: '1rem', borderLeft: '3px solid var(--primary)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                    <input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="Module title *" required />
                                    <input value={moduleDesc} onChange={e => setModuleDesc(e.target.value)} placeholder="Short description" />
                                    <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem', fontSize: '0.8rem' }} disabled={isSaving}>
                                        {isSaving ? '...' : '+ Add Module'}
                                    </button>
                                </form>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {modules.map(m => (
                                    <div
                                        key={m.id}
                                        className="glass-panel"
                                        onClick={() => loadContents(m)}
                                        style={{
                                            padding: '0.8rem 1rem', cursor: 'pointer',
                                            borderLeft: selectedModule?.id === m.id ? '3px solid var(--accent)' : '3px solid transparent',
                                            background: selectedModule?.id === m.id ? 'rgba(139,92,246,0.08)' : 'var(--bg-card)'
                                        }}
                                    >
                                        <div style={{ fontWeight: '500', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                            {m.sequenceOrder}. {m.title}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.description}</div>
                                    </div>
                                ))}
                                {modules.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                                        No modules yet — add your first module above.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            ← Select a course to manage its modules
                        </div>
                    )}
                </div>

                {/* Column 3: Content Items */}
                <div>
                    {selectedModule ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                <h4 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.08em', margin: 0 }}>
                                    Materials — {selectedModule.title}
                                </h4>
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                                    onClick={() => setShowContentForm(v => !v)}
                                >
                                    {showContentForm ? '✕' : '+ Upload Material'}
                                </button>
                            </div>

                            {/* Add Content Form */}
                            {showContentForm && (
                                <form onSubmit={handleAddContent} className="glass-panel animated-fade-in"
                                    style={{ padding: '1.2rem', borderLeft: '3px solid #f59e0b', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={lbl}>Material Title *</label>
                                        <input value={contentTitle} onChange={e => setContentTitle(e.target.value)} placeholder="e.g., Reflection Laws — Lecture Notes" required />
                                    </div>
                                    <div>
                                        <label style={lbl}>Type *</label>
                                        <select value={contentType} onChange={e => setContentType(e.target.value)} style={sel}>
                                            {['PDF', 'VIDEO', 'NOTES', 'IMAGE'].map(t => (
                                                <option key={t} value={t}>{CONTENT_TYPE_ICONS[t]} {t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={lbl}>BKT Skill Tag *</label>
                                        <input value={contentSkillTag} onChange={e => setContentSkillTag(e.target.value)} placeholder="e.g., reflection" required />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={lbl}>File URL / Storage Path</label>
                                        <input value={contentUrl} onChange={e => setContentUrl(e.target.value)}
                                            placeholder={contentType === 'VIDEO' ? 'https://cdn.example.com/video.mp4' : 'https://storage.example.com/file.pdf'} />
                                    </div>
                                    <div>
                                        <label style={lbl}>File Size (MB)</label>
                                        <input type="number" min="0" step="0.1" value={contentSize} onChange={e => setContentSize(e.target.value)} placeholder="e.g., 12.5" />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSaving}>
                                            {isSaving ? 'Saving...' : '📤 Add Material'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Content List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {contents.map(item => (
                                    <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.1rem' }}>{CONTENT_TYPE_ICONS[item.contentType] || '📁'}</span>
                                                <span style={{ fontWeight: '500', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.title}</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                <code style={{ color: 'var(--accent)' }}>{item.skillTag}</code>
                                                {' · '}{(item.fileSizeBytes / 1048576).toFixed(1)} MB
                                                {item.fileUrl && <span> · <a href={item.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Link ↗</a></span>}
                                            </div>
                                        </div>
                                        <span className={item.localDownloaded ? 'badge-success badge-pill' : 'badge-pill'} style={{ fontSize: '0.7rem' }}>
                                            {item.localDownloaded ? '💾 Cached' : '☁️ Remote'}
                                        </span>
                                    </div>
                                ))}
                                {contents.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                                        No materials yet — add PDFs, videos, notes or images above.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            ← Select a module to manage its materials
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Shared style helpers
const lbl = { display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' };
const sel = { width: '100%', padding: '0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' };
