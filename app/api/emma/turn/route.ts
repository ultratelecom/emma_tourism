/**
 * POST /api/emma/turn — streaming unified turn (mirrors /api/ava/turn)
 *
 * One LLM call streams Emma's reply as plain text. Metadata the client needs
 * immediately (which picker to show, optional GIF cue) travels in custom
 * response headers, readable before the body stream starts. Field extraction
 * + reply persistence run in a background `after()` task.
 *
 * Headers returned:
 *   X-Elicit-Arrival   — arrival-method picker (plane/cruise/ferry)
 *   X-Elicit-Rating    — 1–5 journey rating picker
 *   X-Elicit-Activity  — activity-interest picker
 *   X-Gif-Cue          — optional GIF cue string, or empty
 *   (At most one X-Elicit-* is "1".)
 *
 * Request body: { session_token: string, user_id?: string, message: string }
 */

import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { createTextStreamResponse, streamText } from 'ai';
import { prepareEmmaTurn, persistEmmaReply } from '@/lib/emma-turn';
import { computeStreamElicitationHeaders } from '@/lib/emma-field-flow';

export const maxDuration = 60;

function computeGifCue(message: string, nextField: string | null): string {
  const m = message.toLowerCase();
  if (/\b(bye|goodbye|see you|gotta go|take care|later)\b/.test(m)) return 'farewell';
  if (/\b(thank|thanks|appreciate|cheers)\b/.test(m)) return 'thanks';
  if (/\b(dive|diving|snorkel|reef|speyside|nylon pool)\b/.test(m)) return 'diving';
  if (/\b(beach|pigeon point|store bay|englishman|swimming|sand)\b/.test(m)) return 'beach';
  if (/\b(hike|waterfall|argyle|rainforest|main ridge|nature|trail)\b/.test(m)) return 'nature';
  if (/\b(party|nightlife|sunday school|fete|lime|rum)\b/.test(m)) return 'nightlife';
  if (/\b(food|eat|crab|dumpling|roti|doubles|bake and shark)\b/.test(m)) return 'food';
  if (/\b(disappointed|terrible|awful|problem|frustrated|worst|scam)\b/.test(m)) return 'empathy';
  if (nextField === 'name') return 'hey_there';
  return '';
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const session_token = typeof body.session_token === 'string' ? body.session_token : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id : null;
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!session_token || !message) {
    return NextResponse.json(
      { error: 'session_token and message are required' },
      { status: 400 },
    );
  }

  let prepared;
  try {
    prepared = await prepareEmmaTurn({
      sessionToken: session_token,
      userId: user_id,
      userMessage: message,
    });
  } catch (err) {
    console.error('[emma/turn] prepareEmmaTurn failed:', err);
    return NextResponse.json({ error: 'turn_setup_failed' }, { status: 500 });
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: prepared.systemPrompt,
    prompt: prepared.userPrompt,
    temperature: 0.7,
  });

  after(async () => {
    try {
      const fullText = await result.text;
      await persistEmmaReply({
        conversationId: prepared.conversationId,
        userId: prepared.userId,
        userMsgId: prepared.userMsgId,
        userMessage: message,
        rawText: fullText,
        lastEmmaMessage: prepared.lastEmmaMessage,
        openFieldKeys: prepared.openFieldKeys,
      });
    } catch (err) {
      console.error('[emma/turn] after() persist failed:', err);
    }
  });

  const elicit = computeStreamElicitationHeaders(prepared.openFieldKeys);

  return createTextStreamResponse({
    textStream: result.textStream,
    headers: {
      'X-Elicit-Arrival': elicit.elicitArrival,
      'X-Elicit-Rating': elicit.elicitRating,
      'X-Elicit-Activity': elicit.elicitActivity,
      'X-Gif-Cue': computeGifCue(message, prepared.nextField),
    },
  });
}
