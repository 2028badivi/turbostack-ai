'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Cpu, ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const Typewriter = ({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isDone, setIsDone] = useState(false);
    const textRef = useRef(text);
    const indexRef = useRef(0);

    useEffect(() => {
        // Reset if text changes significantly (new message)
        if (textRef.current !== text) {
            textRef.current = text;
            indexRef.current = 0;
            setDisplayedText('');
            setIsDone(false);
        }

        let timeout: NodeJS.Timeout;
        const type = () => {
            if (indexRef.current < text.length) {
                const char = text[indexRef.current];
                setDisplayedText((prev) => prev + char);
                indexRef.current += 1;

                // Variable speed for "human-like" or "smooth" effect
                const baseSpeed = text.length > 500 ? 5 : 15;
                const speed = char === '.' || char === '?' || char === '!' ? baseSpeed * 5 : baseSpeed;

                timeout = setTimeout(type, speed);
            } else {
                setIsDone(true);
            }
        };

        timeout = setTimeout(type, 100);
        return () => clearTimeout(timeout);
    }, [text]);

    return (
        <div className="prose" style={{ opacity: isDone ? 1 : 0.98 }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {displayedText + (isDone ? '' : ' ▮')}
            </ReactMarkdown>
        </div>
    );
};

interface ChatWindowProps {
    messages: Message[];
    onSend: (text: string) => void;
    isLoading: boolean;
}

export default function ChatWindow({ messages, onSend, isLoading }: ChatWindowProps) {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
        }
    };

    return (
        <div className="chat-section">
            <header style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                        <Cpu size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                            TurboStack
                        </h1>
                        <p style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>COORDINATED INTELLIGENCE</p>
                    </div>
                </div>
                <div style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #222', background: '#0a0a0a', fontSize: '0.7rem', color: '#777', fontWeight: 700, letterSpacing: '0.05em' }}>
                    GEMINI 2.5 + LLAMA 3.3
                </div>
            </header>

            <div
                ref={scrollRef}
                style={{ flex: 1, overflowY: 'auto', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', paddingRight: '10%' }}
            >
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 2rem' }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem', color: 'white', maxWidth: '500px', lineHeight: '1.1' }}>
                            How can <span style={{ color: 'var(--primary)' }}>TurboStack</span> assist you today?
                        </h2>
                        <p style={{ color: '#555', maxWidth: '400px', lineHeight: '1.6' }}>
                            A high-fidelity coordination engine using sub-agent debate to provide extremely accurate answers.
                        </p>
                    </div>
                )}

                <AnimatePresence>
                    {messages.map((m, idx) => (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                display: 'flex',
                                gap: '1.5rem',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                paddingLeft: m.role === 'user' ? '40%' : '0'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#555' }}>
                                {m.role === 'user' ? <User size={14} /> : <Bot size={14} style={{ color: 'var(--primary)' }} />}
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    {m.role === 'user' ? 'User' : 'TurboStack Agent'}
                                </span>
                            </div>
                            <div style={{
                                background: m.role === 'user' ? '#1a1a1a' : 'transparent',
                                borderRadius: '4px',
                                padding: m.role === 'user' ? '1rem 1.5rem' : '0',
                                width: '100%'
                            }}>
                                {m.role === 'assistant' && idx === messages.length - 1 && !isLoading ? (
                                    <Typewriter text={m.content} />
                                ) : (
                                    <div className="prose">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#555' }}>
                            <Bot size={14} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Reasoning Engine Active
                            </span>
                        </div>
                        <div className="typing-cursor"></div>
                    </motion.div>
                )}
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                    <input
                        type="text"
                        className="input-glass"
                        placeholder="Message TurboStack..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        style={{ paddingRight: '4rem' }}
                    />
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isLoading || !input.trim()}
                        style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '2.5rem',
                            height: '2.5rem',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ArrowUp size={20} />
                    </button>
                </form>
                <p style={{ textAlign: 'center', fontSize: '0.65rem', color: '#444', marginTop: '1rem', fontWeight: 600 }}>
                    TurboStack can make mistakes. Verify important information.
                </p>
            </div>

            <style jsx>{`
                .typing-cursor {
                    width: 4px;
                    height: 1.2rem;
                    background: var(--primary);
                    animation: blink 1s infinite;
                }
                @keyframes blink {
                    0%, 100% { opacity: 0; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
