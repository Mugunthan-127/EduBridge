import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { queueSyncItem } from '../db/sync';

// Static/mock school config and state data
const MOCK_USERS = [
    { id: 1, name: 'Kirubashankar R', role: 'STUDENT', username: 'kiruba_s', approved: true, active: true },
    { id: 2, name: 'Madhankumar R', role: 'STUDENT', username: 'madhan_r', approved: true, active: true },
    { id: 3, name: 'Mr. Srinivasan', role: 'TEACHER', username: 'srini_t', approved: true, active: true },
    { id: 4, name: 'Mrs. Jayanthi', role: 'TEACHER', username: 'jayanthi_t', approved: false, active: false },
    { id: 5, name: 'Selvaraj (Parent)', role: 'PARENT', username: 'selva_p', approved: true, active: true },
];

const MOCK_SYNC_DEVICES = [
    { deviceId: 'tab-01', owner: 'Kirubashankar R', lastSync: '10 mins ago', battery: '82%', storageUsed: '3.4 GB / 32 GB', meshPeers: 3, status: 'Healthy' },
    { deviceId: 'tab-02', owner: 'Madhankumar R', lastSync: '1 hour ago', battery: '65%', storageUsed: '4.1 GB / 32 GB', meshPeers: 2, status: 'Healthy' },
    { deviceId: 'pc-lab-04', owner: 'Science Lab PC', lastSync: 'Yesterday', battery: '100% (AC)', storageUsed: '24 GB / 256 GB', meshPeers: 5, status: 'Outdated' },
    { deviceId: 'teacher-mule', owner: 'Mr. Srinivasan', lastSync: 'Just now', battery: '95%', storageUsed: '8.2 GB / 64 GB', meshPeers: 4, status: 'Synced' },
];

const MOCK_CONTENT_PACKS = [
    { id: 'pack-1', title: 'Grade 8 Science — Optics & Wave Optics', sender: 'District Admin', size: '24 MB', receivedAt: '2 days ago', deployed: true },
    { id: 'pack-2', title: 'Grade 8 Mathematics — Linear Equations', sender: 'Cluster Coordinator', size: '18 MB', receivedAt: 'Today', deployed: false },
    { id: 'pack-3', title: 'Grade 9 Tamil — Poetry & Grammar', sender: 'State Admin', size: '12 MB', receivedAt: '3 hours ago', deployed: false },
];

export default function SchoolAdmin({ user, onBack }) {
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'config' | 'packs' | 'health' | 'analytics'
    
    // User management state
    const [users, setUsers] = useState(MOCK_USERS);
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState('STUDENT');
    const [newUserUsername, setNewUserUsername] = useState('');

    // School config state
    const [schoolName, setSchoolName] = useState('GHS Periyapalayam');
    const [syncInterval, setSyncInterval] = useState('30'); // minutes
    const [maxMeshPeers, setMaxMeshPeers] = useState('10');
    const [configSaved, setConfigSaved] = useState(false);

    // Content packs state
    const [packs, setPacks] = useState(MOCK_CONTENT_PACKS);

    // School-wide analytics state
    const [avgAttendance, setAvgAttendance] = useState('94.2%');
    const [quizzesCompleted, setQuizzesCompleted] = useState(384);
    const [avgMastery, setAvgMastery] = useState(0.68);

    // ─── Actions ─────────────────────────────────────────────────────────────

    // User Management
    const handleAddUser = (e) => {
        e.preventDefault();
        if (!newUserName.trim() || !newUserUsername.trim()) return;

        const newUser = {
            id: Date.now(),
            name: newUserName,
            role: newUserRole,
            username: newUserUsername,
            approved: true,
            active: true
        };

        setUsers([...users, newUser]);
        setNewUserName('');
        setNewUserUsername('');
        
        // Sync registration payload
        queueSyncItem('/api/admin/users/create', 'POST', newUser);
    };

    const handleApproveUser = (id) => {
        setUsers(users.map(u => u.id === id ? { ...u, approved: true, active: true } : u));
        const approvedUser = users.find(u => u.id === id);
        if (approvedUser) {
            queueSyncItem('/api/admin/users/approve', 'POST', { userId: id, approved: true });
        }
    };

    const handleToggleActive = (id) => {
        setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
        const targetUser = users.find(u => u.id === id);
        if (targetUser) {
            queueSyncItem('/api/admin/users/toggle', 'POST', { userId: id, active: !targetUser.active });
        }
    };

    // Configuration Save
    const handleSaveConfig = (e) => {
        e.preventDefault();
        setConfigSaved(true);
        queueSyncItem('/api/admin/school/config', 'POST', { schoolName, syncInterval, maxMeshPeers });
        setTimeout(() => setConfigSaved(false), 3000);
    };

    // Deploy content packs to local mesh
    const handleDeployPack = (packId) => {
        setPacks(packs.map(p => p.id === packId ? { ...p, deployed: true } : p));
        const pack = packs.find(p => p.id === packId);
        if (pack) {
            queueSyncItem('/api/mesh/deploy-pack', 'POST', { packId, title: pack.title });
            alert(`"${pack.title}" deployed to school Local Content Mesh successfully! Offline devices can now download this pack from local peer nodes.`);
        }
    };

    const tabStyle = (tab) => ({
        padding: '0.4rem 1rem',
        fontSize: '0.85rem',
        background: activeTab === tab ? 'var(--primary)' : 'var(--bg-secondary)',
        color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: activeTab === tab ? '600' : '400',
    });

    const fStyle = {
        width: '100%', padding: '0.6rem',
        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
        border: '1px solid var(--border-color)', borderRadius: '4px'
    };
    const lbl = { display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' };

    return (
        <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0 }}>🏫 School Administrator Dashboard</h2>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Onboard users · configure local thresholds · verify content packs · monitor offline sync health
                    </p>
                </div>
            </div>

            {/* KPI overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                    { label: 'SCHOOL STUDENTS', value: '312', sub: 'Registered on-premise', color: 'var(--primary)' },
                    { label: 'TEACHERS ACTIVE', value: '14', sub: 'Assigned to modules', color: '#8b5cf6' },
                    { label: 'DEVICE SYNC RATIO', value: '95.2%', sub: 'Last 24 hours activity', color: 'var(--success)' },
                    { label: 'MESH PEER HEALTH', value: 'Active', sub: 'Local mesh channel verified', color: '#f59e0b' }
                ].map(kpi => (
                    <div key={kpi.label} className="glass-panel" style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{kpi.label}</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: kpi.color, marginTop: '0.3rem' }}>{kpi.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tab selection */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>👥 User Management</button>
                <button style={tabStyle('config')} onClick={() => setActiveTab('config')}>⚙️ School Config</button>
                <button style={tabStyle('packs')} onClick={() => setActiveTab('packs')}>📦 Content Packs</button>
                <button style={tabStyle('health')} onClick={() => setActiveTab('health')}>📡 Device Sync Health</button>
                <button style={tabStyle('analytics')} onClick={() => setActiveTab('analytics')}>📊 School Analytics</button>
            </div>

            {/* ─── Tab 1: User Management ──────────────────────────────────── */}
            {activeTab === 'users' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* User list */}
                    <div className="glass-panel">
                        <h3>👥 Onboarded Users & Approvals</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                            {users.map(u => (
                                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{u.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                            @{u.username} · <span style={{ color: 'var(--primary)' }}>{u.role}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {!u.approved ? (
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: '#059669', border: 'none' }}
                                                onClick={() => handleApproveUser(u.id)}
                                            >
                                                ✓ Approve
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: u.active ? 'var(--danger)' : 'var(--success)' }}
                                                onClick={() => handleToggleActive(u.id)}
                                            >
                                                {u.active ? 'Disable' : 'Enable'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add user form */}
                    <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
                        <h3>➕ Create User Account</h3>
                        <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={lbl}>Full Name *</label>
                                <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="e.g., Harish Kumar" required />
                            </div>
                            <div>
                                <label style={lbl}>Username *</label>
                                <input value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} placeholder="e.g., harish_s" required />
                            </div>
                            <div>
                                <label style={lbl}>Role *</label>
                                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={fStyle}>
                                    <option value="STUDENT">Student</option>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="PARENT">Parent</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                                💾 Create & Approve User
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Tab 2: School Config ───────────────────────────────────── */}
            {activeTab === 'config' && (
                <div className="glass-panel" style={{ maxWidth: '600px', borderLeft: '4px solid #8b5cf6' }}>
                    <h3>⚙️ School-Level Configurations</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                        Modify sync intervals and mesh thresholds for student devices in this specific school node.
                    </p>
                    <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={lbl}>School / Node Name *</label>
                            <input value={schoolName} onChange={e => setSchoolName(e.target.value)} required />
                        </div>
                        <div>
                            <label style={lbl}>Automatic Sync Interval (Minutes)</label>
                            <input type="number" value={syncInterval} onChange={e => setSyncInterval(e.target.value)} required />
                        </div>
                        <div>
                            <label style={lbl}>Max Mesh Peers Allowed per Device</label>
                            <input type="number" value={maxMeshPeers} onChange={e => setMaxMeshPeers(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
                            💾 Save Configurations
                        </button>
                    </form>
                    {configSaved && (
                        <div style={{ marginTop: '1rem', color: 'var(--success)', fontSize: '0.85rem' }}>
                            ✓ Configuration changes queued for background node propagation sync.
                        </div>
                    )}
                </div>
            )}

            {/* ─── Tab 3: Content Packs ───────────────────────────────────── */}
            {activeTab === 'packs' && (
                <div className="glass-panel">
                    <h3>📦 Pushed Curriculum Packages</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                        Curriculum content distributed by cluster coordinates. Deploy them to activate sync access on school tablet nodes.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {packs.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                <div>
                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{p.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                        Sender: {p.sender} · Size: {p.size} · Received: {p.receivedAt}
                                    </div>
                                </div>
                                {p.deployed ? (
                                    <span className="badge-success badge-pill" style={{ fontSize: '0.75rem' }}>
                                        📡 Deployed to Mesh
                                    </span>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)', border: 'none' }}
                                        onClick={() => handleDeployPack(p.id)}
                                    >
                                        🚀 Deploy to Mesh
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Tab 4: Sync Health ───────────────────────────────────────── */}
            {activeTab === 'health' && (
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--success)' }}>
                    <h3>📡 Device Connectivity & Sync Logs (Self-Check SRS 6.7)</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
                        Monitor diagnostics, database battery charges, storage capacity limits, and mesh connections across tablets.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Device ID</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Last Sync User</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Last Network Sync</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Battery Status</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Storage Allocated</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Peers in Range</th>
                                    <th style={{ padding: '0.5rem 0.2rem', color: 'var(--text-muted)' }}>Sync State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_SYNC_DEVICES.map((d, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-primary)', fontWeight: '500' }}><code>{d.deviceId}</code></td>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-secondary)' }}>{d.owner}</td>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-secondary)' }}>{d.lastSync}</td>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-primary)' }}>{d.battery}</td>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-muted)' }}>{d.storageUsed}</td>
                                        <td style={{ padding: '0.8rem 0.2rem', color: 'var(--text-secondary)' }}>📶 {d.meshPeers} peers</td>
                                        <td style={{ padding: '0.8rem 0.2rem' }}>
                                            <span style={{
                                                padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600',
                                                background: d.status === 'Synced' || d.status === 'Healthy' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                color: d.status === 'Synced' || d.status === 'Healthy' ? '#10b981' : '#f59e0b'
                                            }}>
                                                {d.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Tab 5: School Analytics ─────────────────────────────────── */}
            {activeTab === 'analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="glass-panel" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AVERAGE ATTENDANCE</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--success)', marginTop: '0.3rem' }}>{avgAttendance}</div>
                        </div>
                        <div className="glass-panel" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>QUIZZES SUBMITTED</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.3rem' }}>{quizzesCompleted}</div>
                        </div>
                        <div className="glass-panel" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AVERAGE BKT MASTERY</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#8b5cf6', marginTop: '0.3rem' }}>{(avgMastery * 100).toFixed(0)}%</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                        {/* Grade mastery breakdown */}
                        <div className="glass-panel">
                            <h4>📊 Class Mastery breakdown</h4>
                            {[
                                { grade: 'Grade 6 General Science', mastery: 0.72 },
                                { grade: 'Grade 7 Algebra Foundations', mastery: 0.58 },
                                { grade: 'Grade 8 Waves & Optics', mastery: 0.75 },
                                { grade: 'Grade 9 Advanced Equations', mastery: 0.62 }
                            ].map((row, idx) => (
                                <div key={idx} style={{ marginTop: '0.8rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginBottom: '0.2rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{row.grade}</span>
                                        <span style={{ fontWeight: '600', color: row.mastery >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>{(row.mastery * 100).toFixed(0)}%</span>
                                    </div>
                                    <div style={{ height: '7px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${row.mastery * 100}%`, height: '100%', background: row.mastery >= 0.7 ? 'var(--success)' : 'var(--warning)', borderRadius: '4px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Node status details */}
                        <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent)' }}>
                            <h4>🏷️ School Deployment Diagnostics</h4>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <li>· Isolated Database: <b style={{ color: 'var(--text-primary)' }}>Row-Level Security (RLS) Active</b></li>
                                <li>· Node Mesh Signature: <b style={{ color: 'var(--text-primary)' }}>GHS-Periya-001a</b></li>
                                <li>· Active Sync Schedule: <b style={{ color: 'var(--text-primary)' }}>Automatic background (exponential backoff)</b></li>
                                <li>· Cache capacity status: <b style={{ color: 'var(--success)' }}>91% Free disk space</b></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
