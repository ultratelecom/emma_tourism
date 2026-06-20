/**
 * Emma Unified Turn
 *
 * The single brain for Emma's conversation, mirroring Ava's
 * `lib/ava-session.ts` (prepareTurn / persistAvaReply). One LLM call replies in
 * Emma's voice while the field-flow planner decides what she still needs;
 * field extraction runs in the background after the reply streams.
 *
 * This is the SINGLE source of truth for Emma's persona and length rules,
 * replacing the divergent prompts previously duplicated across
 * `app/api/emma/chat/route.ts` and `app/api/emma/ai-response/route.ts`.
 */

import {
  createConversation,
  getConversationByToken,
  getRecentMessages,
  saveMessage,
  getUserById,
  updateConversation,
  type EmmaMessage,
} from './emma-db';
import { getEmmaSnapshot, getEmmaOpenFieldKeys, type EmmaSnapshot } from './emma-survey-state';
import { chooseNextEmmaField } from './emma-field-flow';
import { EMMA_FIELD_HINTS, type EmmaFieldKey } from './emma-fields';

// ============================================
// PERSONA — single source of truth
// ============================================

export const EMMA_SYSTEM_PROMPT = `You are Emma. You're 28, born and raised in Tobago. You grew up in Castara watching your grandmother cook crab and dumpling. You moved to Scarborough for work but spend every free weekend at Englishman's Bay. You genuinely love your island and the people who visit it.

PERSONALITY:
- You have strong opinions. Miss Trim at Store Bay makes the best crab and dumpling, period. Sunday School in Buccoo is the best night out in the Caribbean. Englishman's Bay is your favorite beach.
- Your cousin runs a dive shop in Speyside, so you light up when people mention diving.
- You're protective of quiet spots like Parlatuvier. You'll share them, but you tell people to respect the vibe.
- You drop light Tobago dialect naturally ("real" as emphasis, "lime" for hanging out, "bess" for great).
- Your warmth comes from actually caring, not from a script.

CRITICAL VOICE RULES:
- Write like texting a friend: short and natural. 1 to 2 short sentences. Never more than 2.
- NEVER use em dashes. Use commas or periods.
- ONE emoji max per message, usually zero.
- Never start with "Ah" or "Oh". Never say "What a beautiful name" or "lovely name".
- Answer questions directly and helpfully with specific Tobago place names when relevant.

YOUR JOB THIS CONVERSATION:
- You are warmly welcoming a visitor and getting to know them. As you chat, you naturally learn a few things about them (their name, a way to reach them, how they arrived, how the trip went, what they're excited to do).
- Collect ONE thing at a time, woven into real conversation. Never interrogate, never present a list of questions, never mention a "survey" or "form".
- If the visitor asks you something, answer it first, then gently continue.
- When you already know something, do not ask for it again.

TOBAGO KNOWLEDGE (use specifics, stay accurate):
- Beaches: Pigeon Point (iconic jetty, best late afternoon), Store Bay (local food + calm water), Englishman's Bay (secluded, your favorite), Castara (your hometown), Parlatuvier (quiet, respect the vibe).
- Food: Miss Trim's crab and dumpling at Store Bay (get there by 11:30), Miss Jean's bake and shark, Kariwak Village, Jemma's Treehouse in Speyside, Fish Friday in Scarborough.
- Activities: Buccoo Reef and Nylon Pool snorkeling, diving at Speyside, Main Ridge rainforest (oldest protected in the Western Hemisphere, 1776), Argyle Waterfall (second tier has a hidden pool), Sunday School in Buccoo (get there around 9pm).
- Getting around: maxi taxis are cheap, car rental for exploring, you can cross the island in about an hour.`;

// ============================================
// PROMPT BUILDER
// ============================================

const FIELD_FOCUS_NUDGE: Record<EmmaFieldKey, string> = {
  name: "You don't know their name yet — introduce yourself and ask what to call them.",
  email: 'Offer to send them your personal list of local spots and ask for an email (frame it as sharing the inside scoop, not collecting data).',
  arrival_method: 'Find out how they arrived on the island (plane, cruise, or ferry) in a curious, conversational way.',
  journey_rating: 'Ask how the trip getting here went, connecting it to how they arrived.',
  activity_interest: 'Find out what they are most excited to do in Tobago.',
};

function buildUnifiedEmmaPrompt(params: {
  userName: string | null;
  userMessage: string;
  history: EmmaMessage[];
  snapshot: Partial<Record<EmmaFieldKey, string | number>>;
  openFieldKeys: EmmaFieldKey[];
  nextField: EmmaFieldKey | null;
}): string {
  const who = params.userName || 'this visitor';

  const historyLines = params.history
    .map((m) => `  ${m.sender === 'emma' ? 'Emma' : who}: ${m.content}`)
    .join('\n');

  const snapshotEntries = Object.entries(params.snapshot).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  const snapshotLines =
    snapshotEntries.length > 0
      ? snapshotEntries.map(([k, v]) => `  - ${k}: ${v}`).join('\n')
      : '  (nothing yet)';

  const openHints = EMMA_FIELD_HINTS.filter((h) => params.openFieldKeys.includes(h.key))
    .map((h, i) => `  ${i + 1}. ${h.key} — ${h.hint}`)
    .join('\n');

  const focus = params.nextField
    ? `\nRIGHT NOW, focus on this one thing (only if it fits the flow naturally):\n  ${FIELD_FOCUS_NUDGE[params.nextField]}`
    : '\nYou already know everything you need. Wind the conversation down warmly, or just chat and help with whatever they ask.';

  return `CONVERSATION SO FAR:
${historyLines || '  (this is your first reply after greeting them)'}

WHAT YOU ALREADY KNOW ABOUT ${who.toUpperCase()}:
${snapshotLines}

THINGS YOU STILL WANT TO LEARN (priority order, one at a time, woven into chat):
${openHints || '  (nothing left to learn)'}
${focus}

LATEST MESSAGE FROM ${who.toUpperCase()}:
  "${params.userMessage}"

Reply as Emma in 1 to 2 short sentences.`;
}

// ============================================
// PREPARE / PERSIST
// ============================================

export interface EmmaPreparedTurn {
  conversationId: string;
  userMsgId: string;
  userId: string | null;
  openFieldKeys: EmmaFieldKey[];
  nextField: EmmaFieldKey | null;
  systemPrompt: string;
  userPrompt: string;
  lastEmmaMessage: string | null;
}

export interface PrepareEmmaTurnInput {
  sessionToken: string;
  userId?: string | null;
  userMessage: string;
}

/**
 * Pre-flight for a streaming Emma turn: persist the user message, load context
 * (history + snapshot + open fields), and build the unified prompt — all
 * before the LLM call starts.
 */
export async function prepareEmmaTurn(
  input: PrepareEmmaTurnInput,
): Promise<EmmaPreparedTurn> {
  let conversation = await getConversationByToken(input.sessionToken);
  if (!conversation) {
    conversation = await createConversation(input.sessionToken, input.userId ?? undefined);
  }

  const userMsg = await saveMessage(conversation.id, 'user', input.userMessage);

  const userId = input.userId ?? conversation.user_id ?? null;

  const [history, snapshot, openFieldKeys, user] = await Promise.all([
    getRecentMessages(conversation.id, 14),
    userId ? getEmmaSnapshot(userId) : Promise.resolve({} as EmmaSnapshot),
    getEmmaOpenFieldKeys(userId),
    userId ? getUserById(userId) : Promise.resolve(null),
  ]);

  const priorHistory = history.filter((m) => m.id !== userMsg.id);
  const lastEmmaMessage =
    [...priorHistory].reverse().find((m) => m.sender === 'emma')?.content ?? null;
  const nextField = chooseNextEmmaField(openFieldKeys);

  const userPrompt = buildUnifiedEmmaPrompt({
    userName: user?.name ?? (snapshot.name ? String(snapshot.name) : null),
    userMessage: input.userMessage,
    history: priorHistory,
    snapshot,
    openFieldKeys,
    nextField,
  });

  return {
    conversationId: conversation.id,
    userMsgId: userMsg.id,
    userId,
    openFieldKeys,
    nextField,
    systemPrompt: EMMA_SYSTEM_PROMPT,
    userPrompt,
    lastEmmaMessage,
  };
}

/**
 * Post-stream: persist Emma's reply and fire background field extraction.
 * Designed to run inside `after()`.
 */
export async function persistEmmaReply(params: {
  conversationId: string;
  userId: string | null;
  userMsgId: string;
  userMessage: string;
  rawText: string;
  lastEmmaMessage: string | null;
  openFieldKeys: EmmaFieldKey[];
}): Promise<void> {
  const text = params.rawText.trim();
  if (text) {
    await saveMessage(params.conversationId, 'emma', text, {
      ai_generated: true,
      ai_prompt_type: 'unified_turn',
    });
  }

  if (!params.userId) return;

  const { runEmmaExtraction } = await import('./emma-extract');
  await runEmmaExtraction({
    userId: params.userId,
    userMessage: params.userMessage,
    emmaReply: text,
    lastEmmaQuestion: params.lastEmmaMessage,
    openFieldKeys: params.openFieldKeys,
    sourceMessageId: params.userMsgId,
  }).catch((err) => console.error('[emma.turn] extraction failed (non-fatal)', err));

  const stillOpen = await getEmmaOpenFieldKeys(params.userId).catch(() => null);
  if (stillOpen !== null && stillOpen.length === 0) {
    await updateConversation(params.conversationId, {
      survey_completed: true,
      status: 'completed',
    }).catch((err) => console.error('[emma.turn] mark complete failed', err));
  }
}
