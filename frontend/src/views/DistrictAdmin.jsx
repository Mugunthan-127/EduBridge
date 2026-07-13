import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';

// ─── Static district data ─────────────────────────────────────────────────────
const CLUSTERS = [
    {
        id: 'cluster-a', name: 'Cluster A — Rural East',
        schools: [
            { id: 'sch-a1', name: 'GHS Periyapalayam', students: 312, tablets: 48, syncPct: 95, status: 'active' },
            { id: 'sch-a2', name: 'GHS Thiruporur',    students: 274, tablets: 36, syncPct: 91, status: 'active' },
            { id: 'sch-a3', name: 'PUMS Koovathur',    students: 198, tablets: 22, syncPct: 78, status: 'limited' },
            { id: 'sch-a4', name: 'GHS Madurantakam',  students: 289, tablets: 32, syncPct: 88, status: 'active' },
        ]
    },
    {
        id: 'cluster-b', name: 'Cluster B — Mountain Tribal',
        schools: [
            { id: 'sch-b1', name: 'GHS Yercaud Hills',    students: 210, tablets: 20, syncPct: 62, status: 'limited' },
            { id: 'sch-b2', name: 'PUPS Sitheri Village',  students: 145, tablets: 10, syncPct: 45, status: 'offline' },
            { id: 'sch-b3', name: 'GHS Shervaroyan',       students: 188, tablets: 18, syncPct: 70, status: 'limited' },
        ]
    },
    {
        id: 'cluster-c', name: 'Cluster C — Delta Coastal',
        schools: [
            { id: 'sch-c1', name: 'GHS Nagapattinam',  students: 340, tablets: 60, syncPct: 98, status: 'active' },
            { id: 'sch-c2', name: 'GHS Velankanni',    students: 290, tablets: 52, syncPct: 96, status: 'active' },
            { id: 'sch-c3', name: 'PUMS Tranquebar',   students: 180, tablets: 28, syncPct: 89, status: 'active' },
            { id: 'sch-c4', name: 'GHS Karaikal North',students: 220, tablets: 40, syncPct: 94, status: 'active' },
            { id: 'sch-c5', name: 'PUMS Sirkazhi',     students: 155, tablets: 20, syncPct: 82, status: 'limited' },
        ]
    },
];

// Aggregated analytics per cluster
const ANALYTICS = {
    'cluster-a': { avgMastery: 0.67, quizzesTaken: 1540, weakSkill: 'refraction',   strongSkill: 'equations',   contentCoverage: 82 },
    'cluster-b': { avgMastery: 0.52, quizzesTaken:  830, weakSkill: 'variables',    strongSkill: 'reflection',  contentCoverage: 61 },
    'cluster-c': { avgMastery: 0.74, quizzesTaken: 2210, weakSkill: 'equations',    strongSkill: 'reflection',  contentCoverage: 91 },
};

// Rollout / licensing table
const ROLLOUT_PLANS = [
    { cluster: 'Cluster A — Rural East',     plan: 'Free Tier',   seats: 1073, licensed: 1073, expires: 'N/A',        status: 'free' },
    { cluster: 'Cluster B — Mountain Tribal',plan: 'Govt Pilot',  seats:  543, licensed:  543, expires: '2027-03-31', status: 'pilot' },
    { cluster: 'Cluster C — Delta Coastal',  plan: 'NGO Funded',  seats: 1185, licensed: 1185, expires: '2026-12-31', status: 'active' },
];

const STATUS_COLORS = { active: '#10b981', limited: '#f59e0b', offline: '#ef4444', free: '#3b82f6', pilot: '#f59e0b' };

const TABS = ['tenant', 'content', 'analytics', 'rollout'];
const TAB_LABELS = {
    tenant:    '🏫 Tenant Hierarchy',
    content:   '📦 Curate & Distribute',
    analytics: '📊 Aggregated Analytics',
    rollout:   '⚙️ Rollout & Scaling',
};

export default function DistrictAdmin({ onBack }) {
    const [activeTab, setActiveTab] = useState('tenant');

    // Tenant tab
    const [expandedCluster, setExpandedCluster] = useState('cluster-a');
    const [showAddSchool, setShowAddSchool] = useState(false);
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolCluster, setNewSchoolCluster] = useState('cluster-a');
    const [schoolSaved, setSchoolSaved] = useState(false);

    // Content tab
    const [packTitle, setPackTitle]         = useState('');
    const [packSubject, setPackSubject]     = useState('Science');
    const [packGrade, setPackGrade]         = useState('8');
    const [packDesc, setPackDesc]           = useState('');
    const [targetScope, setTargetScope]     = useState('all');
    const [distributing, setDistributing]   = useState(false);
    const [distributedPacks, setDistributedPacks] = useState([]);

    // Analytics tab
    const [analyticsCluster, setAnalyticsCluster] = useState('cluster-a');

    // Rollout tab
    const [expandPlan, setExpandPlan] = useState(null);

    // KPIs
    const totalStudents = CLUSTERS.flatMap(c => c.schools).reduce((a, s) => a + s.students, 0);
    const totalSchools  = CLUSTERS.flatMap(c => c.schools).length;
    const avgSync       = Math.round(CLUSTERS.flatMap(c => c.schools).reduce((a, s) => a + s.syncPct, 0) / totalSchools);

    // ── Actions ─────────────────────────────────────────────────────────────

    const handleAddSchool = async (e) => {
        e.preventDefault();
        if (!newSchoolName.trim()) return;

        const school = {
            name: newSchoolName,
            clusterId: newSchoolCluster,
            tenantId: `${newSchoolCluster}-${Date.now()}`,
            createdAt: Date.now(),
        };
        await queueSyncItem('/api/admin/schools', 'POST', school);

        setNewSchoolName('');
        setShowAddSchool(false);
        setSchoolSaved(true);
        setTimeout(() => setSchoolSaved(false), 3000);
    };

    const handleDistributePack = async (e) => {
        e.preventDefault();
        setDistributing(true);

        const scope = targetScope === 'all'
            ? CLUSTERS.map(c => c.id)
            : [targetScope];

        const pack = {
            title: packTitle,
            subject: packSubject,
            grade: packGrade,
            description: packDesc,
            targetClusters: scope,
            distributedAt: Date.now(),
        };

        // Save locally + queue for each target cluster tenant
        for (const clusterId of scope) {
            const course = { ...pack, tenantId: clusterId };
            const savedId = await db.courses.add(course);
            course.id = savedId;
            await queueSyncItem('/api/admin/distribute-pack', 'POST', course);
        }

        setDistributedPacks(prev => [pack, ...prev]);
        setPackTitle(''); setPackDesc('');
        setDistributing(false);
    };

    const masteryColor = (v) => v >= 0.7 ? '#10b981' : v >= 0.5 ? '#f59e0b' : '#ef4444';

    const syncBadgeStyle = (pct) => ({
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: '600',
        background: pct >= 90 ? 'rgba(16,185,129,0.15)' : pct >= 70 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
        color: pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444',
    });

    const sel = {
        width: '100%', padding: '0.6rem',
        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
        border: '1px solid var(--border-color)', borderRadius: '4px'
    };
    const lbl = { display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0 }}>🏢 District / Cluster Administration Portal</h2>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Manage tenant hierarchy · curate content · track district-wide mastery · control rollout & licensing
                    </p>
                </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                    { label: 'TOTAL STUDENTS',    value: totalStudents.toLocaleString(), sub: `Across ${CLUSTERS.length} clusters`, color: 'var(--primary)' },
                    { label: 'REGISTERED SCHOOLS', value: totalSchools, sub: 'Row-level tenant isolation', color: '#8b5cf6' },
                    { label: 'AVG MESH SYNC',      value: `${avgSync}%`, sub: 'Peer transfer coverage', color: 'var(--success)' },
                    { label: 'CONTENT PACKS SENT', value: distributedPacks.length + 3, sub: 'District curriculum packs', color: '#f59e0b' },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem 1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
                        <div style={{ fontSize: '2.1rem', fontWeight: '800', color: kpi.color, margin: '0.3rem 0 0.1rem' }}>{kpi.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Tab Navigation ────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        id={`tab-${tab}`}
                        onClick={() => setActiveTab(tab)}
                        className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TAB 1 — Tenant Hierarchy
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'tenant' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>School Clusters & Tenant Registry</h3>
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Each school is a tenant with row-level data isolation. Expand a cluster to see its schools.
                            </p>
                        </div>
                        <button
                            id="add-school-btn"
                            className="btn btn-primary"
                            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                            onClick={() => setShowAddSchool(v => !v)}
                        >
                            {showAddSchool ? '✕ Cancel' : '➕ Add School'}
                        </button>
                    </div>

                    {/* Add school form */}
                    {showAddSchool && (
                        <form onSubmit={handleAddSchool} className="glass-panel animated-fade-in"
                            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end', borderLeft: '4px solid #059669' }}>
                            <div>
                                <label style={lbl}>School Name *</label>
                                <input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="e.g., GHS Velankanni North" required />
                            </div>
                            <div>
                                <label style={lbl}>Assign to Cluster</label>
                                <select value={newSchoolCluster} onChange={e => setNewSchoolCluster(e.target.value)} style={sel}>
                                    {CLUSTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ height: 'fit-content' }}>
                                + Register School
                            </button>
                        </form>
                    )}

                    {schoolSaved && (
                        <div style={{ padding: '0.8rem 1.2rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.85rem', color: 'var(--success)' }}>
                            ✅ School registered and queued for district sync.
                        </div>
                    )}

                    {/* Cluster accordion */}
                    {CLUSTERS.map(cluster => (
                        <div key={cluster.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* Cluster header */}
                            <button
                                onClick={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
                                style={{
                                    width: '100%', padding: '1rem 1.5rem',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
                                    borderBottom: expandedCluster === cluster.id ? '1px solid var(--border-color)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>🏘️</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '600', fontSize: '1rem' }}>{cluster.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                            {cluster.schools.length} schools ·{' '}
                                            {cluster.schools.reduce((a, s) => a + s.students, 0).toLocaleString()} students ·{' '}
                                            {cluster.schools.reduce((a, s) => a + s.tablets, 0)} tablets
                                        </div>
                                    </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {expandedCluster === cluster.id ? '▲' : '▼'}
                                </span>
                            </button>

                            {/* Schools table */}
                            {expandedCluster === cluster.id && (
                                <div style={{ padding: '0 1.5rem 1.2rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0', marginTop: '1rem' }}>
                                        {/* Header row */}
                                        {['School Name', 'Students', 'Tablets', 'Sync %', 'Status'].map(h => (
                                            <div key={h} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                {h}
                                            </div>
                                        ))}
                                        {/* Data rows */}
                                        {cluster.schools.map(school => (
                                            <React.Fragment key={school.id}>
                                                <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{school.name}</div>
                                                <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{school.students}</div>
                                                <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{school.tablets}</div>
                                                <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                                    <div style={{ width: '80px', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
                                                        <div style={{ width: `${school.syncPct}%`, height: '100%', background: school.syncPct >= 90 ? '#10b981' : school.syncPct >= 70 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{school.syncPct}%</span>
                                                </div>
                                                <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                                    <span style={{ ...syncBadgeStyle(school.syncPct), textTransform: 'capitalize' }}>
                                                        {school.status}
                                                    </span>
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 2 — Curate & Distribute Content
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'content' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                    {/* Distribution form */}
                    <div className="glass-panel" style={{ borderTop: '4px solid #7c3aed' }}>
                        <h3>📦 Distribute Content Pack</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                            Create a curriculum pack and push it to one or all clusters. Each school's devices receive it via background sync + Local Content Mesh.
                        </p>
                        <form onSubmit={handleDistributePack} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={lbl}>Pack Title *</label>
                                <input value={packTitle} onChange={e => setPackTitle(e.target.value)} placeholder="e.g., Grade 8 Algebra Foundation Pack" required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={lbl}>Subject</label>
                                    <select value={packSubject} onChange={e => setPackSubject(e.target.value)} style={sel}>
                                        {['Science', 'Mathematics', 'English', 'Social Studies', 'Tamil', 'Computer Science'].map(s => (
                                            <option key={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>Grade</label>
                                    <select value={packGrade} onChange={e => setPackGrade(e.target.value)} style={sel}>
                                        {['6','7','8','9','10','11','12'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>Target Scope</label>
                                <select value={targetScope} onChange={e => setTargetScope(e.target.value)} style={sel}>
                                    <option value="all">🌐 All Clusters (District-wide)</option>
                                    {CLUSTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Pack Notes & Curriculum Alignment</label>
                                <textarea
                                    rows={3} value={packDesc} onChange={e => setPackDesc(e.target.value)}
                                    placeholder="Syllabus alignment, assessment schedule, worksheet references..."
                                    required
                                    style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={distributing} style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', border: 'none' }}>
                                {distributing ? '📡 Distributing...' : '🚀 Distribute Pack to Schools'}
                            </button>
                        </form>
                    </div>

                    {/* Distribution log */}
                    <div>
                        <div className="glass-panel" style={{ borderTop: '4px solid #059669', marginBottom: '1.2rem' }}>
                            <h4>📋 Distribution Log</h4>
                            {distributedPacks.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>No packs distributed this session.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
                                    {distributedPacks.map((p, i) => (
                                        <div key={i} style={{ padding: '0.7rem 1rem', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.83rem' }}>
                                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.title}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                                {p.subject} · Grade {p.grade} ·{' '}
                                                {p.targetClusters.length === CLUSTERS.length ? 'All clusters' : p.targetClusters.join(', ')}
                                            </div>
                                            <div style={{ color: 'var(--success)', fontSize: '0.72rem', marginTop: '0.1rem' }}>✓ Queued for sync</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cluster sync health */}
                        <div className="glass-panel">
                            <h4 style={{ marginBottom: '1rem' }}>📡 Cluster Sync Health</h4>
                            {CLUSTERS.map(c => {
                                const avgSyncPct = Math.round(c.schools.reduce((a, s) => a + s.syncPct, 0) / c.schools.length);
                                return (
                                    <div key={c.id} style={{ marginBottom: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                            <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.83rem', fontWeight: '600', color: avgSyncPct >= 85 ? '#10b981' : '#f59e0b' }}>{avgSyncPct}%</span>
                                        </div>
                                        <div style={{ height: '7px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${avgSyncPct}%`, height: '100%', background: avgSyncPct >= 85 ? '#10b981' : '#f59e0b', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 3 — Aggregated Analytics
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Cluster selector */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {CLUSTERS.map(c => (
                            <button key={c.id} onClick={() => setAnalyticsCluster(c.id)}
                                className={`btn ${analyticsCluster === c.id ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {/* Cluster KPIs */}
                    {(() => {
                        const a = ANALYTICS[analyticsCluster];
                        const cluster = CLUSTERS.find(c => c.id === analyticsCluster);
                        const totalStudentsInCluster = cluster.schools.reduce((s, sc) => s + sc.students, 0);

                        return (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    {[
                                        { label: 'AVG MASTERY', value: `${(a.avgMastery * 100).toFixed(0)}%`, color: masteryColor(a.avgMastery) },
                                        { label: 'QUIZZES TAKEN', value: a.quizzesTaken.toLocaleString(), color: 'var(--primary)' },
                                        { label: 'CONTENT COVERAGE', value: `${a.contentCoverage}%`, color: '#8b5cf6' },
                                        { label: 'STUDENTS', value: totalStudentsInCluster.toLocaleString(), color: 'var(--text-secondary)' },
                                    ].map(k => (
                                        <div key={k.label} className="glass-panel" style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                                            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: k.color, marginTop: '0.3rem' }}>{k.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    {/* Per-school mastery table */}
                                    <div className="glass-panel">
                                        <h4 style={{ marginBottom: '1rem' }}>📊 Per-School Mastery</h4>
                                        {cluster.schools.map((school, i) => {
                                            // Deterministic mock mastery per school
                                            const mastery = parseFloat(((a.avgMastery * 0.85) + (i * 0.04)).toFixed(2));
                                            const clampedMastery = Math.min(mastery, 0.95);
                                            return (
                                                <div key={school.id} style={{ marginBottom: '0.8rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{school.name}</span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: masteryColor(clampedMastery) }}>
                                                            {(clampedMastery * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${clampedMastery * 100}%`, height: '100%', background: masteryColor(clampedMastery), borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Weak / strong topics + recommendations */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="glass-panel" style={{ background: 'rgba(239,68,68,0.05)', borderLeft: '4px solid #ef4444' }}>
                                            <h4 style={{ color: '#ef4444' }}>⚠️ Cluster-Wide Weak Skill</h4>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: '600', marginTop: '0.5rem' }}>
                                                {a.weakSkill}
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                                Most students in this cluster score below 60% on this topic. Consider distributing targeted remediation packs.
                                            </p>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ marginTop: '0.7rem', fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                                                onClick={() => { setActiveTab('content'); setPackSubject('Science'); }}
                                            >
                                                📦 Distribute Remediation Pack →
                                            </button>
                                        </div>
                                        <div className="glass-panel" style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '4px solid #10b981' }}>
                                            <h4 style={{ color: '#10b981' }}>✅ Cluster-Wide Strong Skill</h4>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: '600', marginTop: '0.5rem' }}>
                                                {a.strongSkill}
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                                Students consistently score ≥75%. Consider unlocking advanced content for this cluster.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 4 — Rollout & Scaling
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'rollout' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>Licensing & Expansion Decisions</h3>
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            All tiers are zero-investment (free/Govt/NGO funded). Track plan status and expansion capacity.
                        </p>
                    </div>

                    {/* Plan cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {ROLLOUT_PLANS.map((plan, i) => (
                            <div key={i} className="glass-panel"
                                style={{ borderLeft: `4px solid ${STATUS_COLORS[plan.status] || 'var(--border-color)'}`, padding: '1.2rem 1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                                            <h4 style={{ margin: 0 }}>{plan.cluster}</h4>
                                            <span style={{
                                                padding: '0.2rem 0.7rem',
                                                borderRadius: '999px',
                                                fontSize: '0.72rem',
                                                fontWeight: '600',
                                                background: `${STATUS_COLORS[plan.status]}22`,
                                                color: STATUS_COLORS[plan.status] || 'var(--text-primary)',
                                                textTransform: 'uppercase'
                                            }}>
                                                {plan.plan}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                            <span>👥 {plan.seats.toLocaleString()} seats</span>
                                            <span>✅ {plan.licensed.toLocaleString()} licensed</span>
                                            <span>📅 Expires: {plan.expires}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                                            onClick={() => setExpandPlan(expandPlan === i ? null : i)}
                                        >
                                            {expandPlan === i ? '▲ Collapse' : '▼ Details'}
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none' }}
                                            onClick={async () => {
                                                await queueSyncItem('/api/admin/expand-cluster', 'POST', { cluster: plan.cluster, requestedAt: Date.now() });
                                                alert(`Expansion request queued for ${plan.cluster}`);
                                            }}
                                        >
                                            + Expand Seats
                                        </button>
                                    </div>
                                </div>

                                 {/* Expanded detail */}
                                 {expandPlan === i && (
                                     <div className="animated-fade-in" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.83rem' }}>
                                         <div style={{ background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                             <div style={{ color: 'var(--text-muted)', marginBottom: '0.3rem' }}>INFRASTRUCTURE</div>
                                             <div style={{ color: 'var(--text-primary)' }}>Render free-tier backend</div>
                                             <div style={{ color: 'var(--text-primary)' }}>Neon free Postgres DB</div>
                                             <div style={{ color: 'var(--text-primary)' }}>Cloudflare CDN (free)</div>
                                         </div>
                                         <div style={{ background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                             <div style={{ color: 'var(--text-muted)', marginBottom: '0.3rem' }}>FEATURES ACTIVE</div>
                                             <div style={{ color: 'var(--success)' }}>✓ Offline PWA + Mesh</div>
                                             <div style={{ color: 'var(--success)' }}>✓ AI Co-Pilot (Gemini free)</div>
                                             <div style={{ color: 'var(--success)' }}>✓ SMS Fallback alerts</div>
                                         </div>
                                         <div style={{ background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                             <div style={{ color: 'var(--text-muted)', marginBottom: '0.3rem' }}>EXPANSION OPTIONS</div>
                                             <div style={{ color: 'var(--text-primary)' }}>↑ Add more schools</div>
                                             <div style={{ color: 'var(--text-primary)' }}>↑ Increase Postgres seats</div>
                                             <div style={{ color: 'var(--text-primary)' }}>↑ Enable FCM push</div>
                                         </div>
                                     </div>
                                 )}
                            </div>
                        ))}
                    </div>

                    {/* Expansion capacity summary */}
                    <div className="glass-panel" style={{ borderTop: '4px solid var(--primary)' }}>
                        <h4 style={{ marginBottom: '1rem' }}>📈 District Expansion Capacity</h4>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.2rem', textAlign: 'center' }}>
                            {[
                                { label: 'Max Free Tier Seats (Neon + Render)', value: '10,000', note: 'Per SRS v2 §10' },
                                { label: 'Schools Onboardable Today',           value: '40+',    note: 'No infrastructure change needed' },
                                { label: 'Offline Mesh Devices Supported',      value: '500+',   note: 'Per cluster via BroadcastChannel' },
                            ].map(c => (
                                <div key={c.label} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.3rem' }}>{c.value}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.label}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{c.note}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
