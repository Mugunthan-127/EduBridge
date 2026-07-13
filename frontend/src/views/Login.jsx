import React, { useState, useEffect } from 'react';
import { db, saveCurrentUser } from '../db/db';
import { syncData } from '../db/sync';

export default function Login({ onLoginSuccess }) {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('STUDENT');
    const [tenantId, setTenantId] = useState('school-1');
    const [parentPhone, setParentPhone] = useState('');
    const [childUsername, setChildUsername] = useState(''); // parent registration only
    const [message, setMessage] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (isRegister) {
            if (!isOnline) {
                setMessage('Cannot register new accounts while offline.');
                return;
            }

            try {
                const response = await fetch('http://localhost:8080/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, fullName, role, tenantId, parentPhone, childUsername })
                });

                if (response.ok) {
                    setMessage('Registration successful! Please login.');
                    setIsRegister(false);
                } else {
                    const text = await response.text();
                    setMessage(`Registration failed: ${text}`);
                }
            } catch (err) {
                setMessage(`Network error: ${err.message}`);
            }
        } else {
            // LOGIN FLOW
            if (isOnline) {
                try {
                    const response = await fetch('http://localhost:8080/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });

                    if (response.ok) {
                        const data = await response.json(); // contains accessToken
                        const userProfile = {
                            userId: data.userId,
                            username: data.username,
                            fullName: data.fullName,
                            role: data.role,
                            tenantId: data.tenantId,
                            parentPhone: data.parentPhone || '',
                            childUsername: data.childUsername || '',
                            token: data.accessToken
                        };

                        await saveCurrentUser(userProfile);
                        // Trigger initial sync to pull courses
                        await syncData();
                        onLoginSuccess(userProfile);
                    } else {
                        setMessage('Login failed. Please check credentials.');
                    }
                } catch (err) {
                    console.log('Online login failed. Checking offline fallback...', err);
                    await attemptOfflineLogin();
                }
            } else {
                await attemptOfflineLogin();
            }
        }
    };

    const attemptOfflineLogin = async () => {
        // Find if user already exists in IndexedDB (from previous successful login)
        const cachedUser = await db.users.where({ username }).first();
        if (cachedUser) {
            // Password verification is bypassed offline for demo/simplicity,
            // or we could check a hashed password. In local sandbox PWA, we allow caching token
            setMessage('Logged in successfully (Offline Fallback Mode).');
            onLoginSuccess(cachedUser);
        } else {
            setMessage('Offline login failed. User credentials not cached on this device.');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }} className="animated-fade-in">
            <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '2rem' }}>
                        EduBridge
                    </h2>
                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {isOnline ? '🌐 Connected to Network' : '📶 Operating Offline Mode'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>

                    {isRegister && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name</label>
                                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Role</label>
                                <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                    <option value="STUDENT">Student</option>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="PARENT">Parent</option>
                                    <option value="SCHOOL_ADMIN">School Admin</option>
                                    <option value="DISTRICT_ADMIN">District Admin</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>School / Cluster Deployment</label>
                                <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                    <option value="school-1">SKCET Cluster A (Default Sandbox)</option>
                                    <option value="school-2">District Cluster B (Mountain)</option>
                                    <option value="school-3">District Cluster C (Coastal)</option>
                                </select>
                            </div>

                            {role === 'STUDENT' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Parent Phone (SMS Alert)</label>
                                    <input type="tel" placeholder="+91 99999 99999" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
                                </div>
                            )}

                            {role === 'PARENT' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Your Phone Number (SMS alerts)</label>
                                        <input type="tel" placeholder="+91 99999 99999" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Link to Child's Username</label>
                                        <input type="text" placeholder="Enter your child's student username" value={childUsername} onChange={e => setChildUsername(e.target.value)} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>This links your account to track your child’s attendance, marks and mastery.</p>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {message && (
                        <div className="badge-warning" style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center' }}>
                            {message}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
                        {isRegister ? 'Register Account' : 'Sign In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                        {isRegister ? 'Already have an account?' : "Don't have an account?"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsRegister(!isRegister)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', marginLeft: '0.3rem', cursor: 'pointer', padding: 0 }}
                    >
                        {isRegister ? 'Sign In' : 'Register now'}
                    </button>
                </div>

                {/* Parent Portal quick-access card */}
                {!isRegister && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(139,92,246,0.07)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>👪</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                            Parent? Track your child's attendance, marks &amp; mastery in any language.
                        </div>
                        <button
                            id="parent-portal-quick"
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', borderColor: '#7c3aed', color: '#a78bfa' }}
                            onClick={() => { setRole('PARENT'); setIsRegister(true); }}
                        >
                            Register as Parent →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
