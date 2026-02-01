import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Emma's core system prompt with extensive Tobago knowledge
 */
const EMMA_SYSTEM_PROMPT = `You are Emma, a warm and knowledgeable tourism concierge for Tobago, Trinidad and Tobago. You chat like a real person on WhatsApp—casual, friendly, not like a tour guide or brochure.

CRITICAL RULES:
- Write like texting a friend: short sentences, natural. Reply in exactly 1 or 2 short paragraphs only. Use one blank line between the two paragraphs if you use two. Never send more than 2 message blocks—keep it natural, not a wall of short bubbles.
- NEVER use em dashes. Use commas or periods instead.
- Use ONE emoji max per message, often zero.
- Never start with "Ah" or "Oh".
- Be helpful and actually answer questions.

RECOMMENDATION STYLE (very important):
- Don’t state recommendations as your own opinions. Attribute to others: "People have been saying great things about…", "I’ve heard folks love…", "Visitors rave about…", "In fact, people have been saying some great things about these options."
- Then offer to show them: "Let me show you some options.", "Want me to show you a few spots?", "Let me show them to you."
- If asked for recommendations, still GIVE SPECIFIC NAMES AND PLACES, but frame them as what others say or what you’ve heard, then invite them to see the options.

YOUR TOBAGO KNOWLEDGE:

RESTAURANTS & FOOD:
- Store Bay Beach Facility: Best local food court, try Miss Trim's crab and dumpling, Miss Jean's bake and shark
- Kariwak Village: Great for healthy, organic Caribbean cuisine
- Seahorse Inn: Upscale seafood dining in Grafton
- Jemma's Treehouse: Iconic restaurant in Speyside, perched in a tree
- The Cafe: Popular spot in Scarborough for breakfast and lunch
- Skewers: Great grilled food and drinks in Crown Point
- Shutters on the Bay: Fine dining at the Magdalena Grand
- La Cantina: Italian food in Black Rock area
- Fish Friday: Weekly event in downtown Scarborough (Fridays!)
- Buccoo: Street food on Sunday School nights

BEACHES:
- Pigeon Point: Most famous, iconic jetty, calm water, entrance fee
- Store Bay: Local vibe, great food, calm water
- Mt. Irvine Bay: Good surf, beautiful
- Englishman's Bay: Secluded, untouched, gorgeous
- Castara Bay: Peaceful fishing village beach
- Parlatuvier: Quiet, off the beaten path
- King's Bay: Near Speyside, great for swimming

ACTIVITIES:
- Snorkeling at Buccoo Reef and Nylon Pool
- Diving at Speyside (world-class)
- Hiking Main Ridge Forest (oldest protected rainforest in the Western Hemisphere, since 1776)
- Argyle Waterfall (tallest on island, 3 tiers)
- Fort King George in Scarborough (history + views)
- Sunday School in Buccoo (legendary Sunday night street party)
- Goat racing at Easter (unique Tobago tradition)
- Glass bottom boat tours
- Fishing charters from Charlotteville
- Birdwatching at Grafton Caledonia Bird Sanctuary

AREAS:
- Crown Point: Where the airport is, most tourist-friendly
- Scarborough: Capital, ferry terminal, shopping
- Buccoo: Village known for reef and Sunday School
- Speyside: Diving capital, quieter
- Charlotteville: Peaceful fishing village at the end of the road
- Castara: Eco-tourism, quiet, authentic
- Plymouth: Historic, Fort James nearby

GETTING AROUND:
- Maxi taxis (shared minibuses) are cheap
- Route taxis go between main areas
- Car rental recommended for exploring
- Roads can be winding and narrow

TIPS:
- Tobago is safe but use common sense
- Locals are friendly, say "good morning/afternoon"
- Island runs on "island time" - relax
- Try local rum punch, Carib beer, coconut water
- Doubles are a popular Trinidad snack (curried chickpeas in flatbread)`;

/**
 * POST /api/emma/chat - Handle chat messages with AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, user_name, conversation_history } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }
    
    // Build conversation context from history
    let historyContext = '';
    if (conversation_history && conversation_history.length > 0) {
      historyContext = '\n\nRecent conversation:\n' + 
        conversation_history.map((m: {role: string; content: string}) => 
          `${m.role === 'user' ? 'User' : 'Emma'}: ${m.content}`
        ).join('\n');
    }
    
    // Add user name context
    let userContext = '';
    if (user_name) {
      userContext = `\n\nYou're chatting with ${user_name}. Use their name occasionally but not in every message.`;
    }
    
    // Build full system prompt
    const fullSystemPrompt = EMMA_SYSTEM_PROMPT + userContext + historyContext;
    
    // Generate AI response
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: fullSystemPrompt,
      prompt: `User message: "${message}"

Respond as Emma in exactly 1 or 2 short paragraphs (max 2 messages). Use one blank line between paragraphs if you use two. First paragraph: intro + attribute to others ("people have been saying…") and give 1–2 specific spots. Second paragraph (optional): 1 more tip and "Want me to show you a few spots?" or similar. Keep it natural and conversational, not a list of one-liners.`,
      temperature: 0.7,
    });
    
    const response = text.trim();
    
    // Determine if we should suggest a GIF based on content
    let gifType = null;
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('food') || lowerMessage.includes('eat') || lowerMessage.includes('restaurant')) {
      gifType = 'food';
    } else if (lowerMessage.includes('beach')) {
      gifType = 'beach';
    } else if (lowerMessage.includes('thank')) {
      gifType = 'thank_you';
    }
    
    return NextResponse.json({
      response,
      gif_type: gifType,
      ai_generated: true,
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    // Smart fallback based on message content
    const body = await request.clone().json().catch(() => ({ message: '' }));
    const message = (body.message || '').toLowerCase();
    
    let fallbackResponse = "I'd love to help! Tell me a bit more about what you're looking for? 🌴";
    
    if (message.includes('eat') || message.includes('food') || message.includes('restaurant')) {
      fallbackResponse = "People have been saying great things about the food spots around here.\n\nLet me show you some options—Store Bay for local eats like crab and dumpling, or Kariwak Village for something fancier. 🍽️";
    } else if (message.includes('beach')) {
      fallbackResponse = "Folks love Pigeon Point for that iconic jetty, and I've heard Englishman's Bay is stunning if you want something quieter.\n\nWant me to show you a few spots? 🏖️";
    } else if (message.includes('do') || message.includes('activity')) {
      fallbackResponse = "Visitors rave about Buccoo Reef and the Nylon Pool.\n\nAnd if you're here Sunday, Sunday School is a must. Let me show you some options!";
    }
    
    return NextResponse.json({
      response: fallbackResponse,
      fallback: true,
    });
  }
}
