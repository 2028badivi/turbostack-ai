import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const conversationContext = history.length > 0
      ? `\nCONVERSATION HISTORY:\n${history.map((h: any) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
      : '';

    const discussion: { role: 'gemini' | 'groq'; content: string }[] = [];
    let finalResponse = '';
    let discussionEnded = false;

    // Initial prompt for Gemini
    let currentPrompt = `You are "Gemini Voyager", one half of TurboStack. 
    ${conversationContext}
    User Query: "${message}".
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
      discussion.push({ role: 'gemini', content: geminiText });

      if (geminiText.includes('<terminate>')) {
        finalResponse = geminiText.split('<terminate>')[1].split('</terminate>')[0];
        discussionEnded = true;
        break;
      }

      // --- Groq Turn ---
      const groqPrompt = `You are "Groq Llama", the second half of TurboStack. 
        ${conversationContext}
        User query: "${message}".
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
      discussion.push({ role: 'groq', content: groqText });

      if (groqText.includes('<terminate>')) {
        finalResponse = groqText.split('<terminate>')[1].split('</terminate>')[0];
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
      const lastOpinion = discussion[discussion.length - 1].content;
      finalResponse = `[TurboStack Limit Reached]: The discussion reached its 5-message limit before a perfect consensus was found. 

Current Synthesis:
${lastOpinion.replace(/<terminate>.*<\/terminate>/g, '')}

Summary of Debate: Gemini and Groq explored the trade-offs but could not fully harmonize within the allocated cycles. The response above represents the most recent coordinated output.`;
      discussion.push({ role: 'gemini', content: "Cycle limit reached. Force-terminating and providing best current synthesis." });
    }

    return NextResponse.json({ discussion, finalResponse });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
