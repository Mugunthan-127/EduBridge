/**
 * EduBridge AI Co-Pilot — Offline Chatbot
 * SRS v2 §6.8 — Graceful Degradation Ladder
 *
 * Level 1: Online + Gemini API reachable           → Full cloud LLM response
 * Level 2: Online but Gemini returns 429/503        → Retry with backoff, "AI busy" notice
 * Level 3: Offline, cached responses exist          → Serve nearest cached Q&A from IndexedDB
 * Level 4: Offline, no cache                        → Rule-based keyword matcher (static FAQ)
 */

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { sha256Hex } from '../db/contentMesh';

const API_BASE_URL = 'http://localhost:8080';

// ─── Level 4: Static FAQ keyword rules ──────────────────────────────────────
const FAQ_RULES = [
    {
        keywords: ['refraction', 'snell', 'bend', 'velocity'],
        answer: "Refraction occurs when light changes speed as it passes between mediums. Snell's Law states: n₁·sin(θ₁) = n₂·sin(θ₂). The greater the difference in refractive indices, the more the light bends."
    },
    {
        keywords: ['reflection', 'mirror', 'incidence', 'plane mirror'],
        answer: "The law of reflection states that the angle of incidence equals the angle of reflection (measured from the normal). A plane mirror produces a virtual, upright image the same size as the object."
    },
    {
        keywords: ['linear equation', 'solve', 'variable', 'algebra'],
        answer: "To solve a linear equation, isolate the variable on one side. Example: 2x + 5 = 13 → subtract 5 from both sides → 2x = 8 → divide by 2 → x = 4."
    },
    {
        keywords: ['mastery', 'bkt', 'bayesian', 'knowledge tracing'],
        answer: "BKT (Bayesian Knowledge Tracing) estimates the probability you've mastered a skill based on your correct/incorrect answers. When your mastery probability passes ~75%, EduBridge recommends advancing to new topics."
    },
    {
        keywords: ['hello', 'hi', 'hey', 'help'],
        answer: null // Handled dynamically with user's name
    }
];

// ─── Gemini API call with retry ──────────────────────────────────────────────

async function callCloudAI(question, token, retryCount = 0) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question })
        });

        if (res.ok) {
            const data = await res.json();
            return { level: 1, answer: data.answer };
        }

        if ((res.status === 429 || res.status === 503) && retryCount < 2) {
            // Level 2: Gemini busy — exponential backoff retry (1s, 2s)
            const backoffMs = Math.pow(2, retryCount) * 1000;
            await new Promise(r => setTimeout(r, backoffMs));
            return callCloudAI(question, token, retryCount + 1);
        }

        if (res.status === 429 || res.status === 503) {
            return {
                level: 2,
                answer: '⏳ The AI service is currently busy (rate limit). Showing your best cached answer below.'
            };
        }

        return null; // Non-retriable cloud error — fall through to offline tiers
    } catch {
        return null; // Network offline — fall through to offline tiers
    }
}

// ─── Level 3: IndexedDB cache lookup ────────────────────────────────────────

async function lookupCache(promptHash) {
    const cached = await db.aiResponseCache
        .where('promptHash').equals(promptHash)
        .first();
    return cached || null;
}

async function saveToCache(question, promptHash, answer) {
    // Keep cache size manageable — evict entries older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await db.aiResponseCache
        .where('cachedAt').below(sevenDaysAgo)
        .delete();

    await db.aiResponseCache.put({
        promptHash,
        question,
        answer,
        cachedAt: Date.now()
    });
}

// ─── Level 4: Rule-based keyword fallback ───────────────────────────────────

function keywordFallback(query, userName) {
    const lower = query.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return `Hello ${userName || 'there'}! I'm your offline AI tutor. Ask me about Reflection, Refraction, Algebra, or BKT mastery!`;
    }

    for (const rule of FAQ_RULES) {
        if (rule.answer && rule.keywords.some(kw => lower.includes(kw))) {
            return rule.answer;
        }
    }

    // Search IndexedDB curriculum for matching titles as last resort
    return null; // Signals caller to do IndexedDB title search
}

async function indexedDbTitleSearch(query) {
    const lowerQuery = query.toLowerCase();
    const [courses, modules, contents] = await Promise.all([
        db.courses.toArray(),
        db.modules.toArray(),
        db.content.toArray()
    ]);
    const matches = [...courses, ...modules, ...contents].filter(item =>
        (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
        (item.description && item.description.toLowerCase().includes(lowerQuery)) ||
        (item.skillTag && lowerQuery.includes(item.skillTag.toLowerCase()))
    );
    if (matches.length > 0) {
        const titles = matches.slice(0, 3).map(m => `"${m.title}"`).join(', ');
        return `📚 I found relevant offline material: ${titles}. Try asking a specific question about those topics!`;
    }
    return "I don't have specific information on that in your offline cache. Try asking about Reflection, Refraction, or Linear Equations!";
}

// ─── Degradation Ladder Orchestrator ────────────────────────────────────────

const LEVEL_LABELS = {
    1: { icon: '🌐', label: 'Cloud AI', color: 'var(--success)' },
    2: { icon: '⏳', label: 'AI Busy – Retry', color: 'var(--warning, #f59e0b)' },
    3: { icon: '💾', label: 'Cached Response', color: 'var(--primary)' },
    4: { icon: '⚡', label: 'On-Device Engine', color: 'var(--text-secondary)' }
};

async function generateResponse(query, user) {
    const promptHash = await sha256Hex(query.toLowerCase().trim());

    // --- Level 1 + 2: Try cloud AI if online ---
    if (navigator.onLine && user?.token) {
        const cloudResult = await callCloudAI(query, user.token);
        if (cloudResult && cloudResult.level === 1) {
            // Cache successful response for offline use later
            await saveToCache(query, promptHash, cloudResult.answer);
            return { ...cloudResult, promptHash };
        }
        if (cloudResult && cloudResult.level === 2) {
            // Level 2: Gemini busy — fall through to cache
        }
    }

    // --- Level 3: IndexedDB cache ---
    const cached = await lookupCache(promptHash);
    if (cached) {
        return {
            level: 3,
            answer: cached.answer,
            cachedAt: new Date(cached.cachedAt).toLocaleDateString(),
            promptHash
        };
    }

    // --- Level 4: Rule-based keyword matcher ---
    const ruleAnswer = keywordFallback(query, user?.fullName);
    if (ruleAnswer) {
        return { level: 4, answer: ruleAnswer, promptHash };
    }

    // --- Level 4 fallback: IndexedDB title search ---
    const dbAnswer = await indexedDbTitleSearch(query);
    return { level: 4, answer: dbAnswer, promptHash };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OfflineChatbot({ user, externalOpen, initialQuery, onExternalClose }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'bot',
            text: 'Hi! I\'m your AI tutor. I work online and offline — ask me anything about your courses!',
            level: 1
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(navigator.onLine ? 1 : 4);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    // Track online/offline status for level indicator
    useEffect(() => {
        const handleOnline = () => setCurrentLevel(1);
        const handleOffline = () => setCurrentLevel(4);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Programmatic open from QuizView — open + auto-send the initial query
    useEffect(() => {
        if (externalOpen && initialQuery) {
            setIsOpen(true);
            // Slight delay so the chat window renders before sending
            setTimeout(async () => {
                const query = initialQuery;
                const userMsg = { id: Date.now(), sender: 'user', text: query };
                setMessages(prev => [...prev, userMsg]);
                setIsTyping(true);
                try {
                    const result = await generateResponse(query, user);
                    setCurrentLevel(result.level);
                    const levelMeta = LEVEL_LABELS[result.level];
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1, sender: 'bot',
                        text: result.answer,
                        level: result.level, levelMeta
                    }]);
                } finally {
                    setIsTyping(false);
                    onExternalClose?.();
                }
            }, 300);
        }
    }, [externalOpen, initialQuery]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const query = inputValue.trim();
        const userMsg = { id: Date.now(), sender: 'user', text: query };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const result = await generateResponse(query, user);
            setCurrentLevel(result.level);

            const levelMeta = LEVEL_LABELS[result.level];
            const suffix = result.level === 3 && result.cachedAt
                ? ` *(cached ${result.cachedAt})*`
                : '';

            const botMsg = {
                id: Date.now() + 1,
                sender: 'bot',
                text: result.answer + suffix,
                level: result.level,
                levelMeta
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error('[Chatbot] Response generation failed:', err);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'bot',
                text: 'Something went wrong. Please try again.',
                level: 4
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const levelMeta = LEVEL_LABELS[currentLevel];

    if (!isOpen) {
        return (
            <button
                className="chatbot-fab bounce-hover"
                onClick={() => setIsOpen(true)}
                title="Open AI Tutor"
                id="chatbot-fab-btn"
            >
                🤖
            </button>
        );
    }

    return (
        <div className="chatbot-window glass-panel">
            {/* Header */}
            <div className="chatbot-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🤖</span>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>AI Tutor</h4>
                        <span style={{ fontSize: '0.7rem', color: levelMeta.color }}>
                            {levelMeta.icon} {levelMeta.label}
                        </span>
                    </div>
                </div>
                {/* Degradation Level Ladder Indicator */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[1, 2, 3, 4].map(lvl => (
                        <div
                            key={lvl}
                            title={`Level ${lvl}: ${LEVEL_LABELS[lvl].label}`}
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: currentLevel === lvl
                                    ? LEVEL_LABELS[lvl].color
                                    : 'var(--border-color)',
                                transition: 'background 0.3s ease'
                            }}
                        />
                    ))}
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    id="chatbot-close-btn"
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                    ✕
                </button>
            </div>

            {/* Messages */}
            <div className="chatbot-messages">
                {messages.map(m => (
                    <div key={m.id} className={`chat-bubble ${m.sender}`}>
                        {m.sender === 'bot' && m.levelMeta && (
                            <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '3px' }}>
                                {m.levelMeta.icon} {m.levelMeta.label}
                            </div>
                        )}
                        {m.text}
                    </div>
                ))}
                {isTyping && (
                    <div className="chat-bubble bot typing-indicator">
                        <span>.</span><span>.</span><span>.</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="chatbot-input-area" onSubmit={handleSend}>
                <input
                    type="text"
                    id="chatbot-input"
                    placeholder="Ask a question..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    autoFocus
                />
                <button type="submit" id="chatbot-send-btn" disabled={!inputValue.trim() || isTyping}>
                    Send
                </button>
            </form>
        </div>
    );
}
