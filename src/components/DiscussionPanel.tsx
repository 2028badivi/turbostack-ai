'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface DiscussionItem {
    role: 'gemini' | 'groq';
    content: string;
}

interface DiscussionPanelProps {
    discussion: DiscussionItem[];
    isThinking: boolean;
}

export default function DiscussionPanel({ discussion, isThinking }: DiscussionPanelProps) {
    return (
        <div className="side-panel">
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #222', background: '#0a0a0a' }}>
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    <Terminal size={14} />
                    Internal Discussion
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.5rem', fontWeight: 500 }}>
                    TurboStack multi-agent reasoning
                </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#0d0d0d' }}>
                <AnimatePresence mode="popLayout">
                    {discussion.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="glass-card"
                            style={{
                                padding: '1.25rem',
                                borderLeft: `2px solid ${item.role === 'gemini' ? 'var(--primary)' : '#333'}`,
                                background: '#141414',
                                borderRadius: '4px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: item.role === 'gemini' ? 'var(--primary)' : '#444',
                                    color: item.role === 'gemini' ? 'black' : 'white',
                                    fontSize: '0.65rem',
                                    fontWeight: 900
                                }}>
                                    {item.role === 'gemini' ? 'G' : 'L'}
                                </div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#777', letterSpacing: '0.05em' }}>
                                    {item.role === 'gemini' ? 'GEMINI VOYAGER' : 'GROQ LLAMA'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.875rem', lineHeight: '1.7', color: '#bbb' }}>
                                <div className="prose">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {item.content.replace(/<terminate>[\s\S]*<\/terminate>/g, '')}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isThinking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                    >
                        <div className="shimmer-text">Agents analyzing...</div>
                        <div className="shimmer-bar"></div>
                        <style jsx>{`
                            .shimmer-text {
                                font-size: 0.75rem;
                                color: var(--primary);
                                font-weight: 800;
                                text-transform: uppercase;
                                letter-spacing: 0.2em;
                                animation: blink 1.5s infinite;
                            }
                            .shimmer-bar {
                                height: 1px;
                                width: 100%;
                                background: linear-gradient(90deg, transparent, var(--primary), transparent);
                                background-size: 200% 100%;
                                animation: shimmer 2s infinite linear;
                            }
                            @keyframes blink {
                                0%, 100% { opacity: 0.4; }
                                50% { opacity: 1; }
                            }
                            @keyframes shimmer {
                                0% { background-position: -200% 0; }
                                100% { background-position: 200% 0; }
                            }
                        `}</style>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
