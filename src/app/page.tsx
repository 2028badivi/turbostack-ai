'use client';

import React, { useState } from 'react';
import ChatWindow from '@/components/ChatWindow';
import DiscussionPanel from '@/components/DiscussionPanel';
import { Groq } from 'groq-sdk';

// --- CONFIGURATION ---
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";

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
- If you want the conversation to CONTINUE, do NOT include "<terminate>" anywhere in your message. Not even as an example.
- You may ONLY use <terminate> when you are ready to deliver the FINAL, COMPLETE answer to the user.
- When you DO use it, you MUST include BOTH the opening <terminate> AND the closing </terminate> tags.
- The content between the tags must be the FULL, DETAILED answer — not a placeholder.
- Example of CORRECT usage: <terminate>Here is the complete answer to the user's question...</terminate>
- WRONG: Using <terminate> without </terminate>
- WRONG: Using <terminate> in a response that asks a follow-up question
- WRONG: Using <terminate>DETAILED_RESPONSE</terminate> or any placeholder text
`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface DiscussionItem {
  role: 'gemini' | 'groq';
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
        ? `\nCONVERSATION HISTORY:\n${history.map((h: any) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
        : '';

      const localDiscussion: DiscussionItem[] = [];
      let finalResponse = '';
      let discussionEnded = false;

      // Initial prompt for GPT-OSS (Agent A) — first turn, NEVER terminate
      let currentPrompt = `You are "GPT Voyager", one half of TurboStack's dual-AI reasoning engine.
      ${conversationContext}
      User Query: "${text}".

      THIS IS YOUR FIRST MESSAGE. You are FORBIDDEN from terminating on the first turn.
      
      RULES:
      1. NEVER simulate, fake, or predict Groq Llama's response.
      2. Provide YOUR initial analysis only. Keep debating until you and Groq Llama converge.
      3. Do NOT include "<terminate>" in this message under any circumstances.
      4. Stop after your analysis. Let Groq Llama respond.
      
      ${TERMINATE_RULES}`;

      for (let i = 0; i < 5; i++) {
        // --- GPT-OSS Turn (Agent A) ---
        const gptResult = await groq.chat.completions.create({
          messages: [{ role: 'user', content: currentPrompt }],
          model: 'openai/gpt-oss-120b',
        });

        let gptText = gptResult.choices[0]?.message?.content || '';

        // On turn 0, forcibly strip any terminate tags (it should NEVER terminate first)
        if (i === 0 && (gptText.includes('<terminate>') || gptText.includes('</terminate>'))) {
          gptText = stripTerminateTags(gptText);
        }

        // Check for malformed terminate (has open but no close) — strip it, keep going
        if (gptText.includes('<terminate>') && !gptText.includes('</terminate>')) {
          gptText = stripTerminateTags(gptText);
        }

        localDiscussion.push({ role: 'gemini', content: gptText });
        setDiscussion([...localDiscussion]);

        // Only accept a VALID terminate (both tags present)
        if (hasValidTerminate(gptText)) {
          finalResponse = extractTerminate(gptText);
          if (finalResponse) {
            discussionEnded = true;
            break;
          }
        }

        // --- Llama Turn (Agent B) ---
        const isLastTurn = i === 4;
        const llamaPrompt = `You are "Groq Llama", the second half of TurboStack's dual-AI reasoning engine.
          ${conversationContext}
          User query: "${text}".
          GPT Voyager's current analysis: "${gptText}".
          
          Turn: ${i + 1}/5.${isLastTurn ? ' THIS IS THE FINAL TURN. You MUST provide the final answer now using <terminate>...</terminate> tags.' : ''}
          
          TASK:
          1. Critique or augment GPT Voyager's analysis.
          2. If you both agree and are ready, deliver the final answer using <terminate>your complete answer here</terminate>.
          3. If you disagree or need more refinement, explain why — but do NOT include <terminate> if the conversation should continue.
          
          ${TERMINATE_RULES}`;

        const llamaResult = await groq.chat.completions.create({
          messages: [{ role: 'user', content: llamaPrompt }],
          model: 'llama-3.3-70b-versatile',
        });

        let llamaText = llamaResult.choices[0]?.message?.content || '';

        // Check for malformed terminate — strip it, keep going
        if (llamaText.includes('<terminate>') && !llamaText.includes('</terminate>')) {
          llamaText = stripTerminateTags(llamaText);
        }

        localDiscussion.push({ role: 'groq', content: llamaText });
        setDiscussion([...localDiscussion]);

        if (hasValidTerminate(llamaText)) {
          finalResponse = extractTerminate(llamaText);
          if (finalResponse) {
            discussionEnded = true;
            break;
          }
        }

        // Update prompt for GPT-OSS's next turn
        const isNextLastTurn = i + 1 === 4;
        currentPrompt = `Iteration: ${i + 2}/5. 
          Groq Llama said: "${llamaText}".
          ${isNextLastTurn ? 'WARNING: Next turn is the FINAL turn. If you have not reached consensus, you MUST terminate with the best combined answer now.' : ''}
          
          TASK:
          1. Analyze Groq Llama's input and refine the answer.
          2. If you both agree, provide the final synthesized response using <terminate>your complete answer</terminate>.
          3. If you still disagree, argue your point — but do NOT include <terminate> if you want the discussion to continue.
          
          Do NOT roleplay Groq. ONLY provide YOUR response.
          ${TERMINATE_RULES}`;
      }

      // Fallback: if 5 full rounds passed with no valid terminate
      if (!discussionEnded) {
        // Try to extract the best answer from the last message
        const lastMsg = localDiscussion[localDiscussion.length - 1].content;
        const cleaned = stripTerminateTags(lastMsg);
        finalResponse = `**[TurboStack — 5 Round Limit Reached]**\n\nThe agents debated for 5 rounds without a perfect consensus. Here is their best combined synthesis:\n\n---\n\n${cleaned}`;
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
