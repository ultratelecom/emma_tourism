import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { 
  getConversationByToken, 
  updateConversation,
  saveMessage,
  getUserById,
} from '@/lib/emma-db';
import { buildUserContext, buildShortContext, getTopicContext } from '@/lib/emma-ai-context';
import { findTopicByTrigger, getTopicById } from '@/lib/emma-topics';
import { detectIntent, getFreeChatPrompt } from '@/lib/emma-topics/free-chat';
import { extractMemoryFromMessage } from '@/lib/emma-conversation';

/**
 * Emma's core system prompt
 */
const EMMA_SYSTEM_PROMPT = `You are Emma, a warm and enthusiastic tourism concierge for Tobago.

CRITICAL RULES:
- Keep responses to 1-2 SHORT sentences (under 25 words each)
- NEVER use em dashes. Use commas or periods instead.
- Use ONE emoji max per message, often zero
- Sound natural like texting a friend, not a robot
- Never start with "Ah" or "Oh"
- Be Caribbean chill, not over-eager

Your knowledge of Tobago:
- Oldest protected rainforest in Western Hemisphere (Main Ridge, since 1776)
- Pigeon Point Beach is iconic with its famous jetty
- Store Bay has the best local food (crab & dumpling, bake & shark)
- Buccoo Reef for snorkeling, Nylon Pool for swimming
- Sunday School party in Buccoo village (Sundays)
- Goat racing at Easter is unique
- Argyle Waterfall is the tallest on the island
- Speyside is the diving capital
- Charlotteville is a peaceful fishing village
- The ferry connects to Trinidad`;

/**
 * POST /api/emma/chat - Handle chat messages
 */
export async function POST(request: NextRequest) {
  try {
    const { session_token, message, user_id, current_topic } = await request.json();
    
    if (!session_token || !message) {
      return NextResponse.json(
        { error: 'session_token and message are required' },
        { status: 400 }
      );
    }
    
    // Get conversation
    const conversation = await getConversationByToken(session_token);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    // Build context
    let userContext = '';
    if (user_id) {
      userContext = await buildShortContext(user_id);
    }
    
    // Detect topic if not already in one
    let topic = current_topic ? getTopicById(current_topic) : null;
    let detectedTopic = null;
    
    if (!topic) {
      detectedTopic = findTopicByTrigger(message);
      if (detectedTopic) {
        topic = detectedTopic;
        // Update conversation topic
        await updateConversation(conversation.id, { topic: detectedTopic.id });
      }
    }
    
    // Detect intent for free chat
    const intent = detectIntent(message);
    
    // Build the prompt
    let contextPrompt = '';
    
    if (userContext) {
      contextPrompt += `\n\nUser context: ${userContext}`;
    }
    
    if (topic && topic.id !== 'free_chat') {
      contextPrompt += `\n\nCurrent topic: ${topic.name}`;
      if (user_id) {
        const topicCtx = await getTopicContext(user_id, topic.id);
        if (topicCtx && !topicCtx.includes('No previous')) {
          contextPrompt += `\n${topicCtx}`;
        }
      }
    }
    
    // Get the system prompt based on context
    let systemPrompt = EMMA_SYSTEM_PROMPT;
    
    if (topic && topic.id === 'free_chat') {
      systemPrompt += `\n\n${getFreeChatPrompt(intent)}`;
    } else if (topic) {
      systemPrompt += `\n\nYou're helping the user ${topic.description.toLowerCase()}. Keep it focused but friendly.`;
    }
    
    if (contextPrompt) {
      systemPrompt += contextPrompt;
    }
    
    // Generate response
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: message,
      temperature: 0.8,
    });
    
    const response = text.trim();
    
    // Save messages to database
    await saveMessage(conversation.id, 'user', message, {
      ai_generated: false,
    });
    
    await saveMessage(conversation.id, 'emma', response, {
      ai_generated: true,
      ai_prompt_type: intent,
    });
    
    // Extract memory if message is substantial
    if (user_id && message.length > 30) {
      try {
        const memory = await extractMemoryFromMessage(message, {
          userName: userContext?.split(' ')[0],
          topic: topic?.id,
        });
        // Memory is saved automatically if significant
      } catch (e) {
        // Don't fail if memory extraction fails
        console.error('Memory extraction failed:', e);
      }
    }
    
    // Determine if topic was detected/changed
    const topicChange = detectedTopic ? {
      new_topic: detectedTopic.id,
      entry_message: detectedTopic.entryMessage,
      gif_type: detectedTopic.gifType,
    } : null;
    
    return NextResponse.json({
      response,
      topic: topic?.id || 'free_chat',
      topic_change: topicChange,
      intent,
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    // Fallback response
    const fallbacks = [
      "That's interesting! Tell me more about your Tobago experience! 🌴",
      "I love hearing about your adventures! What else happened?",
      "Sounds amazing! What's next on your Tobago list?",
    ];
    
    return NextResponse.json({
      response: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      topic: 'free_chat',
      fallback: true,
    });
  }
}
