'use client';

import React, { useState } from 'react';
import ChatWindow from '@/components/ChatWindow';
import DiscussionPanel from '@/components/DiscussionPanel';
import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURATION ---
// IMPORTANT: In a production app, these should NEVER be exposed in the frontend.
// They are moved here only to allow hosting on static platforms like GitHub Pages.
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

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
    setDiscussion([]); // Reset discussion for new query
    setIsLoading(true);

    try {
      // Setup Clients directly in frontend
      const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true });
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

      const history = messages.slice(-10); // Last 10 messages for context
      const conversationContext = history.length > 0
        ? `\nCONVERSATION HISTORY:\n${history.map((h: any) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
        : '';

      const localDiscussion: DiscussionItem[] = [];
      let finalResponse = '';
      let discussionEnded = false;

      // Initial prompt for Gemini
      let currentPrompt = `You are "Gemini Voyager", one half of TurboStack. 
      ${conversationContext}
      User Query: "${text}".
      RULES:
      1. NEVER simulate, fake, or predict the other AI's (Groq Llama) response.
      2. NEVER include the string "<terminate>" in your very first response.
      3. ONLY provide YOUR initial analysis. Do not conclude the conversation yet.
      4. Speak directly to Groq Llama to start the coordination.
      5. STRICTLY FORBIDDEN: Do not roleplay the entire conversation yourself. Stop after your first paragraph of analysis.`;

      for (let i = 0; i < 5; i++) {
        // --- Gemini Turn ---
        const geminiResult = await geminiModel.generateContent(currentPrompt);
        const geminiText = geminiResult.response.text();
        localDiscussion.push({ role: 'gemini', content: geminiText });
        setDiscussion([...localDiscussion]);

        if (geminiText.includes('<terminate>')) {
          finalResponse = geminiText.split('<terminate>')[1]?.split('</terminate>')[0] || "Resolution reached.";
          discussionEnded = true;
          break;
        }

        // --- Groq Turn ---
        const groqPrompt = `You are "Groq Llama", the second half of TurboStack. 
          ${conversationContext}
          User query: "${text}".
          Gemini's current analysis: "${geminiText}".
          
          TASK:
          1. Critique or augment Gemini's analysis. 
          2. If you are ready to provide a final solution, wrap the actual content between <terminate> and </terminate> tags (e.g., <terminate>The answer is...</terminate>).
          3. If you disagree, explain why and suggest a better approach.
          
          Turn: ${i + 1}/5.`;

        const groqResult = await groq.chat.completions.create({
          messages: [{ role: 'user', content: groqPrompt }],
          model: 'llama-3.3-70b-versatile',
        });

        const groqText = groqResult.choices[0]?.message?.content || '';
        localDiscussion.push({ role: 'groq', content: groqText });
        setDiscussion([...localDiscussion]);

        if (groqText.includes('<terminate>')) {
          finalResponse = groqText.split('<terminate>')[1]?.split('</terminate>')[0] || "Resolution reached.";
          discussionEnded = true;
          break;
        }

        // Update currentPrompt for Gemini's next turn
        currentPrompt = `Iteration: ${i + 1}/5. 
          Groq Llama said: "${groqText}".
          
          CRITICAL: 
          1. Analyze Groq's input. 
          2. If you both agree, provide the final synthesized response inside <terminate>...</terminate> tags.
          3. If you disagree, argue your point or propose a synthesis.
          
          WARNING: Do NOT roleplay Groq. ONLY provide YOUR response. Do not use placeholders like "DETAILED_FINAL_ANSWER", write the actual final response for the user.`;
      }

      if (!discussionEnded) {
        const lastOpinion = localDiscussion[localDiscussion.length - 1].content;
        finalResponse = `[TurboStack Limit Reached]: The discussion reached its 5-message limit before a perfect consensus was found.\n\nCurrent Synthesis:\n${lastOpinion.replace(/<terminate>[\s\S]*<\/terminate>/g, '')}`;
        localDiscussion.push({ role: 'gemini', content: "Cycle limit reached. Force-terminating and providing best current synthesis." });
        setDiscussion([...localDiscussion]);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Failed to coordination:', error);
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
