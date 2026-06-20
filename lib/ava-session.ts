/**
 * Ava Session Orchestrator
 *
 * Runs one turn of a conversation end to end:
 *
 *   1. Write the user's message to ava_messages.
 *   2. Pick the best current chapter based on what's still open in the
 *      user's profile.
 *   3. Build the context block (conversation state + recent history +
 *      callback hints + open fields).
 *   4. Fire two parallel model calls:
 *         - chat (visible reply, fast model)
 *         - extraction (hidden structured pass, reasoning model)
 *   5. Persist Ava's reply as a message.
 *   6. Apply the extraction result into the profile (fields, entities, notes).
 *   7. Update chapter on the session if the chapter changed.
 *
 * Also handles opening/resuming a session:
 *   - new users: create ava_users + ava_session + write the deterministic
 *     opener as turn 0.
 *   - returning users: reuse their latest active session or open a new one
 *     and craft a callback-aware "welcome back" opener from past data.
 *
 * This module is pure server-side logic. It does NOT know about HTTP.
 * The API routes wrap it.
 */

import { generateText } from 'ai';
import { runSimpleExtraction } from './ava-extract-simple';
import { syncApplyPickerProfileIfExact } from './ava-picker-sync';
import { chooseNextRequiredField, isAvaSurveyEffectivelyComplete } from './ava-graph/field-flow';
import {
  AVA_CHAPTERS,
  AVA_CONVERSATION_ROUTES,
  AVA_EXTRACTION_OUTPUT_ADDENDUM,
  AVA_UNIFIED_PROFILE_FIELD_HINTS,
  AVA_PERSONALITY,
  AVA_PROFILE_FIELDS,
  AVA_SYSTEM_PROMPT,
  getAvaChapterById,
} from './ava-config';
import { getAvaChatModel } from './ava-model';
import type { ExtractedProfileUpdate, ExtractionResult } from './ava-extract';
import { postProcessAvaReply } from './ava-voice';
import { AVA_PROMPT_VERSION, formatAvaTurnPlan, type AvaTurnPlan } from './ava-turn-planner';
import { runAvaGraphDecision } from './ava-graph/graph';
import {
  applyExtractionResult,
  createAvaSession,
  createAvaUser,
  getAvaUserByEmail,
  getAvaUserById,
  getEntities,
  getFullSessionHistory,
  getLatestActiveSession,
  getNextTurnIndex,
  getNotes,
  getOpenFieldKeys,
  getProfileSnapshot,
  getRecentMessages,
  insertAvaMessage,
  insertUserMessage,
  setSessionChapter,
  setSessionStatus,
  touchAvaUser,
  type AvaMessage,
  type AvaSession,
  type AvaUser,
} from './ava-db';

// ============================================
// TYPES
// ============================================

export interface OpenSessionInput {
  name: string;
  email?: string | null;
}

export interface OpenSessionResult {
  user: AvaUser;
  session: AvaSession;
  opener_message: AvaMessage;
  is_returning: boolean;
}

export interface RunTurnInput {
  sessionId: string;
  userId: string;
  userMessage: string;
}

export interface RunTurnResult {
  reply: string;
  reply_message_id: string;
  turn_index: number;
  chapter_id: string;
  chapter_changed: boolean;
  chat_latency_ms: number;
  prompt_version: string;
  turn_plan: AvaTurnPlan | null;
  reply_quality: {
    ok: boolean;
    issues: string[];
    retried: boolean;
  };
  allow_gif: boolean;
  /** GIF cue chosen by the LLM based on the conversation tone. */
  gif_cue: string | null;
  /**
   * Resolves once captured profile fields have been written to the DB.
   * API routes should use `after(() => result.finalize)` so the user gets
   * their reply without waiting on the DB write.
   */
  finalize: Promise<ExtractionFinalizeSummary>;
}

export interface ExtractionFinalizeSummary {
  extraction_latency_ms: number;
  extraction_parse_ok: boolean;
  profile_fields_written: number;
  entities_written: number;
  notes_written: number;
  profile_completion: number;
}

// ============================================
// SESSION OPEN / RESUME
// ============================================

const CHAT_MODEL_TIMEOUT_MS = 3500;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label}_timeout_${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Open a new session or resume the latest active one.
 *
 * - If email is provided and matches an existing ava_user, reuse that user.
 * - Otherwise create a fresh ava_user under the given name.
 * - Always write the deterministic opener as turn 0 (sender='ava',
 *   is_system_delivered=true), so the chat model is never asked to
 *   produce it. For returning users the opener is a callback-aware
 *   welcome back rather than the generic first-time line.
 */
export async function openOrResumeSession(
  input: OpenSessionInput,
): Promise<OpenSessionResult> {
  // 1. Resolve user
  let user: AvaUser | null = null;
  let is_returning = false;

  if (input.email) {
    user = await getAvaUserByEmail(input.email);
  }

  if (user) {
    is_returning = true;
    await touchAvaUser(user.id);
  } else {
    user = await createAvaUser({ name: input.name, email: input.email ?? null });
  }

  // 2. Resolve session (reuse latest active, or open a new one)
  let session = await getLatestActiveSession(user.id);
  if (!session) {
    session = await createAvaSession({
      userId: user.id,
      initialChapterId: 'introductions',
    });
  }

  // 3. Determine the opener content
  const openerContent = is_returning
    ? await buildReturningOpener(user)
    : AVA_PERSONALITY.opening_line;

  // 4. Write the opener as turn 0 (system-delivered)
  const turn_index = await getNextTurnIndex(session.id);
  const opener_message = await insertAvaMessage({
    sessionId: session.id,
    userId: user.id,
    content: openerContent,
    turnIndex: turn_index,
    isSystemDelivered: true,
    chapterId: session.current_chapter_id ?? 'introductions',
  });

  return { user, session, opener_message, is_returning };
}

/**
 * Build a callback-aware opener for a returning user. Pulls the most
 * recent note or entity as a thread to lead with. Falls back to the
 * generic opener if there's nothing to call back to yet.
 */
async function buildReturningOpener(user: AvaUser): Promise<string> {
  // Preferred: a recent note gives richest texture
  const notes = await getNotes(user.id, 3);
  if (notes.length) {
    const note = notes[0];
    return `${user.name}, good to see you again. Last time I was thinking about what you said — ${truncate(
      note.content,
      120,
    )}. Where are we picking up?`;
  }

  // Fallback: a place or person they named
  const entities = await getEntities(user.id, { limit: 5 });
  const place = entities.find((e) => e.kind === 'place');
  if (place) {
    return `${user.name}, welcome back. Been thinking about ${place.name} since we spoke. How have you been?`;
  }

  // Nothing to call back to yet
  return `${user.name}, welcome back. Good to hear from you again.`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s.replace(/[.!?]+$/, '');
  return s.slice(0, max).replace(/\s+\S*$/, '').replace(/[.!?,;:]+$/, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function safeRead<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (err) {
    console.warn(`[ava.safeRead] ${label} failed, using fallback`, err);
    return fallback;
  }
}

/**
 * @deprecated — dead code kept for reference. The unified LLM call in runTurn()
 * replaced these helpers. Remove in a follow-up cleanup pass.
 */
function fallbackAvaReplyForModelFailure(
  turnPlan: AvaTurnPlan,
  openFieldKeys: string[],
): string {
  const nextQ = fallbackNextQuestion(turnPlan.next_best_question_focus, openFieldKeys);

  if (turnPlan.moment_type === 'life_decision') {
    return nextQ
      ? `I hear you on that. Good that you made space for yourself. ${nextQ}`
      : 'I hear you on that. Good that you made space for yourself. What were you hoping to find when you made that move?';
  }
  if (turnPlan.moment_type === 'career_achievement') {
    const named = turnPlan.specifics_to_name[0];
    const ack = named ? `${named}, solid.` : 'Got it.';
    return nextQ ? `${ack} ${nextQ}` : `${ack} What kind of work fills most of your time these days?`;
  }
  if (turnPlan.moment_type === 'question_to_ava') {
    return nextQ
      ? `Good question — I'm here to understand your Tobago story. ${nextQ}`
      : "Good question — I'm here just to understand your Tobago story through conversation.";
  }
  // Default: always advance — no "keep it easy", no dead ends.
  return nextQ ? `Got it. ${nextQ}` : 'Got it. What part of Tobago do your roots come from?';
}

/**
 * Pick the best next-question string for a fallback reply.
 * Checks the planner's declared focus first, then walks the required
 * field order. Returns null only when the profile is genuinely complete.
 */
function fallbackNextQuestion(
  focus: string | null,
  openFieldKeys: string[],
): string | null {
  const FOCUS_MAP: Record<string, string> = {
    'their Tobago roots / generation':
      'How far back does your Tobago side go — born there or parents, grandparents?',
    'where in the world they are based now':
      'Where in the world are you based?',
    'whether they lived in or visited Tobago, and how often they return':
      'Did you ever live in Tobago yourself, or mostly visit?',
    'their work / what fills their days':
      'What kind of work are you in these days?',
    'their specific role, company, or kind of work':
      'What kind of work are you in these days?',
    connection_score:
      "On a gut level, how tuned in are you to what's happening in Tobago these days?",
    contribution_modes:
      'If the runway was there, what would you want to give back to Tobago — time, knowledge, money, reach?',
    invest_intent:
      'Would you ever put money behind something in Tobago, or is that not your lane?',
    barriers:
      "What's the biggest thing in the way of contributing more to Tobago?",
    feature_priorities:
      'If there was an online space built for the diaspora, what would make it useful enough to actually come back to?',
    trust_text:
      'What would it take for you to truly trust a platform like this?',
    future_roles:
      'Would you want in on anything future-facing — advisory, surveys, pilots, or rather just stay informed?',
    opportunity_text:
      "Last one — where do you see the real opportunity for Tobago's economic growth?",
  };
  if (focus && FOCUS_MAP[focus]) return FOCUS_MAP[focus];

  const FIELD_QUESTIONS: Partial<Record<string, string>> = {
    current_location_text: 'Where in the world are you based?',
    generation: 'How far back does your Tobago side go — born there or parents, grandparents?',
    visit_frequency: 'How often do you make it back to Tobago?',
    industry: 'What kind of work are you in these days?',
    profession_text: 'What kind of work are you in these days?',
    connection_score: "On a gut level, how tuned in are you to what's happening in Tobago?",
    contribution_modes: 'What would you want to give back to Tobago if the runway was there?',
    invest_intent: 'Would you ever put money behind something in Tobago?',
    barriers: "What's the biggest thing in the way of contributing more?",
    feature_priorities: 'What would make an online diaspora space useful enough for you to return to?',
    trust_text: 'What would it take for you to truly trust a platform like this?',
    future_roles: 'Would you want in on any future initiatives?',
    opportunity_text: "Where's Tobago's real shot at economic growth, in your eyes?",
  };
  const RECOVERY_ORDER = [
    'current_location_text', 'generation', 'visit_frequency', 'industry',
    'connection_score', 'contribution_modes', 'invest_intent',
    'barriers', 'feature_priorities', 'trust_text', 'future_roles', 'opportunity_text',
  ];
  const nextField = RECOVERY_ORDER.find((f) => openFieldKeys.includes(f));
  if (nextField && FIELD_QUESTIONS[nextField]) return FIELD_QUESTIONS[nextField]!;
  return null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'you';
}

function cleanShortAnswer(answer: string): string {
  return answer.trim().replace(/[.!?]+$/, '');
}

// ============================================
// PERSONALITY: NAME REACTIONS
// ============================================

const NAME_REACTION_POOL = [
  'Love that name!',
  'Oh wow, amazing name.',
  'I love that name.',
  "Beautiful name.",
  "Strong name.",
  "Oh, what a name!",
  "Great name.",
  "That's a name that carries weight.",
  "Oh nice — that's a real name.",
  "Biblical name, real name.",
  "That's a strong one.",
];

function pickNameReaction(): string {
  return NAME_REACTION_POOL[Math.floor(Math.random() * NAME_REACTION_POOL.length)];
}

// ============================================
// PERSONALITY: LOCATION QUIPS
// ============================================

// Southern hemisphere countries — their seasons are inverted vs. north.
const SOUTHERN_HEMISPHERE_KEYS = new Set([
  'australia', 'new zealand', 'south africa', 'argentina',
  'brazil', 'chile', 'peru', 'colombia', 'ecuador',
]);

// Season index: 0 = winter (Dec–Feb NH), 1 = spring (Mar–May NH),
//               2 = summer (Jun–Aug NH), 3 = fall (Sep–Nov NH).
// Southern hemisphere countries get this index shifted +2 (mod 4).
type SeasonQuips = [string, string, string, string];

const LOCATION_QUIPS: Record<string, SeasonQuips> = {
  canada: [
    "Cold up there — hope the heating is doing its job.",
    "Spring finally coming in up there?",
    "Canada in the summer is really something.",
    "Beautiful time of year up there.",
  ],
  'united states': [
    "How is it treating you over there?",
    "Spring in the US — nice time of year.",
    "Summer in the States, you're getting the best of it.",
    "Fall in the US is something else.",
  ],
  usa: [
    "How is it treating you over there?",
    "Spring in the US — nice time of year.",
    "Summer in the States, you're getting the best of it.",
    "Fall in the US is something else.",
  ],
  'new york': [
    "New York in the winter is something else entirely.",
    "Spring in New York — the city must be buzzing right now.",
    "New York in the summer, nothing like it.",
    "Fall in New York is gorgeous.",
  ],
  brooklyn: [
    "Brooklyn in winter can be cold cold.",
    "Brooklyn in spring — the whole neighbourhood must be coming alive.",
    "Brooklyn in the summer, that heat on the pavement.",
    "Brooklyn in fall — beautiful season for it.",
  ],
  london: [
    "London in the winter is grey and moody — do you love it or hate it?",
    "Spring in London is gorgeous, the parks must be beautiful right now.",
    "London summer — short but everyone makes the most of it!",
    "Autumn in London — those parks in October must be stunning.",
  ],
  uk: [
    "UK winters, I don't know how you do it!",
    "Getting a bit of spring sunshine over there?",
    "UK summer — short but sweet, I hear.",
    "Autumn in the UK must be beautiful with all those leaves.",
  ],
  'united kingdom': [
    "UK winters, I don't know how you do it!",
    "Getting a bit of spring sunshine over there?",
    "UK summer — short but sweet, I hear.",
    "Autumn in the UK must be beautiful with all those leaves.",
  ],
  england: [
    "England in winter — grey but charming.",
    "Spring in England — finally getting some sunshine?",
    "English summer — the barbecues must be out!",
    "Autumn in England is something special.",
  ],
  toronto: [
    "Toronto in the winter is serious — how are you managing the cold?",
    "Spring in Toronto, people must be outside the minute the sun shows.",
    "Toronto summer is beautiful.",
    "Fall in Toronto must be gorgeous with all those colours.",
  ],
  australia: [
    "Australian summer — the heat must be intense right now!",
    "Cooling off a bit heading into autumn down there?",
    "Australian winter — still warmer than most places!",
    "Spring down under — everything must be blooming.",
  ],
  'new zealand': [
    "New Zealand summer — gorgeous time to be there.",
    "Autumn in New Zealand — one of the most beautiful places for it.",
    "New Zealand winter — how cold does it get where you are?",
    "Spring in New Zealand — must be absolutely beautiful.",
  ],
  germany: [
    "Germany in winter — cold and cozy, I imagine.",
    "Spring in Germany must be beautiful.",
    "German summer — do you get out to the countryside?",
    "Autumn in Germany is beautiful, all that colour.",
  ],
  france: [
    "France in winter — cold but gorgeous, I bet.",
    "Spring in France — must be looking incredible right now.",
    "French summer — everything is buzzing over there.",
    "Autumn in France — beautiful season to be there.",
  ],
  paris: [
    "Paris in winter — cold but still one of the most beautiful cities.",
    "Paris in spring — oh wow, that must be gorgeous right now.",
    "Paris in summer — the whole city comes alive.",
    "Paris in autumn — beautiful season to be there.",
  ],
  dubai: [
    "Dubai right now — cooler season, actually one of the best times to be there!",
    "Dubai in spring — before the real heat kicks in.",
    "Dubai summer — that heat is intense. How do you manage it?",
    "Dubai in autumn — starting to cool down a bit, right?",
  ],
  netherlands: [
    "Netherlands in winter — cycling in the cold, respect.",
    "Spring in the Netherlands — tulip season, must be incredible!",
    "Dutch summer — making the most of every sunny day, I imagine.",
    "Autumn in the Netherlands is beautiful.",
  ],
  amsterdam: [
    "Amsterdam in winter — cold but alive.",
    "Spring in Amsterdam — the canals and the flowers must be something else.",
    "Amsterdam in summer is magical, I hear.",
    "Autumn in Amsterdam, beautiful.",
  ],
  sweden: [
    "Sweden in winter — serious cold and serious darkness, respect.",
    "Swedish spring — after that winter, every sunny day must feel like a gift.",
    "Swedish summer, the long days — must be incredible.",
    "Autumn in Sweden must be gorgeous.",
  ],
  norway: [
    "Norway in winter — the Northern Lights must be something.",
    "Norwegian spring — finally coming out of the long night.",
    "Norwegian summer with those endless days.",
    "Autumn in Norway — beautiful with all the colours.",
  ],
  ireland: [
    "Ireland in winter — lots of rain but cosy indoors?",
    "Irish spring — getting a bit of sunshine finally?",
    "Irish summer — short but everyone makes the most of it.",
    "Autumn in Ireland is genuinely beautiful.",
  ],
  japan: [
    "Japan in winter — do you get snow where you are?",
    "Spring in Japan — cherry blossom season! Are you catching any of it?",
    "Japanese summer — hot and humid, but the festivals must be amazing.",
    "Autumn in Japan — the fall colours must be incredible.",
  ],
  trinidad: [
    "Trinidad — practically next door! How is the vibe on the island?",
    "T&T in spring — Carnival just passed, the island must be recovering!",
    "Trinidad in the summer — the heat and the rain.",
    "T&T in the autumn — drying out a bit?",
  ],
  'trinidad and tobago': [
    "Right in the Caribbean heat! How is home feeling?",
    "Carnival season just passed — the island must be winding down.",
    "T&T in the summer — rainy season coming in.",
    "T&T in the autumn — drying out a bit?",
  ],
};

/**
 * Get a seasonal/cultural quip for the given location string.
 * Returns null if no known match.
 */
function getLocationQuip(place: string): string | null {
  if (!place) return null;
  const lower = place.toLowerCase().trim();

  // Month → season index (northern hemisphere baseline)
  const month = new Date().getMonth(); // 0–11
  let seasonIdx: 0 | 1 | 2 | 3;
  if (month <= 1 || month === 11) seasonIdx = 0;      // Dec–Feb
  else if (month <= 4) seasonIdx = 1;                 // Mar–May
  else if (month <= 7) seasonIdx = 2;                 // Jun–Aug
  else seasonIdx = 3;                                 // Sep–Nov

  const keys = Object.keys(LOCATION_QUIPS);
  for (const key of keys) {
    if (lower === key || lower.includes(key) || key.includes(lower)) {
      const quips = LOCATION_QUIPS[key];
      if (SOUTHERN_HEMISPHERE_KEYS.has(key)) {
        seasonIdx = ((seasonIdx + 2) % 4) as 0 | 1 | 2 | 3;
      }
      return quips[seasonIdx];
    }
  }
  return null;
}

function fastReplyForTurnPlan(
  turnPlan: AvaTurnPlan,
  userName: string,
  userMessage: string,
  openFieldKeys: string[],
): string | null {
  if (turnPlan.next_best_question_focus === 'profile complete / graceful close') {
    return 'I have a much better sense of you now. The way you spoke about where you are, your Tobago roots, and what you would want to see for the island gives me plenty to hold onto.';
  }

  // Onboarding safety net: a short, plain-text reply during the early
  // location or roots phase is almost always the user answering the
  // question just asked — not a random aside. If the turn planner
  // missed it (wrong phrasing in last Ava message, etc.), apply the
  // deterministic template here so the LLM is never called for this
  // and a timeout can never cause a dead-end "keep it easy" response.
  if (
    turnPlan.moment_type === 'short_reply' &&
    /^[A-Za-z ,.'()\-]+$/.test(userMessage.trim())
  ) {
    const answer = cleanShortAnswer(userMessage);
    if (openFieldKeys.includes('current_location_text')) {
      const quip = getLocationQuip(answer);
      const locReaction = quip ?? `${answer}, got it.`;
      return `${locReaction} How far back does your Tobago side go — were you born there or is it parents, grandparents?`;
    }
    if (openFieldKeys.includes('generation') && !openFieldKeys.includes('current_location_text')) {
      return 'Got it. Did you ever live in Tobago yourself, or mostly visit growing up?';
    }
  }

  if (turnPlan.moment_type === 'logistical_answer') {
    const answer = cleanShortAnswer(userMessage);
    if (turnPlan.next_best_question_focus === 'their work / what fills their days') {
      return 'Got you. What kind of work are you in these days?';
    }
    if (
      turnPlan.next_best_question_focus ===
      'whether they lived in or visited Tobago, and how often they return'
    ) {
      return 'That helps me place it. Did you ever live in Tobago yourself, or mostly visit?';
    }
    if (turnPlan.next_best_question_focus === 'their Tobago roots / generation') {
      const place = turnPlan.specifics_to_name[0] ?? answer;
      const quip = getLocationQuip(place);
      const locReaction = quip ?? `${place}, got it.`;
      return `${locReaction} How far back does your Tobago side go — were you born there or is it parents, grandparents?`;
    }
    const nameReaction = pickNameReaction();
    return `${nameReaction} Where are you based — what part of the world are you in?`;
  }
  if (turnPlan.reply_shape === 'recover_to_profile_ask') {
    switch (turnPlan.next_best_question_focus) {
      case 'connection_score':
        return "That gives me the picture. On a gut level, how tuned in are you to what's happening in Tobago these days?";
      case 'contribution_modes':
        return 'That gives me enough on the work side. If the runway was there, what would you actually want to give back to Tobago, time, knowledge, money, reach, or something else?';
      case 'invest_intent':
        return 'That helps. Would you ever put money behind something in Tobago, or is that not really your lane?';
      case 'barriers':
        return "Got it. What's the biggest thing that would stop you from contributing more to Tobago, information, trust, time, distance, or something else?";
      case 'feature_priorities':
        return 'That gives me enough context. If there was an online home for the diaspora, what would make it useful enough for you to actually come back to?';
      case 'trust_text':
        return 'That gives me the work picture. What would it take for you to trust a platform like this, truly?';
      case 'future_roles':
        return 'Got it. Would you want to be involved in anything future-facing, advisory, virtual meetings, surveys, pilots, or would you rather just stay informed?';
      case 'opportunity_text':
        return "Last big one, no rush. In your eyes, where is Tobago's real opportunity for economic growth?";
      case 'age_bracket':
        return "That gives me enough there. Mind me asking a rough decade you're in, 20s, 30s, 40s?";
      case 'gender':
        return 'And how do you identify, he, she, they, something else?';
      case 'education_level':
        return "Where did you train for what you do, what's your background academically?";
      default:
        return 'That gives me enough context there. What feels most important to you about staying connected to Tobago now?';
    }
  }
  return null;
}

type OpenAIReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

function reasoningEffortForTurnPlan(turnPlan: AvaTurnPlan): OpenAIReasoningEffort {
  if (turnPlan.moment_type === 'logistical_answer' || turnPlan.moment_type === 'short_reply') {
    return 'low';
  }
  if (turnPlan.moment_type === 'question_to_ava') return 'low';
  if (turnPlan.moment_type === 'career_achievement') return 'high';
  if (
    turnPlan.moment_type === 'life_decision' ||
    turnPlan.moment_type === 'pain_or_frustration' ||
    turnPlan.moment_type === 'trust_concern'
  ) {
    return 'xhigh';
  }
  return 'medium';
}

// ============================================
// OPEN-INTENT HINTS
// ============================================

/**
 * Short factual descriptions of what each profile field represents.
 * Deliberately NOT a natural-language prompt — the model should phrase
 * the question in Ava's voice, not recite these. See buildContextBlock.
 */
const OPEN_INTENT_HINTS: Record<string, string> = {
  age_bracket: 'rough age bracket (only ask if still empty at the end, softly)',
  gender: 'how they identify (soft — infer if possible)',
  education_level: 'highest level of education (infer from career context)',
  generation: 'how many generations back their Tobago roots go (1st, 2nd, 3rd, 4th+)',
  current_location_text: 'where they say they live now, exactly as they say it',
  current_city_region: 'city / state / province / borough / region if mentioned',
  current_country: 'country they currently reside in; infer only when location is unambiguous',
  industry: 'broad field of work (health, finance, tech, trades, education, etc.)',
  profession_text: 'specific role, employer, title, or specialism, free-form',
  visit_frequency: 'how often they get back to Tobago',
  connection_score: 'how strongly they want to stay connected to Tobago (1–5 scale)',
  contribution_modes: 'ways they might want to give back (investment, mentorship, advisory, etc.)',
  invest_intent: 'open to investing in Tobago (yes / maybe / no)',
  invest_sectors: 'which sectors interest them if yes/maybe',
  barriers: 'what blocks them from contributing — info gap, trust, distance, time, etc.',
  feature_priorities: 'what features they would actually use on a diaspora platform',
  trust_text: 'what would make them trust the platform (free-form)',
  future_roles: 'what they would say yes to (advisory, surveys, meetings, pilots)',
  opportunity_text: 'their take on the biggest opportunity for Tobago (free-form)',
};

// Heuristic: is the user's message a short aside / off-script rather
// than an attempt to answer anything? We use this to inject a nudge
// telling Ava to respond to the message itself, not advance the script.
function isShortOrOffScript(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length <= 15) return true;
  const lower = trimmed.toLowerCase();
  const offScriptCues = [
    /^(hmm|ok|okay|sure|right|yeah|nah|no)\b/,
    /^(i am|im|i'm)\s+(good|fine|ok|okay|alright|tired|blessed|cool)\b/,
    /^(why|how come|who are you|what|hold on|wait)\b/,
    /\?$/, // they asked ava a question
  ];
  return offScriptCues.some((re) => re.test(lower));
}

/**
 * Extract the concrete, named things the user just dropped into their
 * message — the stuff Ava MUST name back instead of zooming out to the
 * category. Returns a small bag of strings the just-in-time nudge can
 * quote to the model. Keep this conservative: if in doubt, leave a
 * noun out. A false positive here turns into a nudge the model can't
 * satisfy, which is worse than no nudge.
 *
 * Buckets:
 *   - known_companies: brand names the model should recognise as big
 *     employers and react to with earned pride
 *   - titled_caps: other capitalised nouns after the first word of a
 *     sentence (likely proper nouns — universities, neighbourhoods,
 *     people, brands we don't hardcode)
 *   - roles: common job titles in plain lowercase that still deserve
 *     a specific ack ("nurse", "teacher", "consultant")
 *   - numeric_facts: numbers paired with a year/generation/kid count
 *     ("twelve years", "three kids", "four generations") — these are
 *     texture we should acknowledge without converting to pseudo-warmth.
 */
function detectSpecifics(message: string): {
  known_companies: string[];
  titled_caps: string[];
  roles: string[];
  numeric_facts: string[];
} {
  const out = {
    known_companies: [] as string[],
    titled_caps: [] as string[],
    roles: [] as string[],
    numeric_facts: [] as string[],
  };

  // --- Known companies / institutions (case-insensitive). The list is
  // deliberately tight — brands a Tobago person would actually
  // recognise as "Trini making it abroad" weight.
  const KNOWN_COMPANIES = [
    'verizon', 'at&t', 'comcast', 'spectrum', 'google', 'alphabet',
    'meta', 'facebook', 'instagram', 'apple', 'amazon', 'aws', 'microsoft',
    'netflix', 'ibm', 'oracle', 'salesforce', 'cisco', 'intel', 'nvidia',
    'tesla', 'spacex', 'uber', 'lyft', 'airbnb', 'stripe', 'shopify',
    'openai', 'anthropic', 'deepmind', 'bloomberg', 'reuters',
    'goldman sachs', 'morgan stanley', 'jpmorgan', 'jp morgan', 'citi',
    'citibank', 'bank of america', 'wells fargo', 'deutsche bank',
    'barclays', 'hsbc', 'chase', 'american express',
    'deloitte', 'pwc', 'ey', 'kpmg', 'mckinsey', 'bain', 'bcg', 'accenture',
    'mount sinai', 'nyu', 'columbia', 'harvard', 'yale', 'princeton',
    'mit', 'stanford', 'brown', 'cornell', 'johns hopkins', 'nypd', 'fdny',
    'un', 'united nations', 'world bank', 'imf',
    'bp', 'shell', 'exxon', 'chevron', 'total',
    'nestle', 'unilever', 'pfizer', 'j&j', 'johnson & johnson',
    'disney', 'warner', 'hbo', 'sony', 'universal',
  ];
  const lower = message.toLowerCase();
  for (const brand of KNOWN_COMPANIES) {
    if (new RegExp(`\\b${escapeRegExp(brand)}\\b`, 'i').test(lower)) {
      // canonicalise display: title-case brand strings like "mount sinai"
      out.known_companies.push(
        brand
          .split(' ')
          .map((w) =>
            w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toUpperCase(),
          )
          .join(' '),
      );
    }
  }

  // --- Capitalised proper nouns that aren't at the start of a sentence.
  // We split on .!? boundaries and scan each sentence's non-first
  // capitalised tokens. Skip "I" and one-letter tokens.
  const sentences = message.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const tokens = s.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i].replace(/[^A-Za-z'&-]/g, '');
      if (t.length < 2) continue;
      if (t === 'I') continue;
      if (/^[A-Z][A-Za-z'&-]+$/.test(t)) {
        out.titled_caps.push(t);
      }
    }
  }

  // --- Role words (lowercase forms a person is likely to describe
  // themselves as). Matches "I am a nurse" / "I'm a consultant" style.
  const ROLE_WORDS = [
    'nurse', 'doctor', 'teacher', 'lecturer', 'professor', 'engineer',
    'consultant', 'analyst', 'accountant', 'lawyer', 'attorney', 'banker',
    'architect', 'designer', 'developer', 'programmer', 'researcher',
    'manager', 'director', 'founder', 'ceo', 'cto', 'cfo', 'chef',
    'electrician', 'plumber', 'mechanic', 'carpenter', 'contractor',
    'pastor', 'priest', 'social worker', 'therapist', 'psychologist',
    'pharmacist', 'dentist', 'midwife', 'surgeon', 'paramedic',
    'firefighter', 'officer', 'soldier', 'pilot', 'driver',
    'writer', 'journalist', 'producer', 'artist', 'musician', 'photographer',
    'trader', 'investor', 'realtor', 'agent',
    'student', 'phd', 'postdoc',
  ];
  for (const role of ROLE_WORDS) {
    if (new RegExp(`\\b${escapeRegExp(role)}\\b`, 'i').test(lower)) {
      out.roles.push(role);
    }
  }

  // --- Numeric facts paired with temporal / life nouns.
  const numericPatterns: RegExp[] = [
    /\b(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s+(year|years|yrs|month|months|kid|kids|child|children|sister|sisters|brother|brothers|generation|generations)\b/gi,
  ];
  for (const re of numericPatterns) {
    const matches = lower.match(re);
    if (matches) out.numeric_facts.push(...matches);
  }

  // Dedupe + cap each list so a very chatty message doesn't produce a
  // giant nudge paragraph.
  const dedupe = (xs: string[]) => Array.from(new Set(xs)).slice(0, 5);
  return {
    known_companies: dedupe(out.known_companies),
    titled_caps: dedupe(out.titled_caps),
    roles: dedupe(out.roles),
    numeric_facts: dedupe(out.numeric_facts),
  };
}

// ============================================
// CHAPTER ROUTING
// ============================================

/**
 * Pick the chapter the conversation should be in right now. Strategy:
 * walk the chapters in order; return the first one that still has open
 * intent fields. If every chapter is fully filled/declined, return the
 * last chapter (tomorrow) and the caller can treat the session as
 * effectively complete.
 */
async function pickCurrentChapter(userId: string): Promise<{
  chapterId: string;
  openFieldKeys: string[];
}> {
  const allOpenKeys = await safeRead(
    'getOpenFieldKeys',
    getOpenFieldKeys(userId),
    Object.keys(AVA_PROFILE_FIELDS),
  );
  const directOpenKeys = allOpenKeys.filter((key) => {
    const spec = AVA_PROFILE_FIELDS[key];
    // Soft + companion fields are never asked directly, so they don't keep a
    // chapter "open" for elicitation purposes.
    return spec && spec.elicitation !== 'soft' && spec.elicitation !== 'companion';
  });
  const directOpen = new Set(directOpenKeys);

  for (const chapter of AVA_CHAPTERS) {
    const openHere = chapter.intents.filter((k) => directOpen.has(k));
    if (openHere.length > 0) {
      // Return all direct open fields, not just the current chapter's.
      // Recovery logic needs global visibility so after a work answer it
      // can move to connection/contribution instead of getting trapped
      // in soft demographics from the "who you are" chapter.
      return { chapterId: chapter.id, openFieldKeys: directOpenKeys };
    }
  }

  const last = AVA_CHAPTERS[AVA_CHAPTERS.length - 1];
  return { chapterId: last.id, openFieldKeys: allOpenKeys };
}

// ============================================
// CONTEXT BLOCK
// ============================================

/**
 * Build the per-turn context block the chat model sees. Injects:
 *   - which chapter we're in, what the remaining intents are
 *   - the last ~8 turns of conversation
 *   - one or two callback hints mined from notes/entities
 *   - a compact profile snapshot (filled fields only)
 */
async function buildContextBlock(params: {
  userId: string;
  userName: string;
  sessionId: string;
  chapterId: string;
  openFieldKeys: string[];
  userMessage: string;
  turnIndex: number;
}): Promise<{
  contextBlock: string;
  turnPlan: AvaTurnPlan;
  forcedReply: string | null;
  allowGif: boolean;
  lastAvaMessage: string | null;
}> {
  const chapter = getAvaChapterById(params.chapterId);
  const chapterTitle = chapter?.title ?? params.chapterId;

  // Full session history goes to the chat lane so the model can reason
  // over the whole arc of the conversation (what was already asked, what
  // was already answered, threads the user opened and abandoned, texture
  // from ten turns ago). The extraction lane does not need this and
  // keeps its own narrow context.
  const [history, snapshot, entities, notes] = await Promise.all([
    safeRead('getFullSessionHistory', getFullSessionHistory(params.sessionId), [] as AvaMessage[]),
    safeRead(
      'getProfileSnapshot',
      getProfileSnapshot(params.userId),
      {} as Record<string, string | string[] | number | null>,
    ),
    safeRead('getEntities', getEntities(params.userId, { limit: 5 }), []),
    safeRead('getNotes', getNotes(params.userId, 3), []),
  ]);

  const historyLines = history
    // the current user message gets added separately below, filter it out if already in history
    .filter((m) => m.turn_index < params.turnIndex)
    .map((m) => `  ${m.sender === 'ava' ? 'Ava' : 'User'}: ${m.content}`)
    .join('\n');
  const lastAvaMessage =
    history
      .filter((m) => m.sender === 'ava' && m.turn_index < params.turnIndex)
      .at(-1)
      ?.content ?? null;

  const filledLines = Object.entries(snapshot)
    .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      const disp = Array.isArray(v) ? v.join(', ') : v;
      return `  - ${k}: ${disp}`;
    })
    .join('\n');

  // Open-intent hints: describe WHAT we still need to learn, NOT a
  // scripted way to ask it. The model was previously parroting
  // natural_prompt back to the user verbatim ("Where in the world am I
  // catching you from today?"). Now we hand it a short factual hint of
  // the gap, so the model has to phrase the question in Ava's voice.
  const openLines = params.openFieldKeys
    .map((k) => {
      const spec = AVA_PROFILE_FIELDS[k];
      if (!spec) return `  - ${k}`;
      const hint = OPEN_INTENT_HINTS[k] ?? `still unknown (${spec.type})`;
      return `  - ${k}: ${hint}`;
    })
    .join('\n');

  const routeLines = Object.entries(AVA_CONVERSATION_ROUTES)
    .filter(([, route]) => route.fields.some((field) => params.openFieldKeys.includes(field)))
    .map(
      ([routeId, route]) =>
        `  - ${routeId}: posture=${route.posture} ask=${route.ask} avoid=${route.avoid.join(', ')}`,
    )
    .join('\n');

  const callbackLines: string[] = [];
  if (entities.length) {
    const top = entities.slice(0, 3).map((e) => `${e.kind} · ${e.name}`);
    callbackLines.push(`  - named: ${top.join(' | ')}`);
  }
  if (notes.length) {
    callbackLines.push(`  - texture: ${truncate(notes[0].content, 100)}`);
  }

  // Just-in-time nudges: stronger than system prompt rules, scoped to this turn.
  const nudges: string[] = [];

  // HIGHEST-priority nudge: detect the concrete nouns the user just
  // dropped and force Ava to name them back. This is the single biggest
  // lever for killing "New York can pull people into all kinds of work"
  // style dodges. We put it FIRST in the nudge list because the model
  // tends to weight the top of the list heavier under long context.
  const specifics = detectSpecifics(params.userMessage);
  const graphDecision = await runAvaGraphDecision({
    userMessage: params.userMessage,
    history,
    openFieldKeys: params.openFieldKeys,
    turnIndex: params.turnIndex,
  });
  const { turnPlan } = graphDecision;
  const hasSpecifics =
    specifics.known_companies.length > 0 ||
    specifics.titled_caps.length > 0 ||
    specifics.roles.length > 0 ||
    specifics.numeric_facts.length > 0;
  if (hasSpecifics) {
    const lines: string[] = [
      "REACT TO SPECIFICS (highest priority this turn): The user just named real things. You MUST name at least one of them back in your FIRST beat, not the category they belong to.",
    ];
    if (specifics.known_companies.length) {
      lines.push(
        `  - Companies / institutions they named: ${specifics.known_companies.join(', ')}. These are serious outfits. React with earned pride ("Major.", "Serious outfit.", "${specifics.known_companies[0]} is no small place.") and follow up on THAT specific place, not on "work" in general.`,
      );
    }
    if (specifics.roles.length) {
      lines.push(
        `  - Role(s) they described: ${specifics.roles.join(', ')}. Acknowledge the role by name. Do NOT reduce it to "meaningful work" or "that kind of job". If it's demanding care work (nurse, teacher, social worker), name the weight of it.`,
      );
    }
    if (specifics.titled_caps.length) {
      lines.push(
        `  - Proper nouns they dropped (places, schools, people): ${specifics.titled_caps.join(', ')}. Pick ONE that matters most and name it back. Do NOT zoom out to "New York" / "the city" / "abroad" and ignore the specific.`,
      );
    }
    if (specifics.numeric_facts.length) {
      lines.push(
        `  - Numeric texture: ${specifics.numeric_facts.join(', ')}. You may name this back flatly ("Three generations, then.") but do NOT convert it into pseudo-warmth ("That's quite a commitment"). Banned.`,
      );
    }
    lines.push(
      '  - If your draft reply does not contain any of the named words above, your draft is wrong. Rewrite it with one of those words in the first sentence.',
    );
    nudges.push(lines.join('\n'));
  }

  // Highest-priority nudge: if the user's reply is short / an aside / a
  // question back at Ava, respond to THAT. Don't advance the script.
  if (isShortOrOffScript(params.userMessage)) {
    nudges.push(
      'LISTEN-FIRST: The user\'s last message is a short reply, an aside, a joke, a question back at you, or not an answer to any open intent. Respond TO WHAT THEY SAID in one warm human beat. Do NOT pivot to an open intent this turn. You may ask nothing. Example shapes: "Glad to hear you well.", "Fair enough.", "Ha — not all business. What brought you here?" Never hand them "Where in the world am I catching you from today?" as a pivot.',
    );
  }

  if (/\bcastara\b/i.test(params.userMessage)) {
    nudges.push(
      'HARD NUDGE: The user just mentioned Castara. Your FIRST beat MUST acknowledge Castara is home for you, in one short clause, not as a flourish. Then ask ONE where-in-the-village question. Do NOT say "that\'s quite a connection" / "how nice" / "lovely" — those are banned. Use this shape: "Castara is home for me. Where in the village were they, up by the bay or further back?" or "Castara, that\'s where I am. Which side of the river?"',
    );
  }

  // Life-decision nudge: when the user shares a CHOICE, a MOVE, a REASON,
  // or a HARDSHIP, the right move is to validate the decision FIRST before
  // asking anything. The prior version of the prompt let Ava steamroll past
  // these moments with generic follow-ups or, worse, force unearned sensory
  // detail about whatever place was mentioned. This overrides both.
  const decisionCues: RegExp[] = [
    /\bi (decided|chose|had to|needed to|wanted to|ended up|left|moved|came|went)\b/i,
    /\b(didn'?t|did not|couldn'?t|could not) (see|have|find|get) (much )?(opportunity|work|space|future|chance)\b/i,
    /\b(no|little|limited) (opportunity|work|jobs?|future|options?)\b/i,
    /\b(looking for|searching for|needed|wanted) (a )?(better|more|new)\b/i,
    /\bto (advance|grow|develop|better) (myself|my career|my life)\b/i,
    /\b(moved|migrated|relocated|emigrated) (to|back|away|abroad|overseas)\b/i,
    /\b(so i|that'?s why|which is why|and so|therefore)\b/i,
    /\b(pushed|forced|made) me (to )?(leave|move|go|consider)\b/i,
  ];
  const isLifeDecision = decisionCues.some((re) => re.test(params.userMessage));
  if (isLifeDecision) {
    nudges.push(
      [
        "VALIDATE FIRST (highest priority this turn): The user just shared a LIFE DECISION, a reason they made a choice, or a hardship they navigated. They are not reporting a fact — they are sharing something about themselves. The WRONG move is to jump straight to the next question, and the WRONG move is to dress it up with sensory detail about a place they mentioned.",
        "  Your reply MUST move in this shape, in this order:",
        "    1) A short, direct acknowledgement of what they said — show you HEARD them. Shapes: \"I get that.\" / \"I hear you.\" / \"Makes sense.\" / \"Yeah, I understand.\" (Note: \"I understand\" is a banned opener, but \"Yeah, I understand that\" at the end of the first sentence is fine because it's responding to a decision, not to a feeling dump.)",
        "    2) A warm affirmation that honours the choice they made. Shapes: \"Good that you made space for yourself.\" / \"That takes something to do.\" / \"No shame in that at all.\" / \"A lot of people sit with that feeling and never move on it.\"",
        "    3) ONLY THEN a soft, optional follow-up, and softened with \"mind me asking\" or \"if it's not too forward\" or \"just curious\". Never a blunt probe.",
        "  A good shape reads like: \"I hear you on that. Good that you backed yourself enough to go find what you needed. Mind me asking what kind of opportunity you were hoping to find when you left?\"",
        "  BANNED moves this turn: painting a scene from the place they mentioned (\"Scarborough on a Saturday...\"), converting a fact into pseudo-warmth (\"That's real commitment\"), asking your next question without acknowledging what they said first.",
      ].join('\n'),
    );
  }

  // Place RESTRAINT: When a Tobago place is mentioned but it is INCIDENTAL
  // (background to a life decision, a trip, a family fact, a past address),
  // do NOT force a sensory picture of it. Mentioning a place in passing is
  // not an invitation to paint a postcard. The prior PLACE LEAN-IN rule
  // caused unearned color commentary.
  //
  // The ONLY exception is Castara (handled by the Castara nudge above).
  // Everything else: respond to the feeling / decision / fact, not the geography.
  const placeMatch = params.userMessage.match(
    /\b(tobago|trinidad|scarborough|plymouth|buccoo|speyside|charlotteville|parlatuvier|moriah|englishman|bacolet|lambeau|crown point|store bay|pigeon point|argyle|roxborough)\b/i,
  );
  if (placeMatch && !isLifeDecision) {
    const place = placeMatch[1].toLowerCase();
    nudges.push(
      `PLACE RESTRAINT: The user mentioned "${place}", but treat it as context unless they are explicitly asking you about it or centering their message on it. Do NOT force a sensory picture of ${place}. Do NOT start your reply with a painted scene from that place. Name the place back flatly if it fits ("${place.charAt(0).toUpperCase() + place.slice(1)}, okay.") or don't mention it at all and respond to what they actually said. Sensory color is reserved for moments where they are asking you about a place or reminiscing on one.`,
    );
  } else if (placeMatch && isLifeDecision) {
    const place = placeMatch[1].toLowerCase();
    nudges.push(
      `PLACE RESTRAINT (doubly enforced): The user just mentioned "${place}" in the context of a life decision. Do NOT paint a sensory picture of that place. The place is background, not the subject. Follow the VALIDATE FIRST shape above and leave the geography alone.`,
    );
  }
  // Always-on voice reminder, short form, to fight drift in long context.
  nudges.push(
    'Voice check before you reply: no "lovely", no "nice to meet you", no "that\'s real dedication", no "sounds like you", no paraphrased-back summaries, no "X has its own charm / does have its charm / has its own rhythm / must be a change", no "doesn\'t it?" tagged onto a cliché. If your first draft contains any of those, rewrite the whole line before sending.',
  );
  nudges.push(
    'TONE: plain warm WhatsApp-to-a-friend English is the DEFAULT. Dialect at most ONE light mark and only when it fits, most replies have none at all. Do not stack dialect ("yuh know", "just so", "real", "small ting" in the same message is banned). If your draft reads natural without any dialect, send it plain.',
  );

  // Name-repetition guard. Friends don't say each other's name every
  // message. Look at Ava's last 6 replies and count how many already
  // used the user's first name. If she's used it at all in the recent
  // window, ban it for this turn.
  const firstName = (params.userName || '').trim().split(/\s+/)[0] ?? '';
  if (firstName.length >= 2) {
    const nameRe = new RegExp(`\\b${escapeRegExp(firstName)}\\b`, 'i');
    const recentAva = history
      .filter((m) => m.sender === 'ava' && m.turn_index < params.turnIndex)
      .slice(-6);
    const nameUses = recentAva.filter((m) => nameRe.test(m.content)).length;
    if (nameUses >= 1) {
      nudges.push(
        `NAME GUARD: You have already used "${firstName}" ${nameUses} time(s) in your last ${recentAva.length} replies. Do NOT use their name in this reply. Do not open with their name. Do not close with their name. Address them directly with pronouns. Friends don't say each other's name every message.`,
      );
    }
  }

  const contextBlock = `CONVERSATION STATE
- Turn: ${params.turnIndex} (opener already shown, user is mid-conversation)
- Chapter: ${params.chapterId} (${chapterTitle})
- Prompt / planner version: ${AVA_PROMPT_VERSION}

HIDDEN TURN PLAN (this outranks open intents and profile collection)
${formatAvaTurnPlan(turnPlan)}

JUST-IN-TIME NUDGES (obey these on this turn — these outrank the background notes below)
${nudges.map((n) => `  - ${n}`).join('\n')}

USER MESSAGE (this turn, the one you are reacting to)
${params.userMessage}

RECENT CONVERSATION
${historyLines || '  (this is their first reply after the opener)'}

BACKGROUND NOTES (use only if they genuinely fit — NEVER let these beat reacting to what the user just said)
- Open intents you still need to learn about over time:
${openLines || '    (all filled — this chapter is effectively done)'}
- Active route guardrails:
${routeLines || '    (none)'}
- Already known about them (never read this back verbatim):
${filledLines || '    (nothing yet)'}
- Callback hints from earlier (names and textures — use naturally, never quote):
${callbackLines.length ? callbackLines.join('\n') : '    (none yet)'}

YOUR REPLY — hard constraints
- BEAT 1 must name back at least one specific thing from the user's latest message (company, role, place, person, or number they dropped). No category-level answers. No zooming out to the city / country / profession. If there's nothing specific to name back, then BEAT 1 is a direct reaction to the feeling of their message.
- Exactly ONE question per turn. Count your question marks before submitting; if there are two, merge them into the one that matters most. A reaction statement ("Major.", "Proud to hear it.") is not a question and does not count toward the limit.
- One to three short sentences by default; four is allowed ONLY when they've shared something career-defining, generational, or emotional.
- Lead with a callback if you have one from earlier in the conversation.
- Do not convert a bare fact into pseudo-warmth ("Twelve years is real commitment", "Four generations is deep roots"). Naming the specific thing IS listening; converting it into fake emotional weight is not.
- Do not read the survey out loud. Do not promise anything.`;

  return {
    contextBlock,
    turnPlan,
    forcedReply: graphDecision.forcedReply,
    allowGif: graphDecision.allowGif,
    lastAvaMessage,
  };
}

// ============================================
// UNIFIED TURN HELPERS
// ============================================

const UNIFIED_CALL_TIMEOUT_MS = 12000;

/** Human-readable fallback question per field — used when the LLM call fails. */
const FIELD_FALLBACK_QUESTIONS: Record<string, string> = {
  current_location_text: 'Where in the world are you based these days?',
  generation: 'How far back does your Tobago side go — born there yourself, or is it parents, grandparents?',
  visit_frequency: 'How often do you make it back to Tobago?',
  industry: 'What kind of work do you do?',
  profession_text: 'What fills your days, work-wise?',
  connection_score: 'On a gut level, how tuned in are you to what\'s happening in Tobago these days?',
  contribution_modes: 'If the runway was there, what would you want to give back — time, knowledge, money, reach?',
  invest_intent: 'Would you ever put money behind something in Tobago?',
  barriers: 'What\'s the biggest thing that would stop you from contributing more to Tobago?',
  feature_priorities: 'If there was an online home for the diaspora, what would make it useful enough to come back to?',
  trust_text: 'What would it take for you to trust a platform like that?',
  future_roles: 'Would you want to be involved in anything future-facing — advisory, virtual meetings, surveys?',
  opportunity_text: 'In your eyes, where is Tobago\'s real shot at economic growth?',
  age_bracket: 'Mind me asking a rough decade you\'re in — 20s, 30s, 40s?',
};
const VALID_GIF_CUES = new Set([
  'name_reaction', 'celebration', 'empathy', 'local_vibes',
  'hey_there', 'farewell', 'welcome', 'welcome_back',
]);

/** Derive chapter ID from the next field Ava will actually ask (UI display). */
function chapterFromOpenFields(openFieldKeys: string[]): string {
  const MAP: Record<string, string> = {
    current_location_text: 'introductions', current_city_region: 'introductions',
    current_country: 'introductions', generation: 'introductions', visit_frequency: 'introductions',
    industry: 'who_you_are', profession_text: 'who_you_are',
    education_level: 'who_you_are', age_bracket: 'who_you_are', gender: 'who_you_are',
    connection_score: 'tobago_now', contribution_modes: 'tobago_now',
    invest_intent: 'investment', invest_sectors: 'investment', barriers: 'investment',
    feature_priorities: 'platform_vision', trust_text: 'platform_vision',
    future_roles: 'platform_vision', opportunity_text: 'platform_vision',
  };
  // Track the chapter of the field Ava is actually about to ask, not the first
  // unfilled soft/companion field (which she never asks and would otherwise
  // pin the chapter to an earlier stage forever).
  const nextAskable = chooseNextRequiredField(openFieldKeys);
  if (nextAskable && MAP[nextAskable]) return MAP[nextAskable];
  for (const key of openFieldKeys) {
    if (MAP[key]) return MAP[key];
  }
  return isAvaSurveyEffectivelyComplete(openFieldKeys) ? 'wrap_up' : 'introductions';
}

interface AvaRawOutput {
  reply: string;
  captured: Record<string, unknown>;
  gif_cue: string | null;
}

/** Robustly extract the JSON block from the model's text output. */
function parseUnifiedResponse(text: string): AvaRawOutput {
  const cleaned = text.trim();

  // Walk forward for '{' and backward for '}' to find the outermost JSON block.
  // This handles cases where the model adds a preamble or postamble.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (typeof parsed.reply === 'string' && parsed.reply.length > 0) {
        const rawCue = parsed.gif_cue;
        const gif_cue =
          typeof rawCue === 'string' && VALID_GIF_CUES.has(rawCue) ? rawCue : null;
        const captured =
          parsed.captured &&
          typeof parsed.captured === 'object' &&
          !Array.isArray(parsed.captured)
            ? (parsed.captured as Record<string, unknown>)
            : {};
        return { reply: parsed.reply, captured, gif_cue };
      }
    } catch {
      // fall through
    }
  }

  // If the model returned plain text (no JSON), use the text as the reply.
  // This is better than a generic fallback — the model at least said something.
  if (cleaned.length > 0 && !cleaned.startsWith('{')) {
    console.warn('[ava.unified] model returned plain text (no JSON), using as reply');
    return { reply: cleaned, captured: {}, gif_cue: 'hey_there' };
  }

  console.warn('[ava.unified] JSON parse failed completely, using safe fallback');
  return { reply: cleaned || '', captured: {}, gif_cue: null };
}

/** Convert the LLM's "captured" map to the ExtractionResult shape for applyExtractionResult. */
function capturedToExtraction(captured: Record<string, unknown>): ExtractionResult {
  const profile_updates: ExtractedProfileUpdate[] = Object.entries(captured)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([field_key, value]) => ({
      field_key,
      value: value as string | string[] | number | null,
      confidence: 0.95,
      evidence: '[unified LLM extraction]',
    }));
  return {
    profile_updates,
    entities: [],
    notes: [],
    raw_model_output: JSON.stringify(captured),
    model_info: { provider: 'openai', modelId: 'unified' },
    elapsed_ms: 0,
    parse_ok: true,
  };
}

/** Build the per-turn user-side prompt (conversation history + profile state + open fields). */
function buildUnifiedUserPrompt(params: {
  userName: string;
  userMessage: string;
  history: AvaMessage[];
  snapshot: Record<string, string | string[] | number | null>;
  openFieldKeys: string[];
  turnIndex: number;
}): string {
  const historyLines = params.history
    .filter((m) => m.turn_index < params.turnIndex)
    .map((m) => `  ${m.sender === 'ava' ? 'Ava' : params.userName}: ${m.content}`)
    .join('\n');

  const snapshotEntries = Object.entries(params.snapshot).filter(
    ([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
  );
  const snapshotLines =
    snapshotEntries.length > 0
      ? snapshotEntries
          .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n')
      : '  (nothing yet)';

  const openHints = AVA_UNIFIED_PROFILE_FIELD_HINTS.filter((h) =>
    params.openFieldKeys.includes(h.key),
  )
    .map((h, i) => `  ${i + 1}. ${h.key} — ${h.hint}`)
    .join('\n');

  // The picker (X-Elicit-* headers) is keyed off the SAME next field, so we
  // steer Ava to ask exactly this one. Otherwise her spoken question and the
  // multiple-choice options drift apart.
  const nextField = chooseNextRequiredField(params.openFieldKeys);
  const nextHint = AVA_UNIFIED_PROFILE_FIELD_HINTS.find((h) => h.key === nextField);
  const focusLine = nextField
    ? `\nASK ABOUT THIS ONE THING NEXT (in your own voice, never list options): ${nextField}${nextHint ? ` — ${nextHint.hint}` : ''}. Do not jump ahead to other fields this turn.`
    : '';

  return `CONVERSATION HISTORY:
${historyLines || "  (this is the first reply after Ava's opener)"}

ALREADY KNOWN ABOUT ${params.userName}:
${snapshotLines}

FIELDS STILL TO COLLECT (collect naturally, one at a time, in this priority order):
${openHints || '  (all fields collected — wind the conversation down naturally)'}
${focusLine}

LATEST MESSAGE FROM ${params.userName}:
  "${params.userMessage}"`;
}

// ============================================
// RUN TURN (unified single-LLM-call)
// ============================================

export async function runTurn(input: RunTurnInput): Promise<RunTurnResult> {
  const user = await getAvaUserById(input.userId);
  if (!user) throw new Error(`ava_user not found: ${input.userId}`);

  // 1. Persist the user's message
  const userTurnIndex = await getNextTurnIndex(input.sessionId);
  const userMsgRow = await insertUserMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    content: input.userMessage,
    turnIndex: userTurnIndex,
  });

  // 2. Load all context in parallel (with safe fallbacks for transient DB errors)
  const [history, snapshot, openFieldKeys] = await Promise.all([
    safeRead('getFullSessionHistory', getFullSessionHistory(input.sessionId), [] as AvaMessage[]),
    safeRead('getProfileSnapshot', getProfileSnapshot(input.userId), {} as Record<string, string | string[] | number | null>),
    safeRead('getOpenFieldKeys', getOpenFieldKeys(input.userId), Object.keys(AVA_PROFILE_FIELDS)),
  ]);

  const chapterId = chapterFromOpenFields(openFieldKeys);

  // 3. Build the unified prompt (history + what we know + what we still need)
  const userPrompt = buildUnifiedUserPrompt({
    userName: user.name,
    userMessage: input.userMessage,
    history,
    snapshot,
    openFieldKeys,
    turnIndex: userTurnIndex,
  });

  // 4. Single LLM call — reply + profile extraction + gif_cue in one shot
  const turnStartedAt = Date.now();
  const { model: chatModel, info: chatInfo } = getAvaChatModel();
  let modelProvider = chatInfo.provider as string;
  let modelId = chatInfo.modelId;
  let rawOutput: AvaRawOutput;

  try {
    const result = await withTimeout(
      generateText({
        model: chatModel,
        system: AVA_SYSTEM_PROMPT + AVA_EXTRACTION_OUTPUT_ADDENDUM,
        prompt: userPrompt,
        providerOptions: {
          openai: { reasoningEffort: 'medium' },
        },
      }),
      UNIFIED_CALL_TIMEOUT_MS,
      'ava_unified_call',
    );
    rawOutput = parseUnifiedResponse(result.text);
  } catch (err) {
    console.error('[ava.runTurn] unified call failed', { err });
    modelProvider = 'system';
    modelId = `${AVA_PROMPT_VERSION}/fallback`;
    const nextFieldKey = chooseNextRequiredField(openFieldKeys) ?? undefined;
    const fallbackQ =
      (nextFieldKey && FIELD_FALLBACK_QUESTIONS[nextFieldKey]) ??
      'Where in the world are you based these days?';

    // Best-effort capture even on timeout: if a location field is still open
    // and the user message looks like a place name, save it immediately so
    // we don't keep asking the same question after a timeout.
    const timeoutCapture: Record<string, unknown> = {};
    if (
      openFieldKeys.includes('current_location_text') &&
      /^[A-Za-z ,.'()-]+$/.test(input.userMessage.trim()) &&
      input.userMessage.trim().length >= 2 &&
      input.userMessage.trim().length <= 60
    ) {
      const place = input.userMessage.replace(/^i\s+(live|am|stay)\s+in\s+/i, '').trim();
      timeoutCapture.current_location_text = place;
    }

    rawOutput = {
      reply: `Got it. ${fallbackQ}`,
      captured: timeoutCapture,
      gif_cue: null,
    };
  }

  const chat_latency_ms = Date.now() - turnStartedAt;

  // 5. Voice post-processor (strips banned phrases, normalises formatting)
  const voice = postProcessAvaReply(rawOutput.reply);
  if (voice.edited) {
    console.log('[ava.runTurn] voice post-process edited', {
      removed: voice.removed_phrases,
      stripped_cliche_shapes: voice.stripped_cliche_shapes,
    });
  }

  // 6. Persist Ava's reply
  const avaMessage = await insertAvaMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    content: voice.text,
    turnIndex: userTurnIndex + 1,
    isSystemDelivered: false,
    modelProvider,
    modelId,
    chapterId,
    latencyMs: chat_latency_ms,
  });

  // 7. Write captured profile fields to the DB in the background
  const finalize: Promise<ExtractionFinalizeSummary> = (async () => {
    try {
      const extraction = capturedToExtraction(rawOutput.captured);
      if (extraction.profile_updates.length === 0) {
        return {
          extraction_latency_ms: 0,
          extraction_parse_ok: true,
          profile_fields_written: 0,
          entities_written: 0,
          notes_written: 0,
          profile_completion: 0,
        };
      }

      const summary = await applyExtractionResult({
        userId: input.userId,
        extraction,
        sourceMessageId: userMsgRow.id,
        minConfidence: 0.5,
      });

      const stillOpen = await getOpenFieldKeys(input.userId);
      if (isAvaSurveyEffectivelyComplete(stillOpen)) {
        await setSessionStatus(input.sessionId, 'complete');
      }

      return {
        extraction_latency_ms: Date.now() - turnStartedAt,
        extraction_parse_ok: true,
        profile_fields_written: summary.profile_fields_written,
        entities_written: summary.entities_written,
        notes_written: summary.notes_written,
        profile_completion: summary.profile_completion,
      };
    } catch (err) {
      console.error('[ava.runTurn] finalize failed', { err });
      return {
        extraction_latency_ms: Date.now() - turnStartedAt,
        extraction_parse_ok: false,
        profile_fields_written: 0,
        entities_written: 0,
        notes_written: 0,
        profile_completion:
          Object.values(snapshot).filter((v) => v !== null && v !== '').length /
          Math.max(Object.keys(AVA_PROFILE_FIELDS).length, 1),
      };
    }
  })();

  return {
    reply: voice.text,
    reply_message_id: avaMessage.id,
    turn_index: userTurnIndex + 1,
    chapter_id: chapterId,
    chapter_changed: false,
    chat_latency_ms,
    prompt_version: `${AVA_PROMPT_VERSION}/unified`,
    turn_plan: null,
    reply_quality: {
      ok: true,
      issues: [],
      retried: false,
    },
    allow_gif: rawOutput.gif_cue !== null,
    gif_cue: rawOutput.gif_cue,
    finalize,
  };
}

// ============================================
// STREAMING TURN (twin-pass: stream reply + background extraction)
// ============================================

export interface PreparedTurn {
  userMsgId: string;
  userTurnIndex: number;
  avaTurnIndex: number;
  chapterId: string;
  openFieldKeys: string[];
  lastAvaMessage: string | null;
  systemPrompt: string;
  userPrompt: string;
  gifCue: string | null;
}

/**
 * Deterministically pick the most appropriate GIF cue without the LLM.
 * Called before streaming so the cue travels in response headers immediately.
 */
export function computeGifCue(
  userMessage: string,
  avaTurnIndex: number,
  openFieldKeys: string[],
): string | null {
  const u = userMessage.toLowerCase().trim();
  if (/\b(bye|goodbye|gotta go|talk later|take care|ttyl|see ya)\b/.test(u)) return 'farewell';
  if (avaTurnIndex === 2) return 'name_reaction';
  if (
    openFieldKeys.includes('current_location_text') &&
    u.length <= 60 &&
    /^[a-z ,.'()\-]+$/.test(u)
  ) return 'hey_there';
  if (/\b(miss|missing|homesick|far from|too long|sad|hard|tough|lonely|grief)\b/.test(u)) return 'empathy';
  if (/\b(seine|bay|carnival|soca|pan|liming|doubles|castara|buccoo|speyside)\b/.test(u)) return 'local_vibes';
  if (/[!]{2,}|\b(love it|amazing|finally|yes yes|excited)\b/.test(u)) return 'celebration';
  if (avaTurnIndex % 2 === 0) return 'hey_there';
  return null;
}

/**
 * Pre-flight for a streaming turn:
 *  - Persists the user message (DB write before LLM starts)
 *  - Loads conversation context (history, profile snapshot, open fields)
 *  - Builds the per-turn user prompt
 *  - Computes the gif_cue deterministically
 *
 * Called BEFORE streamText so all DB reads are complete before the
 * stream begins, avoiding contention with the streaming response.
 */
export async function prepareTurn(input: RunTurnInput): Promise<PreparedTurn> {
  const user = await getAvaUserById(input.userId);
  if (!user) throw new Error(`ava_user not found: ${input.userId}`);

  const userTurnIndex = await getNextTurnIndex(input.sessionId);
  const userMsgRow = await insertUserMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    content: input.userMessage,
    turnIndex: userTurnIndex,
  });

  await syncApplyPickerProfileIfExact({
    userId: input.userId,
    userMessage: input.userMessage,
    sourceMessageId: userMsgRow.id,
  });

  const [history, snapshot, openFieldKeys] = await Promise.all([
    safeRead('getFullSessionHistory', getFullSessionHistory(input.sessionId), [] as AvaMessage[]),
    safeRead('getProfileSnapshot', getProfileSnapshot(input.userId), {} as Record<string, string | string[] | number | null>),
    safeRead('getOpenFieldKeys', getOpenFieldKeys(input.userId), Object.keys(AVA_PROFILE_FIELDS)),
  ]);

  const chapterId = chapterFromOpenFields(openFieldKeys);
  const lastAvaMessage =
    [...history].reverse().find((m) => m.sender === 'ava')?.content ?? null;

  const userPrompt = buildUnifiedUserPrompt({
    userName: user.name,
    userMessage: input.userMessage,
    history,
    snapshot,
    openFieldKeys,
    turnIndex: userTurnIndex,
  });

  return {
    userMsgId: userMsgRow.id,
    userTurnIndex,
    avaTurnIndex: userTurnIndex + 1,
    chapterId,
    openFieldKeys,
    lastAvaMessage,
    systemPrompt: AVA_SYSTEM_PROMPT, // pure persona — no JSON extraction addendum
    userPrompt,
    gifCue: computeGifCue(input.userMessage, userTurnIndex + 1, openFieldKeys),
  };
}

/**
 * Post-stream: applies voice post-processing, persists Ava's reply to the DB,
 * and fires background extraction. Designed to run inside next/server `after()`
 * so it survives after the streaming response has been sent to the client.
 */
export async function persistAvaReply(params: {
  sessionId: string;
  userId: string;
  userMessage: string;
  rawText: string;
  avaTurnIndex: number;
  chapterId: string;
  startedAt: number;
  userMsgId: string;
  openFieldKeys: string[];
  lastAvaMessage: string | null;
}): Promise<void> {
  const voice = postProcessAvaReply(params.rawText);
  if (voice.edited) {
    console.log('[ava.stream] voice post-process edited', {
      removed: voice.removed_phrases,
    });
  }

  await insertAvaMessage({
    sessionId: params.sessionId,
    userId: params.userId,
    content: voice.text,
    turnIndex: params.avaTurnIndex,
    isSystemDelivered: false,
    modelProvider: 'openai',
    modelId: 'streaming',
    chapterId: params.chapterId,
    latencyMs: Date.now() - params.startedAt,
  });

  void runSimpleExtraction({
    userId: params.userId,
    userMessage: params.userMessage,
    avaReply: voice.text,
    lastAvaQuestion: params.lastAvaMessage,
    openFieldKeys: params.openFieldKeys,
    sourceMessageId: params.userMsgId,
  }).catch((err) =>
    console.error('[ava.stream] background extraction failed (non-fatal)', err),
  );

  const stillOpen = await getOpenFieldKeys(params.userId).catch(() => null);
  if (stillOpen !== null && isAvaSurveyEffectivelyComplete(stillOpen)) {
    await setSessionStatus(params.sessionId, 'complete').catch(console.error);
  }
}
