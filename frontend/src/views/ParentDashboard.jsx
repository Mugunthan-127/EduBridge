import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';

// ─── Translation strings (parent-specific) ──────────────────────────────────
const T = {
    en: {
        title: 'Parent Dashboard',
        welcome: 'Welcome,',
        child: 'Monitoring',
        grade: 'Grade',
        attendance: 'Attendance',
        activity: 'Recent Activity',
        marks: 'Quiz Marks',
        mastery: 'Mastery Trends',
        alerts: 'Alerts & Notifications',
        smsGateway: 'SMS Fallback Gateway',
        smsDesc: 'Families without smartphones get automated SMS alerts when your child completes quizzes or misses sessions.',
        sendSms: 'Simulate SMS Alert',
        language: 'Language',
        linkChild: 'Child Account',
        noActivity: 'No recent activity yet.',
        noMarks: 'No quiz attempts recorded yet.',
        appAlert: 'App / Web Alert',
        smsFallback: 'SMS Fallback',
        phone: 'Registered Phone',
        enrolled: 'Enrolled Courses',
        weakTopics: 'Topics Needing Attention',
        strongTopics: 'Strong Topics',
        notifSent: 'Notification sent!',
    },
    ta: {
        title: 'பெற்றோர் டாஷ்போர்டு',
        welcome: 'வரவேற்கிறோம்,',
        child: 'கண்காணிப்பு',
        grade: 'வகுப்பு',
        attendance: 'வருகை',
        activity: 'சமீபத்திய செயல்பாடு',
        marks: 'வினாடி வினா மதிப்பெண்',
        mastery: 'தேர்ச்சி போக்குகள்',
        alerts: 'அறிவிப்புகள்',
        smsGateway: 'SMS இடைவழி நுழைவாயில்',
        smsDesc: 'ஸ்மார்ட்போன் இல்லாத குடும்பங்களுக்கு, உங்கள் குழந்தை வினாடி வினா முடித்தால் SMS அனுப்பப்படும்.',
        sendSms: 'SMS அறிவிப்பை சிமுலேட் செய்',
        language: 'மொழி',
        linkChild: 'குழந்தை கணக்கு',
        noActivity: 'சமீபத்திய செயல்பாடு இல்லை.',
        noMarks: 'வினாடி வினா முயற்சிகள் இல்லை.',
        appAlert: 'ஆப் / இணைய அறிவிப்பு',
        smsFallback: 'SMS திரும்பல்',
        phone: 'பதிவு செய்யப்பட்ட தொலைபேசி',
        enrolled: 'சேர்ந்த பாடங்கள்',
        weakTopics: 'கவனம் தேவைப்படும் தலைப்புகள்',
        strongTopics: 'வலுவான தலைப்புகள்',
        notifSent: 'அறிவிப்பு அனுப்பப்பட்டது!',
    },
    hi: {
        title: 'अभिभावक डैशबोर्ड',
        welcome: 'स्वागत है,',
        child: 'निगरानी',
        grade: 'कक्षा',
        attendance: 'उपस्थिति',
        activity: 'हाल की गतिविधि',
        marks: 'प्रश्नोत्तरी अंक',
        mastery: 'महारत प्रवृत्तियाँ',
        alerts: 'सूचनाएं',
        smsGateway: 'SMS फ़ॉलबैक गेटवे',
        smsDesc: 'बिना स्मार्टफ़ोन वाले परिवारों को स्वचालित SMS अलर्ट मिलते हैं।',
        sendSms: 'SMS अलर्ट सिमुलेट करें',
        language: 'भाषा',
        linkChild: 'बच्चे का खाता',
        noActivity: 'अभी तक कोई गतिविधि नहीं।',
        noMarks: 'अभी तक कोई प्रश्नोत्तरी प्रयास दर्ज नहीं।',
        appAlert: 'ऐप / वेब अलर्ट',
        smsFallback: 'SMS फ़ॉलबैक',
        phone: 'पंजीकृत फ़ोन',
        enrolled: 'नामांकित पाठ्यक्रम',
        weakTopics: 'ध्यान देने वाले विषय',
        strongTopics: 'मजबूत विषय',
        notifSent: 'सूचना भेजी गई!',
    }
};

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
];

// Mock child profile — in production this is fetched from the parent→student FK
const CHILD_PROFILE = {
    name: 'Kirubashankar R.',
    grade: '8',
    enrolledCourses: ['Physics — Optics & Light', 'Mathematics — Algebra I'],
    phone: '+91 98765 43210',
    attendance: 92,
    attendanceTrend: [88, 90, 91, 89, 92, 92, 94],
    attendanceDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
};

// Mastery trend mock (7 days)
const MASTERY_TREND = {
    reflection:  [0.42, 0.50, 0.55, 0.60, 0.65, 0.68, 0.72],
    refraction:  [0.30, 0.32, 0.40, 0.38, 0.45, 0.50, 0.54],
    equations:   [0.70, 0.72, 0.75, 0.74, 0.78, 0.80, 0.83],
    variables:   [0.55, 0.58, 0.60, 0.63, 0.62, 0.65, 0.68],
};
const TREND_DAYS = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];

export default function ParentDashboard({ user, onBack }) {
    const [lang, setLang] = useState('en');
    const [quizHistory, setQuizHistory] = useState([]);
    const [masteries, setMasteries] = useState([]);
    const [smsLogs, setSmsLogs] = useState([]);
    const [appAlerts, setAppAlerts] = useState([]);
    const [notifSent, setNotifSent] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState('reflection');
    const [smsMode, setSmsMode] = useState(false); // false = web/app, true = SMS fallback
    const [registeredPhone, setRegisteredPhone] = useState(user?.parentPhone || CHILD_PROFILE.phone);
    const [showPhoneEdit, setShowPhoneEdit] = useState(false);
    const [phoneInput, setPhoneInput] = useState(registeredPhone);

    const tx = (key) => T[lang]?.[key] || T['en'][key] || key;

    useEffect(() => {
        loadData();
        // Seed initial SMS logs
        setSmsLogs([
            {
                id: 1,
                time: '10:05 AM',
                type: 'ATTENDANCE',
                text: 'EduBridge: Kirubashankar R. joined Optics module offline session.'
            },
            {
                id: 2,
                time: '11:42 AM',
                type: 'ASSESSMENT',
                text: 'EduBridge Alert: Kirubashankar completed the Optics Quiz. Score: 3/3 (100%). Mastery improved to 72%.'
            }
        ]);
        // Seed in-app alerts
        setAppAlerts([
            { id: 1, icon: '📝', msg: 'Quiz completed: Reflection Laws — 90%', time: '11:42 AM', type: 'QUIZ' },
            { id: 2, icon: '📚', msg: 'New assignment posted: Chapter 6 Refraction', time: '09:15 AM', type: 'ASSIGNMENT' },
            { id: 3, icon: '🎯', msg: 'Mastery milestone: equations reached 80%!', time: 'Yesterday', type: 'MILESTONE' },
        ]);
    }, []);

    const loadData = async () => {
        try {
            // Load mastery values from IndexedDB
            const allMastery = await db.mastery.toArray();
            setMasteries(allMastery);

            // Load quiz attempts for the child
            const attempts = await db.quizAttempts.reverse().limit(8).toArray();
            const enriched = await Promise.all(attempts.map(async (a) => {
                const quiz = await db.quizzes.get(a.quizId);
                return {
                    ...a,
                    quizTitle: quiz?.title || `Quiz #${a.quizId}`,
                    percentage: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
                };
            }));
            setQuizHistory(enriched);
        } catch (err) {
            console.error('[ParentDashboard] load error:', err);
        }
    };

    // SMS / app alert simulation
    const handleSimulateAlert = async () => {
        const msg = `EduBridge Fallback: ${CHILD_PROFILE.name} — Device offline 24h. Last BKT mastery: ${
            masteries.length > 0 ? (masteries[0].masteryProbability * 100).toFixed(0) : 72
        }%. ${smsMode ? '[SMS]' : '[WebPush]'}`;

        const newAlert = {
            id: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'SYSTEM_SYNC',
            text: msg
        };

        if (smsMode) {
            setSmsLogs(prev => [newAlert, ...prev]);
        } else {
            setAppAlerts(prev => [
                { id: Date.now(), icon: '🔔', msg: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'SYSTEM' },
                ...prev
            ]);
        }

        await queueSyncItem('/api/notify/parent-alert', 'POST', {
            parentPhone: registeredPhone,
            studentName: CHILD_PROFILE.name,
            message: msg,
            channel: smsMode ? 'SMS' : 'APP',
        });

        setNotifSent(true);
        setTimeout(() => setNotifSent(false), 3000);
    };

    const handleSavePhone = () => {
        setRegisteredPhone(phoneInput);
        setShowPhoneEdit(false);
    };

    const masteryColor = (v) => v >= 0.75 ? '#10b981' : v >= 0.5 ? '#f59e0b' : '#ef4444';

    // Trend sparkline (SVG)
    const Sparkline = ({ data, color }) => {
        const max = Math.max(...data);
        const min = Math.min(...data) - 0.05;
        const w = 200, h = 50;
        const pts = data.map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / (max - min)) * h;
            return `${x},${y}`;
        }).join(' ');
        return (
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" points={pts} />
                {data.map((v, i) => {
                    const x = (i / (data.length - 1)) * w;
                    const y = h - ((v - min) / (max - min)) * h;
                    return i === data.length - 1
                        ? <circle key={i} cx={x} cy={y} r="4" fill={color} />
                        : null;
                })}
            </svg>
        );
    };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onBack} className="btn btn-secondary">← Back</button>
                    <div>
                        <h2 style={{ margin: 0 }}>👪 {tx('title')}</h2>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {tx('welcome')} <b style={{ color: 'var(--text-primary)' }}>{user?.fullName || 'Parent'}</b>
                        </p>
                    </div>
                </div>

                {/* ── Language Switcher ───────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx('language')}:</span>
                    {LANGUAGES.map(l => (
                        <button
                            key={l.code}
                            id={`lang-${l.code}`}
                            onClick={() => setLang(l.code)}
                            style={{
                                padding: '0.3rem 0.7rem',
                                borderRadius: '6px',
                                border: `1px solid ${lang === l.code ? 'var(--primary)' : 'var(--border-color)'}`,
                                background: lang === l.code ? 'var(--primary-light)' : 'var(--bg-secondary)',
                                color: lang === l.code ? 'var(--primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: lang === l.code ? '600' : '400',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {l.flag} {l.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Child Registration Banner ──────────────────────────────── */}
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #7c3aed' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tx('linkChild')}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                        {CHILD_PROFILE.name} · {tx('grade')} {CHILD_PROFILE.grade}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {tx('phone')}: <b>{registeredPhone}</b>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {CHILD_PROFILE.enrolledCourses.map((c, i) => (
                        <span key={i} className="badge-pill badge-info" style={{ fontSize: '0.75rem' }}>{c}</span>
                    ))}
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                        onClick={() => setShowPhoneEdit(v => !v)}
                    >
                        ✏️ Edit Phone
                    </button>
                </div>
            </div>

            {/* Phone edit form */}
            {showPhoneEdit && (
                <div className="glass-panel animated-fade-in" style={{ padding: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', borderLeft: '3px solid var(--primary)' }}>
                    <input
                        value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        placeholder="+91 98765 43210"
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={handleSavePhone}>Save</button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 0.8rem' }} onClick={() => setShowPhoneEdit(false)}>✕</button>
                </div>
            )}

            {/* ── Main 3-Column Grid ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* Column 1: Attendance + Activity ──────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                    {/* Attendance */}
                    <div className="glass-panel" style={{ borderTop: '4px solid #10b981' }}>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📅 {tx('attendance')}</span>
                            <span style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981' }}>
                                {CHILD_PROFILE.attendance}%
                            </span>
                        </h4>

                        {/* Bar chart for attendance trend */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '48px', marginBottom: '0.5rem' }}>
                            {CHILD_PROFILE.attendanceTrend.map((v, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <div style={{
                                        width: '100%',
                                        height: `${(v / 100) * 42}px`,
                                        background: i === CHILD_PROFILE.attendanceTrend.length - 1
                                            ? 'var(--primary)'
                                            : 'rgba(16,185,129,0.45)',
                                        borderRadius: '3px 3px 0 0',
                                        transition: 'height 0.4s ease'
                                    }} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {CHILD_PROFILE.attendanceDays.map((d, i) => (
                                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d}</div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="glass-panel">
                        <h4 style={{ marginBottom: '1rem' }}>⚡ {tx('activity')}</h4>
                        {appAlerts.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{tx('noActivity')}</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                                {appAlerts.slice(0, 5).map(alert => (
                                    <div key={alert.id} style={{
                                        display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
                                        padding: '0.6rem 0.8rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{alert.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{alert.msg}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{alert.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Mastery Trends ──────────────────────────────── */}
                <div className="glass-panel" style={{ borderTop: '4px solid #7c3aed' }}>
                    <h4 style={{ marginBottom: '0.4rem' }}>📈 {tx('mastery')}</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                        7-day learning trajectory per skill topic (BKT)
                    </p>

                    {/* Skill selector */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                        {Object.keys(MASTERY_TREND).map(skill => (
                            <button
                                key={skill}
                                onClick={() => setSelectedSkill(skill)}
                                style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '999px',
                                    border: `1px solid ${selectedSkill === skill ? masteryColor(MASTERY_TREND[skill][6]) : 'var(--border-color)'}`,
                                    background: selectedSkill === skill ? `${masteryColor(MASTERY_TREND[skill][6])}22` : 'var(--bg-secondary)',
                                    color: selectedSkill === skill ? masteryColor(MASTERY_TREND[skill][6]) : 'var(--text-muted)',
                                    cursor: 'pointer', fontSize: '0.78rem', textTransform: 'capitalize', fontWeight: selectedSkill === skill ? '600' : '400'
                                }}
                            >
                                {skill}
                            </button>
                        ))}
                    </div>

                    {/* Sparkline for selected skill */}
                    <div style={{ marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{selectedSkill}</span>
                            <span style={{ fontWeight: '700', color: masteryColor(MASTERY_TREND[selectedSkill][6]), fontSize: '1.1rem' }}>
                                {(MASTERY_TREND[selectedSkill][6] * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div style={{ width: '100%', overflow: 'hidden' }}>
                            <Sparkline data={MASTERY_TREND[selectedSkill]} color={masteryColor(MASTERY_TREND[selectedSkill][6])} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                            {TREND_DAYS.map((d, i) => (
                                <span key={i} style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d}</span>
                            ))}
                        </div>
                    </div>

                    {/* All skills summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.2rem' }}>
                        {Object.entries(MASTERY_TREND).map(([skill, vals]) => {
                            const current = vals[6];
                            const prev = vals[5];
                            const delta = current - prev;
                            const color = masteryColor(current);
                            return (
                                <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <span style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize', flexShrink: 0 }}>{skill}</span>
                                    <div style={{ flex: 1, height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${current * 100}%`, height: '100%', background: color, transition: 'width 0.6s ease', borderRadius: '3px' }} />
                                    </div>
                                    <span style={{ width: '36px', fontSize: '0.78rem', fontWeight: '600', color, textAlign: 'right' }}>
                                        {(current * 100).toFixed(0)}%
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: delta >= 0 ? 'var(--success)' : 'var(--danger)', width: '28px', textAlign: 'right' }}>
                                        {delta >= 0 ? '▲' : '▼'}{Math.abs(delta * 100).toFixed(0)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Weak / strong topic labels */}
                    <div style={{ marginTop: '1.2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                        <div style={{ padding: '0.7rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                            <div style={{ color: 'var(--danger)', fontWeight: '600', marginBottom: '0.3rem' }}>⚠️ {tx('weakTopics')}</div>
                            {Object.entries(MASTERY_TREND).filter(([, v]) => v[6] < 0.6).map(([s]) => (
                                <div key={s} style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>· {s}</div>
                            ))}
                        </div>
                        <div style={{ padding: '0.7rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                            <div style={{ color: 'var(--success)', fontWeight: '600', marginBottom: '0.3rem' }}>✅ {tx('strongTopics')}</div>
                            {Object.entries(MASTERY_TREND).filter(([, v]) => v[6] >= 0.6).map(([s]) => (
                                <div key={s} style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>· {s}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Column 3: Marks + Alerts ──────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                    {/* Quiz Marks History */}
                    <div className="glass-panel" style={{ borderTop: '4px solid #3b82f6' }}>
                        <h4 style={{ marginBottom: '1rem' }}>📋 {tx('marks')}</h4>
                        {quizHistory.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{tx('noMarks')}</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {quizHistory.map(a => {
                                    const pColor = a.percentage >= 75 ? '#10b981' : a.percentage >= 50 ? '#f59e0b' : '#ef4444';
                                    return (
                                        <div key={a.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.65rem 0.9rem',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', fontWeight: '500' }}>{a.quizTitle}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                    {new Date(a.attemptTimestamp || Date.now()).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '700', color: pColor, fontSize: '1rem' }}>{a.percentage}%</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.score}/{a.maxScore}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Alerts Panel ─ App / web + SMS fallback ──────────── */}
                    <div className="glass-panel" style={{ borderTop: '4px solid #8b5cf6' }}>
                        <h4 style={{ marginBottom: '0.8rem' }}>🔔 {tx('alerts')}</h4>

                        {/* Alert channel toggle */}
                        <div style={{
                            display: 'flex',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1rem',
                            fontSize: '0.82rem'
                        }}>
                            <button
                                id="alert-app"
                                onClick={() => setSmsMode(false)}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer',
                                    background: !smsMode ? 'var(--primary-light)' : 'var(--bg-secondary)',
                                    color: !smsMode ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: !smsMode ? '600' : '400',
                                    transition: 'all 0.15s'
                                }}
                            >
                                📱 {tx('appAlert')}
                            </button>
                            <button
                                id="alert-sms"
                                onClick={() => setSmsMode(true)}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer',
                                    background: smsMode ? 'var(--accent-light)' : 'var(--bg-secondary)',
                                    color: smsMode ? 'var(--accent)' : 'var(--text-muted)',
                                    fontWeight: smsMode ? '600' : '400',
                                    transition: 'all 0.15s'
                                }}
                            >
                                💬 {tx('smsFallback')}
                            </button>
                        </div>

                        {smsMode ? (
                            <>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    {tx('smsDesc')}
                                </p>
                                {/* SMS gateway terminal */}
                                <div style={{
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                    borderRadius: '8px', padding: '0.8rem', height: '160px', overflowY: 'auto'
                                }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--success)', marginBottom: '0.6rem', letterSpacing: '1px' }}>
                                        --- CELLULAR GATEWAY LOGS ---
                                    </div>
                                    {smsLogs.map(log => (
                                        <div key={log.id} style={{ marginBottom: '0.8rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                                <span>[{log.type}]</span>
                                                <span>{log.time}</span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', background: 'var(--primary-light)', padding: '0.4rem 0.6rem', borderRadius: '4px', borderLeft: '2px solid var(--primary)' }}>
                                                {log.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                {appAlerts.slice(0, 4).map(a => (
                                    <div key={a.id} style={{
                                        padding: '0.6rem 0.8rem',
                                        background: 'var(--primary-light)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        display: 'flex', gap: '0.6rem', alignItems: 'flex-start'
                                    }}>
                                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{a.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{a.msg}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{a.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Trigger button */}
                        <button
                            id="simulate-alert-btn"
                            className="btn btn-secondary"
                            onClick={handleSimulateAlert}
                            style={{ width: '100%', marginTop: '1rem', borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: '0.83rem' }}
                        >
                            {smsMode ? `💬 ${tx('sendSms')}` : `🔔 Trigger App Alert`}
                        </button>

                        {notifSent && (
                            <div style={{ marginTop: '0.6rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--success)', fontWeight: '600' }}>
                                ✓ {tx('notifSent')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
