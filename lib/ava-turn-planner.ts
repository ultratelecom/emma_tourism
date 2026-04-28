import type { AvaMessage } from './ava-db';

export type AvaMomentType =
  | 'life_decision'
  | 'career_achievement'
  | 'pain_or_frustration'
  | 'identity_roots'
  | 'place_memory'
  | 'question_to_ava'
  | 'short_reply'
  | 'logistical_answer'
  | 'trust_concern'
  | 'investment_interest'
  | 'general_disclosure';

export type AvaReplyShape =
  | 'validate_then_soft_ask'
  | 'celebrate_then_specific_ask'
  | 'answer_then_return'
  | 'sit_no_question'
  | 'mirror_specific_then_probe'
  | 'clarify_gently'
  | 'place_memory_then_ask'
  | 'trust_then_safety_ask'
  | 'recover_to_profile_ask';

export type AvaQuestionSoftness =
  | 'none'
  | 'direct'
  | 'soft'
  | 'very_soft'
  | 'no_question';

export type AvaConversationMomentum =
  | 'opening_up'
  | 'steady'
  | 'thin'
  | 'resistant'
  | 'questioning';

export type AvaEmotionalPriority =
  | 'user_emotion_or_life_decision'
  | 'user_question'
  | 'named_specific'
  | 'conversation_momentum'
  | 'profile_gap';

export interface AvaSpecifics {
  known_companies: string[];
  titled_caps: string[];
  roles: string[];
  numeric_facts: string[];
  places: string[];
}

export interface AvaTurnPlan {
  moment_type: AvaMomentType;
  reply_shape: AvaReplyShape;
  emotional_priority: AvaEmotionalPriority;
  should_ask_question: boolean;
  question_softness: AvaQuestionSoftness;
  conversation_momentum: AvaConversationMomentum;
  specifics_to_name: string[];
  avoid_topics: string[];
  next_best_question_focus: string | null;
  rationale: string;
}

export const AVA_PROMPT_VERSION = 'ava-conversation-logic-2026-04-28';

export const AVA_RESPONSE_SHAPES: Record<AvaReplyShape, string> = {
  validate_then_soft_ask:
    'Acknowledge what they shared, honour the choice or feeling, then ask one softened follow-up only if it deepens their own thread.',
  celebrate_then_specific_ask:
    'Name the company, role, institution, or concrete win, show earned pride, then ask one specific follow-up about that same thing.',
  answer_then_return:
    'Answer the user question plainly first, then gently return to the conversation only if it feels natural.',
  sit_no_question:
    'Let the moment breathe. Give one warm human beat and ask no question.',
  mirror_specific_then_probe:
    'Name one concrete detail back flatly, then ask one grounded follow-up that stays on that detail.',
  clarify_gently:
    'Admit what is unclear without pressure, then ask one small clarifying question.',
  place_memory_then_ask:
    'Use one local or sensory detail only because the user centered a place, then ask one memory-shaped question.',
  trust_then_safety_ask:
    'Acknowledge the concern, do not defend institutions, then ask what would make it feel safer or more transparent.',
  recover_to_profile_ask:
    'Briefly acknowledge the context already shared, then move back to the next required profile field. Do not ask another same-topic detail question.',
};

const KNOWN_COMPANIES = [
  'verizon', 'metro', 'at&t', 'comcast', 'spectrum', 'google', 'alphabet',
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

const PLACE_WORDS = [
  'castara', 'tobago', 'trinidad', 'scarborough', 'plymouth', 'buccoo',
  'speyside', 'charlotteville', 'parlatuvier', 'moriah', "englishman's bay",
  'englishman', 'bacolet', 'lambeau', 'crown point', 'store bay',
  'pigeon point', 'argyle', 'roxborough', 'new york', 'brooklyn', 'queens',
  'bronx', 'manhattan', 'staten island', 'toronto', 'london', 'miami',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayName(value: string): string {
  return value
    .split(' ')
    .map((w) => {
      if (['at&t', 'aws', 'ibm', 'nyu', 'mit', 'nypd', 'fdny', 'un', 'imf', 'bp', 'ey', 'hbo'].includes(w)) {
        return w.toUpperCase();
      }
      if (w === 'j&j') return 'J&J';
      return w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toUpperCase();
    })
    .join(' ');
}

function dedupe(xs: string[], limit = 5): string[] {
  return Array.from(new Set(xs.filter(Boolean))).slice(0, limit);
}

export function detectAvaSpecifics(message: string): AvaSpecifics {
  const lower = message.toLowerCase();
  const known_companies = KNOWN_COMPANIES.filter((brand) =>
    new RegExp(`\\b${escapeRegExp(brand)}\\b`, 'i').test(lower),
  ).map(displayName);

  const roles = ROLE_WORDS.filter((role) =>
    new RegExp(`\\b${escapeRegExp(role)}\\b`, 'i').test(lower),
  );

  const places = PLACE_WORDS.filter((place) =>
    new RegExp(`\\b${escapeRegExp(place)}\\b`, 'i').test(lower),
  ).map(displayName);

  const titled_caps: string[] = [];
  const sentences = message.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const tokens = s.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i].replace(/[^A-Za-z'&-]/g, '');
      if (t.length < 2 || t === 'I') continue;
      if (/^[A-Z][A-Za-z'&-]+$/.test(t)) titled_caps.push(t);
    }
  }

  const numeric_facts =
    lower.match(
      /\b(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s+(year|years|yrs|month|months|kid|kids|child|children|sister|sisters|brother|brothers|generation|generations)\b/gi,
    ) ?? [];

  return {
    known_companies: dedupe(known_companies),
    titled_caps: dedupe(titled_caps),
    roles: dedupe(roles),
    numeric_facts: dedupe(numeric_facts),
    places: dedupe(places),
  };
}

function hasAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(message));
}

function countQuestions(messages: AvaMessage[]): number {
  return messages.filter((m) => m.sender === 'user' && /\?$/.test(m.content.trim())).length;
}

const PROFILE_RECOVERY_ORDER = [
  'current_location_text',
  'generation',
  'visit_frequency',
  'industry',
  'profession_text',
  'connection_score',
  'contribution_modes',
  'invest_intent',
  'invest_sectors',
  'barriers',
  'feature_priorities',
  'trust_text',
  'future_roles',
  'opportunity_text',
  'age_bracket',
  'gender',
  'education_level',
];

function nextRequiredProfileField(openFieldKeys: string[], skipWork = false): string | null {
  const skip = new Set(skipWork ? ['industry', 'profession_text'] : []);
  return PROFILE_RECOVERY_ORDER.find((field) => openFieldKeys.includes(field) && !skip.has(field)) ?? null;
}

function isWorkDetailProbe(content: string): boolean {
  const lower = content.toLowerCase();
  if (!lower.includes('?')) return false;

  // The required profile question that captures profession/industry is
  // not a "deep dive". Depth budget starts after the user has answered
  // what they do.
  if (/\b(what kind of work are you in|what do you do|what fills your days|work are you in|work these days)\b/i.test(lower)) {
    return false;
  }

  // Count broad same-topic work probes, not just exact phrases. This is
  // deliberately wider than the old detector because "what kind of
  // problem", "what issue most often", and "how did you learn that side"
  // are all the same invasive work-depth thread after Ava already has
  // profession_text.
  return (
    /\b(what kind of consulting|kind of consulting|what kind of repairs|what does your consult|consult actually involve|case goes that way|before the next team|planning side|for them)\b/i.test(lower) ||
    /\b(what part|what kind|which part|what issue|which issue|what problem|which problem|how did you learn|how did you get into|day to day|shift.*like)\b/i.test(lower) &&
      /\b(work|consult|consulting|metro|verizon|walmart|cashier|fiber|mechanic|mechanical|repair|repairs|problem|issue|build[- ]?out|system|planning|manufacturer|defect|shift)\b/i.test(lower)
  );
}

function recentWorkDetailProbeCount(history: AvaMessage[]): number {
  return history
    .filter((m) => m.sender === 'ava')
    .slice(-5)
    .filter((m) => isWorkDetailProbe(m.content)).length;
}

export function planAvaTurn(params: {
  userMessage: string;
  history: AvaMessage[];
  openFieldKeys: string[];
  turnIndex?: number;
  specifics?: AvaSpecifics;
}): AvaTurnPlan {
  const message = params.userMessage.trim();
  const lower = message.toLowerCase();
  const specifics = params.specifics ?? detectAvaSpecifics(message);
  const recentUser = params.history.filter((m) => m.sender === 'user').slice(-4);
  const lastAvaMessage =
    params.history
      .filter((m) => m.sender === 'ava')
      .at(-1)
      ?.content.toLowerCase() ?? '';
  const avgRecentLength = recentUser.length
    ? recentUser.reduce((sum, m) => sum + m.content.trim().length, 0) / recentUser.length
    : message.length;
  const workProbeCount = recentWorkDetailProbeCount(params.history);

  if (params.openFieldKeys.length === 0) {
    return {
      moment_type: 'general_disclosure',
      reply_shape: 'sit_no_question',
      emotional_priority: 'conversation_momentum',
      should_ask_question: false,
      question_softness: 'no_question',
      conversation_momentum: 'steady',
      specifics_to_name: [],
      avoid_topics: ['new profile questions', 'generic goodbye'],
      next_best_question_focus: 'profile complete / graceful close',
      rationale: 'profile complete; close by naming specifics',
    };
  }

  const isQuestion = /\?$/.test(message) || /^(who|what|why|how|where|when|do you|can you|are you)\b/i.test(message);
  const isShort = message.length <= 18;
  const isShortAcknowledgement =
    /^(y+e+s+|yeah|yep|yup|ok|okay|right|true|sure|mhm|mmhmm|fair|got you|got it)\.?$/i.test(message);
  const isRecoveryAfterShortAck =
    isShortAcknowledgement &&
    Boolean(lastAvaMessage) &&
    !lastAvaMessage.includes('?') &&
    params.openFieldKeys.length > 0;
  const isOpeningNameAnswer =
    (params.turnIndex ?? 999) <= 1 &&
    params.openFieldKeys.includes('current_location_text') &&
    !isQuestion &&
    message.length > 0 &&
    message.length <= 40 &&
    !/[!?]/.test(message) &&
    !/\b(good|fine|okay|ok|tired|why|who|what|where|when|how)\b/i.test(message);
  const isLocationAnswer =
    params.openFieldKeys.includes('current_location_text') &&
    !isQuestion &&
    message.length > 0 &&
    message.length <= 60 &&
    /where in the world|where.*these days|based now|catching you|where are you based|what part of the world|where do you live/i.test(lastAvaMessage) &&
    (specifics.places.length > 0 || /^[A-Za-z .'-]+$/.test(message));
  const isRootsAnswer =
    !isQuestion &&
    /how far back.*tobago|born there|parents\/grandparents|parents or grandparents|tobago roots/i.test(lastAvaMessage) &&
    message.length > 0 &&
    message.length <= 120;
  const isVisitAnswer =
    !isQuestion &&
    /(when did your feet last touch|how often|make it back|lived there|ever live|ever lived|visited tobago|spent time in tobago)/i.test(lastAvaMessage) &&
    message.length > 0 &&
    message.length <= 180;
  const isOnboardingRailAnswer =
    isOpeningNameAnswer || isLocationAnswer || isRootsAnswer || isVisitAnswer;
  const isWorkAnswer =
    (params.openFieldKeys.includes('industry') || params.openFieldKeys.includes('profession_text')) &&
    !isQuestion &&
    /(what do you do|what fills your days|work these days|kind of work|work are you in)/i.test(lastAvaMessage) &&
    message.length > 0;
  const isWorkDepthExhausted =
    workProbeCount >= 2 &&
    !isQuestion &&
    message.length > 0 &&
    hasAny(lastAvaMessage, [
      /what kind of consulting/i,
      /what kind of repairs/i,
      /what kind of problem/i,
      /what problem/i,
      /what kind of issue/i,
      /what issue/i,
      /which issue/i,
      /how did you learn/i,
      /what part.*build/i,
      /consult actually involve/i,
      /case goes that way/i,
      /before the next team/i,
    ]);
  const isResistant = hasAny(lower, [
    /\bwhy\b.*\b(ask|need|want|know)\b/,
    /\b(don't|do not|nah|nope|not really|rather not|prefer not)\b/,
    /\b(that'?s private|too personal|too much|not comfortable|don'?t want to say|rather not say)\b/,
  ]);
  const isTrustConcern = hasAny(lower, [
    /\btrust\b/, /\btransparent|transparency\b/, /\bprivacy|secure|security\b/,
    /\bgovernment\b/, /\bdata\b/, /\bscam|fraud|corrupt|bureaucracy\b/,
  ]);
  const isLifeDecision = hasAny(lower, [
    /\bi (decided|chose|had to|needed to|wanted to|ended up|left|moved|came|went)\b/,
    /\b(didn'?t|did not|couldn'?t|could not) (see|have|find|get) (much )?(opportunity|work|space|future|chance)\b/,
    /\b(no|little|limited) (opportunity|work|jobs?|future|options?)\b/,
    /\b(looking for|searching for|needed|wanted) (a )?(better|more|new)\b/,
    /\bto (advance|grow|develop|better) (myself|my career|my life)\b/,
    /\b(moved|migrated|relocated|emigrated) (to|back|away|abroad|overseas)\b/,
    /\b(so i|that'?s why|which is why|and so|therefore)\b/,
    /\b(pushed|forced|made) me (to )?(leave|move|go|consider)\b/,
  ]);
  const isPain = hasAny(lower, [
    /\b(hard|tough|stress|stressed|struggle|struggling|frustrat|angry|hurt|sad|lonely|tired|burnt out|burned out)\b/,
    /\bno one\b|\bnobody\b|\bleft behind\b/,
  ]);
  const isIdentityRoots = hasAny(lower, [
    /\b(grandparent|grandparents|mother|father|mum|mom|dad|aunt|uncle|family|roots?|generation|born|grew up)\b/,
  ]) && hasAny(lower, [/\btobago\b/, /\btrinidad\b/, /\btrinbagonian\b/, /\bhome\b/]);
  const isPlaceMemory =
    specifics.places.length > 0 &&
    hasAny(lower, [/\bremember\b/, /\bmiss\b/, /\bused to\b/, /\bgrew up\b/, /\bvisit\b/, /\bvisited\b/, /\blived\b/, /\bhome\b/]) &&
    !isLifeDecision;
  const isCareer =
    specifics.known_companies.length > 0 ||
    specifics.roles.length > 0 ||
    hasAny(lower, [/\bwork\b/, /\bjob\b/, /\bcareer\b/, /\bconsult\b/, /\bbusiness\b/, /\bcompany\b/]);
  const isInvestment = hasAny(lower, [
    /\binvest\b/, /\bbusiness\b/, /\breal estate\b/, /\bland\b/, /\breturns?\b/, /\brisk\b/, /\bcapital\b/,
  ]);

  let moment_type: AvaMomentType = 'general_disclosure';
  if (isQuestion) moment_type = 'question_to_ava';
  if (isShort && !isQuestion) moment_type = 'short_reply';
  if (isOpeningNameAnswer) moment_type = 'logistical_answer';
  if (isLocationAnswer) moment_type = 'logistical_answer';
  if (isRootsAnswer) moment_type = 'logistical_answer';
  if (isVisitAnswer) moment_type = 'logistical_answer';
  if (isIdentityRoots) moment_type = 'identity_roots';
  if (isCareer || isWorkAnswer) moment_type = 'career_achievement';
  if (isInvestment) moment_type = 'investment_interest';
  if (isPlaceMemory) moment_type = 'place_memory';
  if (isPain || isResistant) moment_type = 'pain_or_frustration';
  if (isTrustConcern) moment_type = 'trust_concern';
  if (isLifeDecision) moment_type = 'life_decision';
  // If Ava explicitly asked what work they do, the user's answer is the
  // profession capture turn even if it contains incidental movement
  // language like "walk out of my home".
  if (isWorkAnswer) moment_type = 'career_achievement';
  // The early onboarding rail must not be overwritten by Castara/place
  // memory or generic short-answer logic. If Ava asked the rail question,
  // the next answer advances the rail.
  if (isOnboardingRailAnswer) moment_type = 'logistical_answer';
  // A direct question to Ava should be answered first unless it is also
  // a true life-decision or pain disclosure. "Why do you want to know?"
  // may carry suspicion, but the visible move is still answer-first.
  if (isQuestion && !isLifeDecision && !isPain) moment_type = 'question_to_ava';
  if (isWorkDepthExhausted) moment_type = 'general_disclosure';
  if (isRecoveryAfterShortAck) moment_type = 'general_disclosure';

  let conversation_momentum: AvaConversationMomentum = 'steady';
  if (isResistant) conversation_momentum = 'resistant';
  else if (isQuestion || countQuestions(recentUser) >= 2) conversation_momentum = 'questioning';
  else if (isShort || avgRecentLength < 35) conversation_momentum = 'thin';
  else if (message.length > 120 || avgRecentLength > 100) conversation_momentum = 'opening_up';

  let emotional_priority: AvaEmotionalPriority = 'profile_gap';
  if (['life_decision', 'pain_or_frustration', 'trust_concern'].includes(moment_type)) {
    emotional_priority = 'user_emotion_or_life_decision';
  } else if (moment_type === 'question_to_ava') {
    emotional_priority = 'user_question';
  } else if (
    specifics.known_companies.length ||
    specifics.roles.length ||
    specifics.titled_caps.length ||
    specifics.numeric_facts.length
  ) {
    emotional_priority = 'named_specific';
  } else if (moment_type === 'logistical_answer') {
    emotional_priority = 'profile_gap';
  } else if (conversation_momentum !== 'steady') {
    emotional_priority = 'conversation_momentum';
  }

  let reply_shape: AvaReplyShape = 'mirror_specific_then_probe';
  let should_ask_question = true;
  let question_softness: AvaQuestionSoftness = 'direct';
  let next_best_question_focus: string | null = params.openFieldKeys[0] ?? null;

  switch (moment_type) {
    case 'logistical_answer':
      reply_shape = 'mirror_specific_then_probe';
      should_ask_question = true;
      question_softness = 'direct';
      if (isVisitAnswer) {
        next_best_question_focus = 'their work / what fills their days';
      } else if (isRootsAnswer) {
        next_best_question_focus = 'whether they lived in or visited Tobago, and how often they return';
      } else if (isLocationAnswer) {
        next_best_question_focus = 'their Tobago roots / generation';
      } else {
        next_best_question_focus = 'where in the world they are based now';
      }
      break;
    case 'life_decision':
      reply_shape = 'validate_then_soft_ask';
      question_softness = 'very_soft';
      next_best_question_focus = 'what opportunity or support they were looking for';
      break;
    case 'career_achievement':
      if (isWorkAnswer) {
        reply_shape = 'recover_to_profile_ask';
        should_ask_question = true;
        question_softness = 'soft';
        next_best_question_focus = nextRequiredProfileField(params.openFieldKeys, true);
      } else {
        reply_shape = 'celebrate_then_specific_ask';
        question_softness = 'direct';
        next_best_question_focus = 'their specific role, company, or kind of work';
      }
      break;
    case 'pain_or_frustration':
      reply_shape = isResistant ? 'sit_no_question' : 'validate_then_soft_ask';
      should_ask_question = !isResistant;
      question_softness = isResistant ? 'no_question' : 'very_soft';
      next_best_question_focus = isResistant ? null : 'what would make the situation feel easier or safer';
      break;
    case 'question_to_ava':
      reply_shape = 'answer_then_return';
      question_softness = 'soft';
      next_best_question_focus = 'the smallest natural return question after answering them';
      break;
    case 'short_reply':
      reply_shape = 'sit_no_question';
      should_ask_question = false;
      question_softness = 'no_question';
      next_best_question_focus = null;
      break;
    case 'place_memory':
      reply_shape = 'place_memory_then_ask';
      question_softness = 'soft';
      next_best_question_focus = 'their memory or feeling about that place';
      break;
    case 'trust_concern':
      reply_shape = 'trust_then_safety_ask';
      question_softness = 'very_soft';
      next_best_question_focus = 'what would earn trust or make it feel transparent';
      break;
    case 'identity_roots':
      reply_shape = 'mirror_specific_then_probe';
      question_softness = 'soft';
      next_best_question_focus = 'which side of the family kept Tobago present';
      break;
    default:
      if (isRecoveryAfterShortAck) {
        reply_shape = 'recover_to_profile_ask';
        should_ask_question = true;
        question_softness = 'soft';
        next_best_question_focus = nextRequiredProfileField(params.openFieldKeys, true);
        break;
      }
      if (isWorkDepthExhausted) {
        reply_shape = 'recover_to_profile_ask';
        should_ask_question = true;
        question_softness = 'soft';
        next_best_question_focus = nextRequiredProfileField(params.openFieldKeys, true);
        break;
      }
      if (conversation_momentum === 'thin') {
        reply_shape = 'clarify_gently';
        question_softness = 'soft';
      }
  }

  if (
    conversation_momentum === 'resistant' &&
    !['question_to_ava', 'trust_concern'].includes(moment_type)
  ) {
    should_ask_question = false;
    question_softness = 'no_question';
    reply_shape = 'sit_no_question';
    next_best_question_focus = null;
  }

  const incidentalPlaceDecision = isLifeDecision && specifics.places.length > 0;
  const avoid_topics = [
    ...(incidentalPlaceDecision
      ? ['forced Tobago or Scarborough scenery', 'sensory postcard detail']
      : []),
    ...(moment_type !== 'place_memory' ? ['uninvited place lecture'] : []),
    ...(conversation_momentum === 'thin' ? ['another profile-field push'] : []),
    ...(moment_type === 'logistical_answer' ? ['stopping after name capture', 'welcome GIF'] : []),
    ...(isWorkDepthExhausted ? ['more work-detail probing', 'asking what the case involves', 'third work follow-up'] : []),
    ...(isRecoveryAfterShortAck ? ['stalling with got you', 'no-question acknowledgement'] : []),
  ];

  const specifics_to_name = dedupe([
    ...specifics.known_companies,
    ...specifics.roles,
    ...specifics.numeric_facts,
    ...specifics.titled_caps,
    ...(moment_type === 'logistical_answer' ? specifics.places : []),
    ...(moment_type === 'place_memory' || moment_type === 'identity_roots' ? specifics.places : []),
  ], 6);

  return {
    moment_type,
    reply_shape,
    emotional_priority,
    should_ask_question,
    question_softness,
    conversation_momentum,
    specifics_to_name,
    avoid_topics,
    next_best_question_focus,
    rationale: [
      `moment=${moment_type}`,
      `priority=${emotional_priority}`,
      `momentum=${conversation_momentum}`,
      `shape=${reply_shape}`,
    ].join('; '),
  };
}

export function formatAvaTurnPlan(plan: AvaTurnPlan): string {
  const shape = AVA_RESPONSE_SHAPES[plan.reply_shape];
  return [
    `- Moment type: ${plan.moment_type}`,
    `- Emotional priority: ${plan.emotional_priority}`,
    `- Conversation momentum: ${plan.conversation_momentum}`,
    `- Required reply shape: ${plan.reply_shape} — ${shape}`,
    `- Ask a question this turn: ${plan.should_ask_question ? 'yes' : 'no'}`,
    `- Question softness: ${plan.question_softness}`,
    `- Specifics to name if natural: ${plan.specifics_to_name.length ? plan.specifics_to_name.join(', ') : '(none)'}`,
    `- Avoid: ${plan.avoid_topics.length ? plan.avoid_topics.join(', ') : '(none)'}`,
    `- Next best question focus: ${plan.next_best_question_focus ?? '(none)'}`,
    `- Planner rationale: ${plan.rationale}`,
  ].join('\n');
}
