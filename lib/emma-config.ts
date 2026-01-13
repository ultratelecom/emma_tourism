/**
 * Emma Configuration System
 * 
 * Centralized configuration for Emma's behavior, features, and multi-language support.
 */

// ============================================
// FEATURE FLAGS
// ============================================

export const EMMA_FEATURES = {
  // Core features
  user_recognition: true,
  conversation_memory: true,
  ai_responses: true,
  gif_reactions: true,
  
  // Intelligence features
  personality_learning: true,
  proactive_suggestions: true,
  sentiment_analysis: true,
  
  // Advanced features
  complaint_escalation: true,
  real_time_memory_extraction: true,
  conversation_summarization: true,
  
  // Future features (ready but disabled)
  multi_language: false,
  voice_input: false,
  push_notifications: false,
  whatsapp_integration: false,
  google_places_integration: false,
};

// ============================================
// MULTI-LANGUAGE SUPPORT (Prepared)
// ============================================

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de';

export const LANGUAGE_CONFIG: Record<SupportedLanguage, {
  name: string;
  flag: string;
  greeting: string;
  enabled: boolean;
}> = {
  en: {
    name: 'English',
    flag: '🇬🇧',
    greeting: 'Hey there!',
    enabled: true,
  },
  es: {
    name: 'Español',
    flag: '🇪🇸',
    greeting: '¡Hola!',
    enabled: false, // Ready to enable
  },
  fr: {
    name: 'Français',
    flag: '🇫🇷',
    greeting: 'Bonjour!',
    enabled: false, // Ready to enable
  },
  de: {
    name: 'Deutsch',
    flag: '🇩🇪',
    greeting: 'Hallo!',
    enabled: false, // Ready to enable
  },
};

// ============================================
// EMMA'S PERSONALITY CONFIG
// ============================================

export const EMMA_PERSONALITY = {
  name: 'Emma',
  role: 'Tourism Concierge',
  location: 'Tobago',
  
  // Tone settings
  formality: 'casual', // 'casual' | 'balanced' | 'formal'
  enthusiasm: 'high',  // 'low' | 'medium' | 'high'
  emoji_usage: 'moderate', // 'none' | 'minimal' | 'moderate' | 'frequent'
  
  // Response limits
  max_response_words: 30,
  max_response_sentences: 2,
  
  // Conversation style
  caribbean_slang: true,
  local_knowledge: true,
  personalization: true,
};

// ============================================
// API RATE LIMITS
// ============================================

export const RATE_LIMITS = {
  // Per IP/user limits per minute
  chat_messages: 30,
  ai_responses: 20,
  gif_requests: 40,
  rating_submissions: 10,
  
  // Daily limits
  daily_conversations_per_user: 50,
  daily_ratings_per_user: 20,
};

// ============================================
// TOBAGO KNOWLEDGE BASE (Future: Move to DB)
// ============================================

export const TOBAGO_KNOWLEDGE = {
  facts: {
    rainforest: 'Oldest legally protected rainforest in the Western Hemisphere (since 1776)',
    location: 'Caribbean island, part of Trinidad and Tobago',
    airport: 'ANR Robinson International Airport (TAB)',
    ferry: 'Regular ferry service to Trinidad (Port of Spain)',
    time_zone: 'AST (UTC-4)',
  },
  
  popular_places: {
    beaches: [
      'Pigeon Point',
      'Store Bay',
      'Englishman\'s Bay',
      'Castara Bay',
      'Parlatuvier Bay',
      'Man-O-War Bay',
    ],
    attractions: [
      'Main Ridge Forest Reserve',
      'Argyle Waterfall',
      'Fort King George',
      'Nylon Pool',
      'Buccoo Reef',
      'Little Tobago',
    ],
    restaurants: [
      'Store Bay Facilities',
      'Jemma\'s Tree House',
      'Kariwak Village',
      'Café Coco',
      'The Seahorse Inn',
    ],
  },
  
  events: {
    weekly: {
      sunday: 'Sunday School party in Buccoo',
    },
    annual: {
      easter: 'Goat and Crab Racing',
      july_august: 'Tobago Heritage Festival',
      october: 'Blue Food Festival',
    },
    seasonal: {
      march_august: 'Leatherback turtle nesting season',
    },
  },
};

// ============================================
// MESSAGE TEMPLATES (For multi-lang prep)
// ============================================

export const MESSAGE_TEMPLATES = {
  welcome: {
    new_user: 'Hey there! 👋',
    returning_user: '{name}! You\'re back! 🎉',
    introduction: 'I\'m Emma, your Tobago welcome buddy!',
  },
  
  prompts: {
    ask_name: 'What\'s your name?',
    ask_email: 'Drop your email - I\'ll send you some island tips! 📧',
    ask_arrival: 'How did you get to Tobago?',
    ask_rating: 'How was your journey here?',
    ask_activities: 'What excites you most about Tobago?',
  },
  
  reactions: {
    name_positive: 'Love that name! 😎',
    email_thanks: 'Thanks! Good stuff coming your way! 🌴',
    rating_high: 'Smooth sailing! 🎉',
    rating_low: 'Tobago will make up for it! 💪',
  },
  
  errors: {
    invalid_email: 'Hmm, that doesn\'t look right - try again?',
    generic_error: 'Oops! Something went wrong. Let\'s try again.',
  },
  
  completion: {
    farewell: 'Have an amazing time in Tobago! 🌺',
    survey_complete: 'You\'re officially ready for Tobago! 🎊',
  },
};

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Get localized message template
 */
export function getMessage(
  key: string,
  language: SupportedLanguage = 'en',
  variables?: Record<string, string>
): string {
  // Currently returns English - ready for multi-lang
  const keys = key.split('.');
  let template: unknown = MESSAGE_TEMPLATES;
  
  for (const k of keys) {
    if (template && typeof template === 'object' && k in template) {
      template = (template as Record<string, unknown>)[k];
    } else {
      return key; // Return key if not found
    }
  }
  
  if (typeof template !== 'string') return key;
  
  // Replace variables
  let message = template;
  if (variables) {
    for (const [varKey, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`\\{${varKey}\\}`, 'g'), value);
    }
  }
  
  return message;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof EMMA_FEATURES): boolean {
  return EMMA_FEATURES[feature] ?? false;
}

/**
 * Get supported languages (enabled only)
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return (Object.entries(LANGUAGE_CONFIG) as [SupportedLanguage, typeof LANGUAGE_CONFIG['en']][])
    .filter(([_, config]) => config.enabled)
    .map(([lang]) => lang);
}
