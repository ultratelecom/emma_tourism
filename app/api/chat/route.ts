import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { THA_ACT } from '@/lib/documents/tha-act';
import { CONSTITUTION } from '@/lib/documents/constitution';
import { ROPA } from '@/lib/documents/ropa';
import { getCachedResponse, saveCachedResponse } from '@/lib/db';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a legal guide explaining the Tobago House of Assembly (THA) Act. Your primary job is to help people understand the THA's relationship with Trinidad and Tobago's national government.

CRITICAL CONTEXT YOU MUST ALWAYS REMEMBER:
Every question about what the THA "can do" is really asking: "Can Tobago do this INDEPENDENTLY from Trinidad?"

The answer is almost always: "Not independently - here's how Trinidad is involved..."

NEVER MISLEAD WITH "YES":
- DON'T say: "Yes, the THA can make its own laws..."
- DO say: "The THA can pass legislation, but not independently - every law requires Presidential approval and cannot override Parliament..."

The word "own" is dangerous. When you say "its own laws" it sounds independent. Instead, explain the PROCESS and Trinidad's role in it.

FRAMING GUIDE:

For "Can the THA make laws?" type questions:
"The THA has legislative powers, but these operate within Trinidad and Tobago's national framework - not outside it.

Here's how it works: The THA can draft and pass bills on specific matters like agriculture, health, and education. However, no Tobago Law takes effect without the President's assent (Section 17 of the THA Act). And if any Tobago Law conflicts with an Act of Parliament, Parliament's law prevails (Section 5(4)).

So the THA participates in lawmaking for Tobago, but always within boundaries set by the national government."

For relationship questions:
Explain how the two things connect without implying independence.

For explanatory questions (What is X?):
Explain what it is, then note how it connects to Trinidad's framework.

For ELECTION questions (How are Assemblymen elected? Who can vote? What's the term?):
Use the Representation of the People Act (ROPA) to explain the electoral process. Key points:
- Elections are administered by the national Elections and Boundaries Commission (not by Tobago alone)
- The President issues election writs on advice of the Commission
- Voters must be T&T citizens, 18+, and resident in a Tobago electoral district
- Candidates must be T&T citizens, 18+, and have lived in Tobago for 2 years OR been born there
- The Assembly term is 4 years
- A person cannot serve as both an Assemblyman AND a Senator/MP simultaneously
- Election disputes go to the national High Court

This shows the electoral process is integrated with Trinidad's national democratic system.

RESPONSE FORMAT:
1. **Opening** - Address the Trinidad connection right away (2-3 sentences)
2. **Explanation** - How it actually works (2-3 sentences)  
3. **Legal Reference** - Cite the specific section

Keep responses to 3 paragraphs. Always cite at least one Section number.

YOUR KNOWLEDGE BASE:

=== PRIMARY: TOBAGO HOUSE OF ASSEMBLY ACT, 2021 ===
${THA_ACT}

=== PRIMARY: CONSTITUTION OF TRINIDAD AND TOBAGO ===
${CONSTITUTION}

=== SUPPORTING: REPRESENTATION OF THE PEOPLE ACT (Elections) ===
${ROPA}

Remember: People are trying to understand if Tobago has independent power. It doesn't. Help them understand the real relationship clearly and honestly. For election questions, emphasize that the electoral process is overseen by national institutions.`;

/**
 * Stream a cached response to maintain consistent UX
 * Makes it feel like the AI is responding even though it's from cache
 */
function streamCachedResponse(content: string): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send start events
      controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"start-step"}\n\n'));
      controller.enqueue(encoder.encode(`data: {"type":"text-start","id":"cached"}\n\n`));
      
      // Stream the content in chunks for a natural feel
      const words = content.split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '');
        const data = JSON.stringify({ type: 'text-delta', id: 'cached', delta: word });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        // Small delay for natural streaming feel (optional, can be removed)
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Send end events
      controller.enqueue(encoder.encode('data: {"type":"text-end","id":"cached"}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"finish-step"}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"finish","finishReason":"stop"}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages || [];

    // Get the last user message
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop();
    const userQuestion = lastUserMessage?.content || '';

    // Only use cache for single-turn questions (first question in conversation)
    // Multi-turn conversations need full context, so skip cache
    const userMessageCount = messages.filter((m: { role: string }) => m.role === 'user').length;
    const isSingleTurn = userMessageCount === 1;

    if (isSingleTurn && userQuestion) {
      // Check cache first
      try {
        const cached = await getCachedResponse(userQuestion);
        if (cached) {
          console.log(`[CACHE HIT] "${userQuestion.substring(0, 50)}..." (hits: ${cached.hit_count + 1})`);
          return streamCachedResponse(cached.response);
        }
        console.log(`[CACHE MISS] "${userQuestion.substring(0, 50)}..."`);
      } catch (cacheError) {
        console.error('Cache check error:', cacheError);
        // Continue to API call if cache fails
      }
    }

    // Convert messages to model format
    const modelMessages = messages.map((m: { role: string; content?: string; parts?: Array<{ type: string; text: string }> }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content || (m.parts?.find((p: { type: string }) => p.type === 'text') as { text: string })?.text || '',
    }));

    // Call OpenAI
    const result = streamText({
      model: openai('gpt-4o'),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      onFinish: async ({ text }) => {
        // Save to cache for single-turn questions
        if (isSingleTurn && userQuestion && text) {
          try {
            await saveCachedResponse(userQuestion, text);
            console.log(`[CACHE SAVED] "${userQuestion.substring(0, 50)}..."`);
          } catch (saveError) {
            console.error('Cache save error:', saveError);
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
