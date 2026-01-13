/**
 * Emma AI Context Builder
 * 
 * Builds comprehensive context from user data to inject into AI prompts
 * for personalized, memory-aware responses.
 */

import {
  getUserById,
  getUserMemories,
  getUserRatings,
  getUserConversations,
  EmmaUser,
  EmmaMemory,
  EmmaRating,
  EmmaConversation,
} from './emma-db';

export interface UserContext {
  user: EmmaUser;
  memories: EmmaMemory[];
  ratings: EmmaRating[];
  conversations: EmmaConversation[];
  summary: string;
}

/**
 * Format relative time for human-readable context
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Build a comprehensive user context for AI prompts
 */
export async function buildUserContext(userId: string): Promise<UserContext | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  
  const [memories, ratings, conversations] = await Promise.all([
    getUserMemories(userId, { limit: 15 }),
    getUserRatings(userId, 10),
    getUserConversations(userId, 5),
  ]);
  
  const summary = buildContextSummary(user, memories, ratings, conversations);
  
  return {
    user,
    memories,
    ratings,
    conversations,
    summary,
  };
}

/**
 * Build a text summary of user context for AI prompt injection
 */
function buildContextSummary(
  user: EmmaUser,
  memories: EmmaMemory[],
  ratings: EmmaRating[],
  conversations: EmmaConversation[]
): string {
  let context = `## User Profile
- Name: ${user.name}
- Visit count: ${user.visit_count}
- Last seen: ${formatRelativeTime(user.last_seen_at)}
- First visited: ${formatRelativeTime(user.first_seen_at)}
- Arrived via: ${user.arrival_method || 'Unknown'}
`;

  // Add personality if known
  if (user.personality_tags && user.personality_tags.length > 0) {
    context += `- Personality: ${user.personality_tags.join(', ')}\n`;
  }
  
  if (user.personality_notes) {
    context += `- Notes: ${user.personality_notes}\n`;
  }

  // Add memories
  if (memories.length > 0) {
    context += `\n## Things I Remember\n`;
    
    // Group by type
    const ratingMemories = memories.filter(m => m.memory_type === 'rating');
    const preferenceMemories = memories.filter(m => m.memory_type === 'preference');
    const mentionMemories = memories.filter(m => m.memory_type === 'mention');
    const complaintMemories = memories.filter(m => m.memory_type === 'complaint');
    
    if (ratingMemories.length > 0) {
      context += `### Ratings given:\n`;
      for (const m of ratingMemories.slice(0, 5)) {
        context += `- ${m.subject || m.category}: ${m.rating}⭐ ${m.sentiment ? `(${m.sentiment})` : ''}\n`;
      }
    }
    
    if (preferenceMemories.length > 0) {
      context += `### Preferences:\n`;
      for (const m of preferenceMemories.slice(0, 5)) {
        context += `- ${m.raw_text || m.ai_summary || m.subject}\n`;
      }
    }
    
    if (mentionMemories.length > 0) {
      context += `### Things they mentioned:\n`;
      for (const m of mentionMemories.slice(0, 3)) {
        context += `- "${m.raw_text?.slice(0, 100) || m.subject}"\n`;
      }
    }
    
    if (complaintMemories.length > 0) {
      context += `### Issues reported:\n`;
      for (const m of complaintMemories.slice(0, 2)) {
        context += `- ${m.subject}: ${m.raw_text?.slice(0, 100) || 'No details'}\n`;
      }
    }
  }

  // Add ratings
  if (ratings.length > 0) {
    context += `\n## Places Rated\n`;
    for (const r of ratings.slice(0, 5)) {
      const recommendation = r.would_recommend ? ' (recommended)' : r.would_recommend === false ? ' (not recommended)' : '';
      context += `- ${r.place_name} (${r.category}): ${r.overall_rating}⭐${recommendation}\n`;
      if (r.review_text) {
        context += `  "${r.review_text.slice(0, 80)}..."\n`;
      }
    }
  }

  // Add conversation history
  if (conversations.length > 1) {
    context += `\n## Conversation History\n`;
    context += `- Total conversations: ${conversations.length}\n`;
    
    const lastConvo = conversations[0];
    if (lastConvo.summary) {
      context += `- Last conversation topic: ${lastConvo.topic}\n`;
      context += `- Summary: ${lastConvo.summary}\n`;
    }
    
    if (lastConvo.key_topics && lastConvo.key_topics.length > 0) {
      context += `- Topics discussed: ${lastConvo.key_topics.join(', ')}\n`;
    }
  }

  return context;
}

/**
 * Build a short context for quick AI prompts
 */
export async function buildShortContext(userId: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user) return 'New user';
  
  const memories = await getUserMemories(userId, { limit: 3 });
  const ratings = await getUserRatings(userId, 2);
  
  let context = `${user.name} (visit #${user.visit_count})`;
  
  if (user.personality_tags && user.personality_tags.length > 0) {
    context += ` - ${user.personality_tags.slice(0, 2).join(', ')}`;
  }
  
  if (ratings.length > 0) {
    const lastRating = ratings[0];
    context += `. Last rated: ${lastRating.place_name} ${lastRating.overall_rating}⭐`;
  }
  
  return context;
}

/**
 * Extract key context points for a specific topic
 */
export async function getTopicContext(userId: string, topic: string): Promise<string> {
  const memories = await getUserMemories(userId, { 
    category: topic,
    limit: 5 
  });
  const ratings = await getUserRatings(userId, 10);
  
  const relevantRatings = ratings.filter(r => r.category === topic);
  
  let context = '';
  
  if (relevantRatings.length > 0) {
    context += `Previous ${topic} ratings:\n`;
    for (const r of relevantRatings.slice(0, 3)) {
      context += `- ${r.place_name}: ${r.overall_rating}⭐\n`;
    }
  }
  
  if (memories.length > 0) {
    context += `\nRelevant memories:\n`;
    for (const m of memories) {
      context += `- ${m.raw_text || m.ai_summary || m.subject}\n`;
    }
  }
  
  return context || `No previous ${topic} data`;
}
