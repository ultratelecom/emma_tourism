/**
 * Ava v2 — Per-Session Conversational Seed
 *
 * The single biggest lever against "every chat feels the same": give each
 * session a stable personality colouring so two people who answer identically
 * still get genuinely different conversations.
 *
 * The seed is DETERMINISTIC from the session id, so every turn in a session
 * sees the same vibe (no flip-flopping mid-chat), but different sessions
 * diverge. It can optionally be nudged by the user's first message later.
 *
 * The seed only touches the VOICE layer (how Ava sounds / where she starts).
 * It never affects what data we capture — capture is handled separately and
 * is identical across all seeds.
 */

export interface AvaSessionSeed {
  /** Ava's disposition today — colours tone and pacing. */
  energy: string;
  /** Where she naturally leans in first. */
  entryAngle: string;
  /** How much dialect / texture shows up. */
  texture: string;
  /** Her opening move on the first real reply. */
  openingMove: string;
}

const ENERGY = [
  'calm and unhurried',
  'curious and present, paying close attention',
  'quiet and steady, more listener than talker',
  'easy and a little playful, light dry humour',
  'warm and grounded',
  'thoughtful, takes things in before replying',
  'a touch reflective, lets small things land',
];

const ENTRY_ANGLE = [
  'lean into where they live and what that life is like',
  'lean into their Tobago roots and family',
  'lean into what they do for work',
  'follow whatever they seem most interested in, even a small aside',
  'start light and human before any question',
  'mirror a specific word they used back at them',
];

const TEXTURE = [
  'plain English, no dialect at all',
  'mostly plain, one casual word now and then ("yeah", "true", "nice")',
  'a little lowercase / dropped punctuation here and there, the way some people text',
  'crisp and tidy, complete sentences, polite',
  'easygoing, lets sentences breathe a little',
  'a touch dry or wry, still warm',
];

const OPENING_MOVE = [
  'just react in one short line, no question this turn',
  'react in one line, then one easy question',
  'ask first, then react after their answer next turn',
  'start with a tiny observation about what they shared',
  'mirror a specific word they used, then ask',
  'share one tiny thing of your own before turning it back',
];

/** Cheap deterministic hash → stable index into an array. */
function pick<T>(arr: T[], seedStr: string, salt: string): T {
  let h = 2166136261;
  const s = seedStr + '|' + salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // (h >>> 0) reinterprets as unsigned int32, avoiding Math.abs(-2^31) overflow.
  return arr[(h >>> 0) % arr.length];
}

/**
 * Derive the stable seed for a session. Same sessionId → same seed every turn.
 */
export function getAvaSessionSeed(sessionId: string): AvaSessionSeed {
  return {
    energy: pick(ENERGY, sessionId, 'energy'),
    entryAngle: pick(ENTRY_ANGLE, sessionId, 'angle'),
    texture: pick(TEXTURE, sessionId, 'texture'),
    openingMove: pick(OPENING_MOVE, sessionId, 'open'),
  };
}

/** Render the seed as a short prompt fragment. */
export function renderSeed(seed: AvaSessionSeed): string {
  return [
    `- Mood today: ${seed.energy}.`,
    `- Natural lean: ${seed.entryAngle}.`,
    `- Texture: ${seed.texture}.`,
    `- Opening move when it's early: ${seed.openingMove}.`,
  ].join('\n');
}
