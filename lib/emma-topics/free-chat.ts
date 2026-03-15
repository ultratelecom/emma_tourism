/**
 * Free Chat Topic Module
 *
 * Handles open-ended conversation with memory integration.
 */

import { TopicModule } from './index';

export const freeChatTopic: TopicModule = {
  id: 'free_chat',
  name: 'Just Chat',
  description: 'Have a conversation with Emma',

  triggers: [
    'chat', 'talk', 'hey', 'hi', 'hello', 'what\'s up', 'how are you',
    'tell me', 'know about', 'question', 'help', 'need', 'want'
  ],

  entryMessage: "I'm all ears! What's on your mind?",

  questions: [
    // Free chat doesn't have structured questions
    // It relies on AI-powered responses
  ],

  followUpPrompts: {
    greeting: [
      "Hey! How's your Tobago adventure going?",
      "Hi there! What can I help you with?",
      "Hello! Great to chat with you!",
    ],
    question: [
      "Good question! Let me think...",
      "Hmm, that's interesting!",
      "I love that you're curious!",
    ],
    positive: [
      "That's awesome!",
      "Love hearing that!",
      "So glad you're enjoying it!",
    ],
    negative: [
      "I'm sorry to hear that.",
      "That's frustrating, I understand.",
      "Let me see if I can help...",
    ],
    thanks: [
      "You're welcome!",
      "Happy to help!",
      "Anytime! That's what I'm here for.",
    ],
  },

  exitConditions: [
    'bye', 'goodbye', 'see you', 'later', 'gotta go', 'leaving'
  ],

  // GIF type determined dynamically per message, not statically
  gifType: undefined as unknown as string,
};

/**
 * Free chat response prompts for AI
 */
export const FREE_CHAT_PROMPTS: Record<string, string> = {
  general: `You're having a casual conversation with a tourist in Tobago.
Be friendly, helpful, and inject local knowledge when relevant.
Keep responses conversational and under 2 sentences.
If they mention a place, show interest and maybe offer a related tip.`,

  question: `The user is asking a question about Tobago.
Answer helpfully and directly using your knowledge of the island.
Keep it concise, 2-3 sentences max.
If you're not sure, say so honestly.`,

  recommendation: `The user wants a recommendation for something in Tobago.
Give ONE specific recommendation with a brief reason why.
Include the location and an insider detail (best time, what to order, hidden spot).
Sound like a local friend sharing a favorite.`,

  complaint: `The user is expressing frustration about something.
Be empathetic first, then helpful. Don't be defensive about Tobago.
Acknowledge that issues exist and offer a constructive alternative or suggestion.
Keep it real, not corporate.`,

  story: `The user is sharing a story about their experience.
Be an engaged listener. React naturally with appropriate emotion.
Ask a follow-up question that shows you actually care about their story.
If they mention a place, share a relevant detail or connection.`,

  gratitude: `The user is thanking you.
Be warm but brief. If they're thanking you for a specific recommendation, ask how it went.
1 sentence max. Don't overdo it.`,

  farewell: `The user is saying goodbye.
Give a warm, brief sendoff. If you know what they're interested in, mention one last thing they should try.
1 sentence. Keep it genuine.`,

  comparison: `The user wants to compare two or more options in Tobago.
Give your honest opinion as a local. Don't be wishy-washy, have a preference and say why.
But acknowledge the other option has its merits too.
2-3 sentences max.`,

  planning: `The user is trying to plan their time in Tobago.
Help them think about logistics: distances between spots, realistic timing, what pairs well together.
Be practical and specific. Mention if something is a morning vs afternoon activity.
2-3 sentences. Think like a friend helping plan their day.`,
};

export type FreeChatIntent = 'question' | 'recommendation' | 'complaint' | 'story' | 'greeting' | 'gratitude' | 'farewell' | 'comparison' | 'planning' | 'general';

/**
 * Detect the intent of a free-form message
 */
export function detectIntent(message: string): FreeChatIntent {
  const lowered = message.toLowerCase();

  // Gratitude (check early, before question detection)
  if (/\b(thank|thanks|appreciate|grateful|cheers)\b/.test(lowered)) return 'gratitude';

  // Farewell
  if (/\b(bye|goodbye|see you|later|gotta go|leaving|heading out|take care)\b/.test(lowered)) return 'farewell';

  // Greeting (only if it's mostly just a greeting, not embedded in a longer message)
  if (/^(hi|hello|hey|yo|what's up|howdy|good morning|good afternoon|good evening)[\s!.,]*$/i.test(lowered)) return 'greeting';

  // Comparison (wanting to choose between options)
  if (/\b(better|vs|versus|or\s|compare|which one|difference between|rather)\b/.test(lowered) &&
      lowered.length > 15) return 'comparison';

  // Planning (organizing their trip)
  if (/\b(plan|itinerary|schedule|how long|how many days|morning|afternoon|tomorrow|today|day trip|full day)\b/.test(lowered)) return 'planning';

  // Question indicators
  if (lowered.includes('?') ||
      lowered.startsWith('what') ||
      lowered.startsWith('where') ||
      lowered.startsWith('when') ||
      lowered.startsWith('how') ||
      lowered.startsWith('why') ||
      lowered.startsWith('is there') ||
      lowered.startsWith('are there') ||
      lowered.startsWith('can i') ||
      lowered.startsWith('do you know')) {
    return 'question';
  }

  // Recommendation request
  if (lowered.includes('recommend') ||
      lowered.includes('suggestion') ||
      lowered.includes('should i') ||
      lowered.includes('best place') ||
      lowered.includes('good place') ||
      lowered.includes('where should') ||
      lowered.includes('what should') ||
      lowered.includes('top spots') ||
      lowered.includes('must see') ||
      lowered.includes('must try')) {
    return 'recommendation';
  }

  // Complaint indicators
  if (lowered.includes('disappointed') ||
      lowered.includes('terrible') ||
      lowered.includes('awful') ||
      lowered.includes('rip off') ||
      lowered.includes('ripped off') ||
      lowered.includes('scam') ||
      lowered.includes('problem') ||
      lowered.includes('issue') ||
      lowered.includes('complaint') ||
      lowered.includes('frustrated') ||
      lowered.includes('overcharged') ||
      lowered.includes('worst')) {
    return 'complaint';
  }

  // Story telling (longer messages about experiences)
  if (message.length > 100 ||
      lowered.includes('we went') ||
      lowered.includes('i went') ||
      lowered.includes('yesterday') ||
      lowered.includes('today we') ||
      lowered.includes('last night') ||
      lowered.includes('this morning') ||
      lowered.includes('we visited') ||
      lowered.includes('just came back from')) {
    return 'story';
  }

  return 'general';
}

/**
 * Get AI prompt for free chat based on intent
 */
export function getFreeChatPrompt(intent: string): string {
  return FREE_CHAT_PROMPTS[intent] || FREE_CHAT_PROMPTS.general;
}
