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
  
  entryMessage: "I'm all ears! 👂 What's on your mind?",
  
  questions: [
    // Free chat doesn't have structured questions
    // It relies on AI-powered responses
  ],
  
  followUpPrompts: {
    greeting: [
      "Hey! How's your Tobago adventure going? 🌴",
      "Hi there! What can I help you with?",
      "Hello! Great to chat with you!",
    ],
    question: [
      "Good question! Let me think...",
      "Hmm, that's interesting!",
      "I love that you're curious!",
    ],
    positive: [
      "That's awesome! 🎉",
      "Love hearing that!",
      "So glad you're enjoying it!",
    ],
    negative: [
      "Oh no, I'm sorry to hear that! 😔",
      "That's frustrating, I understand.",
      "Let me see if I can help...",
    ],
    thanks: [
      "You're so welcome! 💕",
      "Happy to help!",
      "Anytime! That's what I'm here for!",
    ],
  },
  
  exitConditions: [
    'bye', 'goodbye', 'see you', 'later', 'gotta go', 'leaving'
  ],
  
  gifType: 'excited',
};

/**
 * Free chat response prompts for AI
 */
export const FREE_CHAT_PROMPTS = {
  general: `You're having a casual conversation with a tourist in Tobago.
Be friendly, helpful, and inject local knowledge when relevant.
Keep responses conversational and under 2 sentences.
If they mention a place, show interest and maybe offer a related tip.`,

  question: `The user is asking a question about Tobago.
Answer helpfully using your knowledge of the island.
Keep it concise - 2-3 sentences max.
If you're not sure, say so and suggest where they might find info.`,

  recommendation: `The user wants a recommendation for something in Tobago.
Give ONE specific recommendation with a brief reason why.
Include location if relevant.
Sound like a local friend, not a guidebook.`,

  complaint: `The user is expressing frustration about something.
Be empathetic first, then helpful.
Don't be defensive about Tobago - acknowledge issues exist.
Offer constructive suggestions if possible.`,

  story: `The user is sharing a story about their experience.
Be an engaged listener.
React naturally with appropriate emotion.
Ask a follow-up question to keep the conversation going.`,
};

/**
 * Detect the intent of a free-form message
 */
export function detectIntent(message: string): 'question' | 'recommendation' | 'complaint' | 'story' | 'general' {
  const lowered = message.toLowerCase();
  
  // Question indicators
  if (lowered.includes('?') || 
      lowered.startsWith('what') ||
      lowered.startsWith('where') ||
      lowered.startsWith('when') ||
      lowered.startsWith('how') ||
      lowered.startsWith('why') ||
      lowered.startsWith('is there') ||
      lowered.startsWith('are there') ||
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
      lowered.includes('what should')) {
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
      lowered.includes('frustrated')) {
    return 'complaint';
  }
  
  // Story telling (longer messages about experiences)
  if (message.length > 100 ||
      lowered.includes('we went') ||
      lowered.includes('i went') ||
      lowered.includes('yesterday') ||
      lowered.includes('today we') ||
      lowered.includes('last night')) {
    return 'story';
  }
  
  return 'general';
}

/**
 * Get AI prompt for free chat based on intent
 */
export function getFreeChatPrompt(intent: string): string {
  return FREE_CHAT_PROMPTS[intent as keyof typeof FREE_CHAT_PROMPTS] || FREE_CHAT_PROMPTS.general;
}
