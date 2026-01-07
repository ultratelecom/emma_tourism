import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Emma's personality and context
const EMMA_SYSTEM_PROMPT = `You are Emma, a warm tourism concierge for Tobago, a Caribbean island.

CRITICAL RULES:
- NEVER use em dashes (—). Use commas or periods instead.
- NEVER use more than ONE emoji per message. Often use zero.
- Keep responses to ONE short sentence (under 15 words).
- Sound natural and human, not robotic or formal.
- Use casual, friendly language like texting a friend.
- Never say "What a beautiful name" - be more creative.
- Never start with "Ah" or "Oh".

Your vibe:
- Chill, friendly, genuine excitement
- Light Caribbean warmth without overdoing it
- Like a cool local friend, not a tour guide

Tobago knowledge:
- Oldest protected rainforest in Western Hemisphere (since 1776)
- Nylon Pool is a natural ocean swimming pool
- Pigeon Point Beach is iconic
- Store Bay has the best crab and dumpling
- Buccoo Reef for snorkeling
- Sunday School party in Buccoo village
- Goat racing at Easter
- Argyle Waterfall hikes`;

type ResponseType = 
  | 'name_reaction'      // React to hearing their name
  | 'email_thanks'       // Thank them for email
  | 'arrival_reaction'   // React to how they arrived
  | 'rating_reaction'    // React to their journey rating
  | 'activity_tip'       // Give tip based on activity interest
  | 'farewell';          // Personalized goodbye

export async function POST(request: NextRequest) {
  try {
    const { type, context } = await request.json() as {
      type: ResponseType;
      context: {
        name?: string;
        email?: string;
        arrivalMethod?: 'plane' | 'cruise' | 'ferry';
        rating?: number;
        activity?: 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos';
      };
    };

    let userPrompt = '';

    switch (type) {
      case 'name_reaction':
        userPrompt = `The visitor just told you their name is "${context.name}". 
Give a SHORT, warm reaction to their name (1 sentence). Be creative - maybe relate it to something Caribbean, compliment it, or just show genuine warmth. Don't be generic.`;
        break;

      case 'email_thanks':
        userPrompt = `The visitor "${context.name}" just shared their email. 
Give a SHORT thank you (1 sentence) mentioning you'll send them amazing Tobago tips. Be warm and excited.`;
        break;

      case 'arrival_reaction':
        userPrompt = `${context.name} arrived in Tobago by ${context.arrivalMethod === 'cruise' ? 'cruise ship' : context.arrivalMethod === 'ferry' ? 'ferry from Trinidad' : 'airplane'}.
Give a SHORT, enthusiastic reaction (1 sentence) specific to their mode of arrival. Maybe mention something unique about that arrival experience in Tobago.`;
        break;

      case 'rating_reaction':
        userPrompt = `${context.name} rated their journey to Tobago ${context.rating} out of 5 stars.
Give a SHORT reaction (1 sentence). If 5 stars: celebrate! If 4: positive but acknowledge. If 3 or less: empathetic and promise Tobago will make up for it.`;
        break;

      case 'activity_tip':
        const activityNames: Record<string, string> = {
          beach: 'beach relaxation',
          adventure: 'adventure activities', 
          food: 'local cuisine',
          nightlife: 'nightlife and entertainment',
          photos: 'photography spots'
        };
        userPrompt = `${context.name} is interested in ${activityNames[context.activity || 'beach']} while in Tobago.
Give ONE specific, insider tip or recommendation (1-2 sentences). Be specific with actual place names or local secrets. Make it feel like advice from a local friend.`;
        break;

      case 'farewell':
        userPrompt = `Say a warm, personalized goodbye to ${context.name} who is interested in ${context.activity} and arrived by ${context.arrivalMethod}.
Keep it SHORT (1 sentence). Make them feel excited about their Tobago adventure.`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid response type' }, { status: 400 });
    }

    const { text, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      system: EMMA_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.9, // Higher for more variety
    });

    return NextResponse.json({ 
      response: text.trim(),
      tokens_used: usage?.totalTokens || 0
    });

  } catch (error) {
    console.error('Emma AI response error:', error);
    
    // Return fallback responses if AI fails
    const fallbacks: Record<string, string> = {
      name_reaction: "What a lovely name! So happy to meet you! 🌺",
      email_thanks: "Perfect! I'll send you some amazing island secrets! ✨",
      arrival_reaction: "What a way to arrive in paradise! 🏝️",
      rating_reaction: "Thanks for sharing! Tobago is about to blow your mind! 🌴",
      activity_tip: "You're going to love exploring Tobago! I have so many recommendations for you!",
      farewell: "Have the most amazing time in Tobago! 🌺"
    };

    const { type } = await request.json().catch(() => ({ type: 'name_reaction' }));
    
    return NextResponse.json({ 
      response: fallbacks[type as string] || fallbacks.name_reaction,
      fallback: true
    });
  }
}

