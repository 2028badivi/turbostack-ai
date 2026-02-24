'use client';

import React, { useState } from 'react';
import ChatWindow from '@/components/ChatWindow';
import DiscussionPanel from '@/components/DiscussionPanel';
import { Groq } from 'groq-sdk';

// --- CONFIGURATION ---
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

// Agent definitions
const AGENTS = [
  { id: 'gpt' as const, name: 'GPT Voyager', model: 'openai/gpt-oss-120b' },
  { id: 'llama' as const, name: 'Groq Llama', model: 'llama-3.3-70b-versatile' },
  { id: 'kimi' as const, name: 'Kimi', model: 'moonshotai/kimi-k2-instruct-0905' },
  { id: 'scout' as const, name: 'Llama Scout', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
];

type AgentRole = typeof AGENTS[number]['id'];

// Helper: check if a response has a VALID terminate block (both open AND close tags)
function hasValidTerminate(text: string): boolean {
  return text.includes('<terminate>') && text.includes('</terminate>');
}

// Helper: extract the content between <terminate> and </terminate>
function extractTerminate(text: string): string {
  const match = text.match(/<terminate>([\s\S]*?)<\/terminate>/);
  return match ? match[1].trim() : '';
}

// Helper: strip any malformed/orphaned terminate tags from text
function stripTerminateTags(text: string): string {
  return text
    .replace(/<terminate>/g, '')
    .replace(/<\/terminate>/g, '')
    .trim();
}

const TERMINATE_RULES = `
CRITICAL RULES FOR <terminate> TAGS:
- If you want the conversation to CONTINUE, do NOT include "<terminate>" anywhere. Not even as an example.
- You may ONLY use <terminate> when you are ready to deliver the FINAL, COMPLETE answer to the user.
- When you use it, you MUST include BOTH <terminate> AND </terminate>.
- The content between tags must be the FULL, DETAILED answer — not a placeholder.
- Example: <terminate>Here is the complete answer...</terminate>
- WRONG: <terminate> without </terminate>
- WRONG: <terminate>DETAILED_RESPONSE</terminate> — write the REAL answer
`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface DiscussionItem {
  role: AgentRole;
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [discussion, setDiscussion] = useState<DiscussionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDiscussion([]);
    setIsLoading(true);

    try {
      const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true });

      const history = messages.slice(-10);
      const conversationContext = history.length > 0
        ? `\nCONVERSATION HISTORY:\n${history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
        : '';

      const localDiscussion: DiscussionItem[] = [];
      let finalResponse = '';
      let discussionEnded = false;

      const MAX_ROUNDS = 3; // 3 full rotations × 4 agents = up to 12 turns
      const totalMaxTurns = MAX_ROUNDS * AGENTS.length;
      let turnCount = 0;

      // Build agent name list for prompts
      const agentNames = AGENTS.map(a => a.name).join(', ');

      for (let round = 0; round < MAX_ROUNDS && !discussionEnded; round++) {
        for (let agentIdx = 0; agentIdx < AGENTS.length && !discussionEnded; agentIdx++) {
          turnCount++;
          const agent = AGENTS[agentIdx];
          const isFirstTurn = turnCount === 1;
          const isLastTurn = turnCount >= totalMaxTurns;

          // Build context from previous discussion turns
          const prevDiscussion = localDiscussion
            .slice(-6) // last 6 messages for context window sanity
            .map(d => {
              const agentDef = AGENTS.find(a => a.id === d.role);
              return `${agentDef?.name || d.role}: "${d.content}"`;
            })
            .join('\n\n');

          let prompt: string;

          if (isFirstTurn) {
            prompt = `You are "${agent.name}", part of TurboStack's multi-AI reasoning engine (${agentNames}).
            ${conversationContext}
            User Query: "${text}".

            THIS IS THE FIRST MESSAGE. You are FORBIDDEN from terminating on the first turn.
            Provide YOUR initial analysis only. Do NOT include <terminate> tags.
            Keep it focused and let the other agents respond.
            
            ${TERMINATE_RULES}`;
          } else {
            prompt = `You are "${agent.name}", part of TurboStack's multi-AI reasoning engine (${agentNames}).
            ${conversationContext}
            User Query: "${text}".
            
            Discussion so far:
            ${prevDiscussion}

            Turn ${turnCount}/${totalMaxTurns}.${isLastTurn ? ' THIS IS THE FINAL TURN. You MUST provide the final answer now using <terminate>your complete answer</terminate>.' : ''}

            TASK:
            1. Build on, critique, or synthesize the other agents' analyses.
            2. If the group has converged on a strong answer, deliver it with <terminate>complete answer</terminate>.
            3. If more refinement is needed, provide your perspective — but do NOT use <terminate> if the conversation should continue.
            
            Do NOT repeat what others said. Add NEW value or synthesize.
            ${TERMINATE_RULES}`;
          }

          const result = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: agent.model,
          });

          let responseText = result.choices[0]?.message?.content || '';

          // First turn: forcibly strip any terminate tags
          if (isFirstTurn && (responseText.includes('<terminate>') || responseText.includes('</terminate>'))) {
            responseText = stripTerminateTags(responseText);
          }

          // Malformed terminate (open but no close): strip and keep going
          if (responseText.includes('<terminate>') && !responseText.includes('</terminate>')) {
            responseText = stripTerminateTags(responseText);
          }

          localDiscussion.push({ role: agent.id, content: responseText });
          setDiscussion([...localDiscussion]);

          // Only accept a VALID terminate (both tags present with real content)
          if (hasValidTerminate(responseText)) {
            finalResponse = extractTerminate(responseText);
            if (finalResponse && finalResponse.length > 10) {
              discussionEnded = true;
            }
          }
        }
      }

      // Fallback: if all rounds passed with no valid terminate
      if (!discussionEnded) {
        const lastMsg = localDiscussion[localDiscussion.length - 1].content;
        const cleaned = stripTerminateTags(lastMsg);
        finalResponse = `**[TurboStack — Round Limit Reached]**\n\nThe 4 agents debated for ${turnCount} turns without a perfect consensus. Here is their best combined synthesis:\n\n---\n\n${cleaned}`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Failed coordination:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Coordination Error: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="main-container">
      <ChatWindow
        messages={messages}
        onSend={handleSendMessage}
        isLoading={isLoading}
      />
      <DiscussionPanel
        discussion={discussion}
        isThinking={isLoading}
      />
    </main>
  );
}
