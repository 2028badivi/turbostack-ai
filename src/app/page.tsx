'use client';

import React, { useState } from 'react';
import ChatWindow from '@/components/ChatWindow';
import DiscussionPanel from '@/components/DiscussionPanel';

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDiscussion(data.discussion);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.finalResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, something went wrong: ${error.message}`,
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
