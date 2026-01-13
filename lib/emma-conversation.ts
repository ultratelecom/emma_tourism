/**
 * Emma Conversation Management
 * 
 * Handles conversation summarization, memory extraction, and topic tracking.
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  getConversationByToken,
  getConversationMessages,
  updateConversation,
  endConversation,
  saveMemory,
  EmmaMessage,
} from './emma-db';

// ============================================
// CONVERSATION SUMMARIZATION
// ============================================

/**
 * Generate a summary of a conversation using AI
 */
export async function summarizeConversation(sessionToken: string): Promise<{
  summary: string;
  keyTopics: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
} | null> {
  const conversation = await getConversationByToken(sessionToken);
  if (!conversation) return null;
  
  const messages = await getConversationMessages(conversation.id);
  if (messages.length < 3) {
    return {
      summary: 'Brief conversation',
      keyTopics: [conversation.topic || 'general'],
      sentiment: 'neutral',
    };
  }
  
  // Build conversation transcript
  const transcript = messages
    .map(m => `${m.sender.toUpperCase()}: ${m.content}`)
    .join('\n');
  
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You analyze conversations and extract key information.
Output JSON with: summary (2-3 sentences), keyTopics (array of 2-5 topics), sentiment (positive/negative/neutral/mixed).
Be concise. Focus on what the user shared about themselves and their Tobago experience.`,
      prompt: `Summarize this conversation:\n\n${transcript}`,
      temperature: 0.3,
    });
    
    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Conversation completed',
        keyTopics: parsed.keyTopics || [conversation.topic || 'general'],
        sentiment: parsed.sentiment || 'neutral',
      };
    }
    
    return {
      summary: text.slice(0, 200),
      keyTopics: [conversation.topic || 'general'],
      sentiment: 'neutral',
    };
  } catch (error) {
    console.error('Summarization error:', error);
    return {
      summary: `Conversation about ${conversation.topic || 'Tobago visit'}`,
      keyTopics: [conversation.topic || 'general'],
      sentiment: 'neutral',
    };
  }
}

/**
 * End a conversation and generate summary
 */
export async function completeConversation(sessionToken: string): Promise<void> {
  const summary = await summarizeConversation(sessionToken);
  
  const conversation = await getConversationByToken(sessionToken);
  if (!conversation) return;
  
  await updateConversation(conversation.id, {
    summary: summary?.summary,
    key_topics: summary?.keyTopics,
    status: 'completed',
  });
  
  await endConversation(conversation.id, summary?.summary);
}

// ============================================
// MEMORY EXTRACTION
// ============================================

interface ExtractedMemory {
  type: 'rating' | 'preference' | 'mention' | 'complaint' | 'recommendation';
  category?: string;
  subject?: string;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  rating?: number;
  text: string;
  importance: number;
}

/**
 * Extract memories from a conversation using AI
 */
export async function extractMemoriesFromConversation(
  sessionToken: string,
  userId: string
): Promise<ExtractedMemory[]> {
  const conversation = await getConversationByToken(sessionToken);
  if (!conversation) return [];
  
  const messages = await getConversationMessages(conversation.id);
  if (messages.length < 2) return [];
  
  // Filter to user messages only
  const userMessages = messages.filter(m => m.sender === 'user');
  if (userMessages.length === 0) return [];
  
  const userText = userMessages.map(m => m.content).join('\n');
  
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You extract key information from tourist conversations about Tobago.
Extract and return JSON array of memories with fields:
- type: 'rating' | 'preference' | 'mention' | 'complaint' | 'recommendation'
- category: 'restaurant' | 'beach' | 'activity' | 'transport' | 'accommodation' | 'general'
- subject: specific place or thing mentioned (if any)
- sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
- rating: 1-5 if they gave a rating
- text: original text or summary
- importance: 1-10 (10 = very important to remember)

Only extract meaningful information. Ignore greetings and small talk.
If nothing meaningful, return empty array [].`,
      prompt: `Extract memories from these user messages:\n\n${userText}`,
      temperature: 0.2,
    });
    
    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const memories = JSON.parse(jsonMatch[0]) as ExtractedMemory[];
      return memories.filter(m => m.importance >= 3); // Only keep important ones
    }
    
    return [];
  } catch (error) {
    console.error('Memory extraction error:', error);
    return [];
  }
}

/**
 * Process and save extracted memories
 */
export async function processAndSaveMemories(
  sessionToken: string,
  userId: string,
  conversationId: string
): Promise<number> {
  const memories = await extractMemoriesFromConversation(sessionToken, userId);
  
  let savedCount = 0;
  
  for (const memory of memories) {
    try {
      await saveMemory(userId, {
        memory_type: memory.type,
        category: memory.category,
        subject: memory.subject,
        sentiment: memory.sentiment,
        rating: memory.rating,
        raw_text: memory.text,
        conversation_id: conversationId,
        importance: memory.importance,
      });
      savedCount++;
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  }
  
  return savedCount;
}

// ============================================
// REAL-TIME MEMORY EXTRACTION
// ============================================

/**
 * Extract memory from a single message (for real-time processing)
 */
export async function extractMemoryFromMessage(
  content: string,
  context: { userName?: string; topic?: string }
): Promise<ExtractedMemory | null> {
  // Skip short messages
  if (content.length < 20) return null;
  
  // Skip common greetings/confirmations
  const skipPatterns = [
    /^(hi|hello|hey|yes|no|ok|okay|thanks|thank you)[\s!.]*$/i,
    /^(my name is|i'm|i am)/i,
    /^[\w\d.@+-]+@[\w\d.-]+$/i, // Email
  ];
  
  if (skipPatterns.some(p => p.test(content))) return null;
  
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `Extract key information from a tourist message about Tobago.
If the message contains something worth remembering (a preference, rating, complaint, or recommendation), return JSON:
{
  "type": "rating|preference|mention|complaint|recommendation",
  "category": "restaurant|beach|activity|transport|accommodation|general",
  "subject": "specific place or thing",
  "sentiment": "positive|negative|neutral|mixed",
  "rating": 1-5 or null,
  "text": "summary of what to remember",
  "importance": 1-10
}
If nothing worth remembering, return: null`,
      prompt: `Context: User ${context.userName || 'visitor'} discussing ${context.topic || 'Tobago visit'}\nMessage: "${content}"`,
      temperature: 0.2,
    });
    
    if (text.includes('null') || text.trim() === 'null') {
      return null;
    }
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const memory = JSON.parse(jsonMatch[0]) as ExtractedMemory;
      if (memory.importance >= 4) {
        return memory;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Real-time extraction error:', error);
    return null;
  }
}

// ============================================
// PERSONALITY DETECTION
// ============================================

/**
 * Detect personality traits from conversation
 */
export async function detectPersonalityTraits(
  sessionToken: string
): Promise<string[]> {
  const conversation = await getConversationByToken(sessionToken);
  if (!conversation) return [];
  
  const messages = await getConversationMessages(conversation.id);
  const userMessages = messages.filter(m => m.sender === 'user');
  
  if (userMessages.length < 3) return [];
  
  const userText = userMessages.map(m => m.content).join('\n');
  
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `Analyze tourist messages and identify personality traits.
Return JSON array of 1-4 traits from: ["adventurous", "foodie", "relaxed", "budget-conscious", "luxury-seeker", "nature-lover", "culture-enthusiast", "party-goer", "family-oriented", "photographer", "early-bird", "night-owl"]
Only include traits you're confident about based on the messages.
Return empty array [] if not enough information.`,
      prompt: `Identify personality traits:\n\n${userText}`,
      temperature: 0.3,
    });
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];
  } catch (error) {
    console.error('Personality detection error:', error);
    return [];
  }
}
