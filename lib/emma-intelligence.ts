/**
 * Emma Intelligence Layer
 * 
 * Personality learning, proactive suggestions, and smart recommendations.
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  getUserById,
  updateUser,
  getUserMemories,
  getUserRatings,
  addPersonalityTag,
  EmmaUser,
  EmmaMemory,
  EmmaRating,
} from './emma-db';

// ============================================
// PERSONALITY LEARNING
// ============================================

/**
 * Personality trait definitions
 */
export const PERSONALITY_TRAITS = {
  adventurous: {
    indicators: ['adventure', 'hiking', 'diving', 'waterfall', 'explore', 'zip line', 'off the beaten path'],
    activities: ['Main Ridge hike', 'Argyle Waterfall', 'diving at Speyside'],
  },
  foodie: {
    indicators: ['food', 'restaurant', 'eat', 'cuisine', 'local food', 'dish', 'taste'],
    activities: ['food tour', 'local restaurants', 'cooking class'],
  },
  relaxed: {
    indicators: ['relax', 'chill', 'quiet', 'peaceful', 'calm', 'slow', 'beach'],
    activities: ['quiet beaches', 'spa', 'sunset watching'],
  },
  'budget-conscious': {
    indicators: ['cheap', 'budget', 'affordable', 'free', 'save', 'expensive', 'cost'],
    activities: ['free beaches', 'local food stalls', 'self-guided tours'],
  },
  'luxury-seeker': {
    indicators: ['luxury', 'best', 'premium', 'high-end', 'exclusive', 'upscale', 'fancy'],
    activities: ['fine dining', 'private tours', 'luxury resorts'],
  },
  'nature-lover': {
    indicators: ['nature', 'bird', 'wildlife', 'rainforest', 'ecosystem', 'turtle', 'animal'],
    activities: ['birding tours', 'turtle watching', 'rainforest hikes'],
  },
  'culture-enthusiast': {
    indicators: ['culture', 'history', 'local', 'traditional', 'heritage', 'authentic'],
    activities: ['Fort King George', 'local villages', 'cultural events'],
  },
  'party-goer': {
    indicators: ['party', 'nightlife', 'dancing', 'music', 'sunday school', 'bar'],
    activities: ['Sunday School', 'beach bars', 'nightlife spots'],
  },
  'family-oriented': {
    indicators: ['family', 'kids', 'children', 'safe', 'family-friendly'],
    activities: ['calm beaches', 'glass bottom boats', 'family resorts'],
  },
  photographer: {
    indicators: ['photo', 'picture', 'instagram', 'shot', 'view', 'scenic', 'camera'],
    activities: ['scenic viewpoints', 'golden hour spots', 'iconic locations'],
  },
};

/**
 * Analyze user's messages and memories to detect personality traits
 */
export async function analyzePersonality(userId: string): Promise<string[]> {
  const memories = await getUserMemories(userId, { limit: 30 });
  const ratings = await getUserRatings(userId, 20);
  
  const detectedTraits: Record<string, number> = {};
  
  // Analyze memories
  for (const memory of memories) {
    const text = (memory.raw_text || memory.ai_summary || '').toLowerCase();
    
    for (const [trait, data] of Object.entries(PERSONALITY_TRAITS)) {
      for (const indicator of data.indicators) {
        if (text.includes(indicator)) {
          detectedTraits[trait] = (detectedTraits[trait] || 0) + 1;
        }
      }
    }
  }
  
  // Analyze ratings
  for (const rating of ratings) {
    const category = rating.category.toLowerCase();
    const reviewText = (rating.review_text || '').toLowerCase();
    
    // Category-based inference
    if (category === 'restaurant') {
      detectedTraits['foodie'] = (detectedTraits['foodie'] || 0) + 2;
    }
    if (category === 'beach') {
      detectedTraits['relaxed'] = (detectedTraits['relaxed'] || 0) + 1;
    }
    if (category === 'activity') {
      detectedTraits['adventurous'] = (detectedTraits['adventurous'] || 0) + 1;
    }
    
    // Review text analysis
    for (const [trait, data] of Object.entries(PERSONALITY_TRAITS)) {
      for (const indicator of data.indicators) {
        if (reviewText.includes(indicator)) {
          detectedTraits[trait] = (detectedTraits[trait] || 0) + 1;
        }
      }
    }
  }
  
  // Get top traits (score > 2)
  const topTraits = Object.entries(detectedTraits)
    .filter(([_, score]) => score > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([trait]) => trait);
  
  return topTraits;
}

/**
 * Update user's personality tags based on analysis
 */
export async function updateUserPersonality(userId: string): Promise<string[]> {
  const traits = await analyzePersonality(userId);
  
  for (const trait of traits) {
    await addPersonalityTag(userId, trait);
  }
  
  return traits;
}

// ============================================
// PROACTIVE SUGGESTIONS
// ============================================

export interface Suggestion {
  type: 'activity' | 'restaurant' | 'beach' | 'tip' | 'question';
  title: string;
  description: string;
  reason: string;
  priority: number; // 1-10
}

/**
 * Generate personalized suggestions based on user profile
 */
export async function generateSuggestions(userId: string): Promise<Suggestion[]> {
  const user = await getUserById(userId);
  if (!user) return [];
  
  const memories = await getUserMemories(userId, { limit: 10 });
  const ratings = await getUserRatings(userId, 10);
  const traits = user.personality_tags || [];
  
  const suggestions: Suggestion[] = [];
  
  // Trait-based suggestions
  if (traits.includes('foodie') && !ratings.some(r => r.category === 'restaurant')) {
    suggestions.push({
      type: 'restaurant',
      title: 'Try Store Bay!',
      description: 'Best crab & dumpling and bake & shark on the island',
      reason: 'You seem like a foodie!',
      priority: 8,
    });
  }
  
  if (traits.includes('adventurous') && !memories.some(m => m.subject?.includes('Argyle'))) {
    suggestions.push({
      type: 'activity',
      title: 'Argyle Waterfall',
      description: 'The tallest waterfall in Tobago - beautiful hike!',
      reason: 'Perfect for adventurers like you',
      priority: 9,
    });
  }
  
  if (traits.includes('nature-lover') && !memories.some(m => m.subject?.includes('Main Ridge'))) {
    suggestions.push({
      type: 'activity',
      title: 'Main Ridge Rainforest',
      description: 'Oldest protected rainforest in the Western Hemisphere',
      reason: 'A must for nature lovers!',
      priority: 9,
    });
  }
  
  if (traits.includes('party-goer')) {
    const today = new Date().getDay();
    if (today === 0) { // Sunday
      suggestions.push({
        type: 'activity',
        title: 'Sunday School Tonight!',
        description: 'The famous party in Buccoo - don\'t miss it!',
        reason: 'It\'s Sunday! The party is on!',
        priority: 10,
      });
    }
  }
  
  // Rating-based suggestions
  const restaurantRatings = ratings.filter(r => r.category === 'restaurant');
  if (restaurantRatings.length > 0) {
    const avgRating = restaurantRatings.reduce((sum, r) => sum + r.overall_rating, 0) / restaurantRatings.length;
    
    if (avgRating >= 4) {
      suggestions.push({
        type: 'question',
        title: 'Rate another spot?',
        description: 'You\'ve tried some great places! Discover any new ones?',
        reason: 'Your reviews help other visitors!',
        priority: 6,
      });
    }
  }
  
  // Time-based suggestions
  const hour = new Date().getHours();
  
  if (hour >= 11 && hour <= 14) {
    suggestions.push({
      type: 'tip',
      title: 'Lunch time!',
      description: 'Head to Store Bay for local food or Café Coco for beachside dining',
      reason: 'It\'s lunch time in Tobago!',
      priority: 5,
    });
  }
  
  if (hour >= 17 && hour <= 19) {
    suggestions.push({
      type: 'tip',
      title: 'Golden hour approaching!',
      description: 'Pigeon Point and Englishman\'s Bay have amazing sunsets',
      reason: 'Don\'t miss the sunset!',
      priority: 7,
    });
  }
  
  // Sort by priority
  return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

/**
 * Generate an AI-powered personalized suggestion
 */
export async function generateAISuggestion(userId: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user) return "Have you checked out Pigeon Point yet? It's iconic! 🏖️";
  
  const memories = await getUserMemories(userId, { limit: 5 });
  const ratings = await getUserRatings(userId, 3);
  
  const context = `User: ${user.name}
Personality: ${user.personality_tags?.join(', ') || 'Unknown'}
Recent places visited: ${ratings.map(r => r.place_name).join(', ') || 'None yet'}
Interests mentioned: ${memories.map(m => m.subject || m.category).filter(Boolean).join(', ') || 'General'}`;

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You're Emma, making a personalized Tobago recommendation.
Based on what you know about this visitor, suggest ONE specific thing they should do.
Keep it to 1-2 sentences. Be specific with place names.
Sound like a friend, not a tour guide.`,
      prompt: context,
      temperature: 0.9,
    });
    
    return text.trim();
  } catch (error) {
    console.error('AI suggestion error:', error);
    return "The Main Ridge rainforest is incredible - you should check it out! 🌿";
  }
}

// ============================================
// SENTIMENT ANALYSIS
// ============================================

/**
 * Analyze overall sentiment from user's interactions
 */
export async function analyzeUserSentiment(userId: string): Promise<{
  overall: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  score: number;
  breakdown: Record<string, number>;
}> {
  const memories = await getUserMemories(userId, { limit: 50 });
  const ratings = await getUserRatings(userId, 20);
  
  const breakdown: Record<string, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  
  // Count memory sentiments
  for (const memory of memories) {
    if (memory.sentiment === 'positive') breakdown.positive++;
    else if (memory.sentiment === 'negative') breakdown.negative++;
    else breakdown.neutral++;
  }
  
  // Factor in ratings
  for (const rating of ratings) {
    if (rating.overall_rating >= 4) breakdown.positive++;
    else if (rating.overall_rating <= 2) breakdown.negative++;
    else breakdown.neutral++;
  }
  
  const total = breakdown.positive + breakdown.neutral + breakdown.negative;
  if (total === 0) {
    return { overall: 'neutral', score: 0.5, breakdown };
  }
  
  const score = (breakdown.positive - breakdown.negative) / total;
  
  let overall: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  if (score > 0.5) overall = 'very_positive';
  else if (score > 0.2) overall = 'positive';
  else if (score > -0.2) overall = 'neutral';
  else if (score > -0.5) overall = 'negative';
  else overall = 'very_negative';
  
  return { overall, score: (score + 1) / 2, breakdown };
}
