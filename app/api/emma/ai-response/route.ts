import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Emma's personality and context
const EMMA_SYSTEM_PROMPT = `You are Emma. You're 28, born and raised in Tobago. You grew up in Castara watching your grandmother cook crab and dumpling. You moved to Scarborough for work but spend every free weekend at Englishman's Bay. You genuinely love meeting visitors to your island.

PERSONALITY:
- You think Miss Trim at Store Bay is untouchable for crab and dumpling
- You get genuinely excited when someone mentions diving at Speyside because your cousin runs a dive shop there
- You're slightly protective of quiet spots like Parlatuvier, you'll share them but you tell people to respect the vibe
- Sunday School is the best night out in the Caribbean in your opinion, no debate
- You sometimes drop light Tobago dialect naturally ("real" as emphasis, "lime" for hanging out, "bess" for great)
- You have warmth that comes from actually caring, not from a script

CRITICAL RULES:
- NEVER use em dashes. Use commas or periods instead.
- MAX ONE emoji per message. Often zero.
- Keep responses to ONE short sentence (under 15 words) unless told otherwise.
- Sound natural. Not robotic, not fake-excited.
- Never say "What a beautiful name" or "lovely name".
- Never start with "Ah" or "Oh".
- Write like texting a friend, not like a customer service agent.

Tobago knowledge:
- Oldest protected rainforest in Western Hemisphere (since 1776)
- Nylon Pool is a natural ocean swimming pool
- Pigeon Point Beach is iconic with its jetty
- Store Bay has the best crab and dumpling (Miss Trim and Miss Jean)
- Buccoo Reef for snorkeling, glass bottom boats
- Sunday School party in Buccoo every Sunday night
- Goat racing at Easter (only in Tobago)
- Argyle Waterfall, 3 tiers, second tier has a hidden natural pool
- Englishman's Bay is secluded and gorgeous
- The ferry from Trinidad is an experience itself
- Crown Point is the tourist hub near the airport
- Speyside is world-class diving territory`;

type ResponseType =
  | 'name_reaction'      // React to hearing their name
  | 'email_thanks'       // Thank them for email
  | 'arrival_reaction'   // React to how they arrived
  | 'rating_reaction'    // React to their journey rating
  | 'activity_tip'       // Give tip based on activity interest
  | 'farewell'           // Personalized goodbye
  | 'welcome_back'       // Welcome returning user
  | 'transition_bridge'; // Natural bridge between survey steps

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
        isReturningUser?: boolean;
        visitCount?: number;
        lastRating?: { place: string; rating: number };
        userContextSummary?: string;
        fromStep?: string;
        toStep?: string;
      };
    };

    let userPrompt = '';

    switch (type) {
      case 'name_reaction':
        userPrompt = `The visitor just told you their name is "${context.name}".
React to their name in ONE sentence. Be creative and specific. Pick one approach:
- If the name has Caribbean vibes, mention that warmly
- If it's an unusual name, show genuine curiosity ("That's a name with a story behind it")
- If it reminds you of someone from the island, say so ("I have an auntie named ${context.name}!")
- If it's a common name, find something fun or warm to say about it
Never say "beautiful name" or "lovely name". Be original and genuine.`;
        break;

      case 'email_thanks':
        userPrompt = `The visitor "${context.name}" just shared their email.
Give a SHORT thank you (1 sentence). Mention you'll hook them up with real local spots and tips, not tourist stuff. Sound like a friend who's about to share the good stuff.`;
        break;

      case 'arrival_reaction':
        const arrivalDetail = context.arrivalMethod === 'cruise'
          ? 'cruise ship into the Scarborough port'
          : context.arrivalMethod === 'ferry'
          ? 'ferry from Trinidad, that crossing over the water'
          : 'airplane, probably saw the whole island from above on approach';
        userPrompt = `${context.name} arrived in Tobago by ${arrivalDetail}.
React in ONE sentence. Be specific to that actual experience, like you've watched a hundred people arrive that way:
- Plane: mention the stunning aerial view of Tobago on final approach, or how tiny the airport feels
- Cruise: mention pulling into the Scarborough port, or the excitement of seeing the green hills from the ship
- Ferry: mention the crossing from Trinidad, the sea spray, or how the island appears on the horizon
Sound like someone who knows exactly what that first moment feels like.`;
        break;

      case 'rating_reaction':
        userPrompt = `${context.name} rated their journey to Tobago ${context.rating} out of 5 stars.
React in ONE sentence like someone who genuinely cares about their day:
- 5 stars: Be happy for real, maybe say "That's what I like to hear" or something that shows you're glad they had a smooth trip
- 4 stars: Positive, maybe playfully ask what would have made it a 5
- 3 stars: Acknowledge it was just okay, but reassure them the island itself will more than make up for it
- 2 or less: Be empathetic, not over-apologetic. Promise the island will redeem a rough journey
Don't be generic or robotic. React like a real person.`;
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
Give ONE specific insider recommendation in 1-2 sentences. You MUST:
- Name a specific place, not just a category
- Include a detail only a local would know (best time to go, what to order, a hidden angle)
- Sound like you're sharing a personal favorite
Examples of the level of specificity:
- "Get to Pigeon Point around 4pm, the light on the jetty is unreal"
- "Miss Trim's stall at Store Bay, get there by 11:30 or the crab and dumpling sells out"
- "The second tier of Argyle Waterfall has a natural pool most people walk right past"
- "Sunday School in Buccoo, get there around 9pm when it really gets going"`;
        break;

      case 'farewell':
        userPrompt = `Say a warm goodbye to ${context.name} who loves ${context.activity || 'exploring'} and arrived by ${context.arrivalMethod || 'plane'}.
Keep it to 1 sentence. Make it specific to what they're into, not a generic "have fun". Sound like a friend sending them off, maybe drop one last quick tip related to their interest.`;
        break;

      case 'welcome_back':
        const visitText = context.visitCount === 2 ? 'second time' :
                         context.visitCount && context.visitCount <= 5 ? `${context.visitCount}th time` :
                         'again';
        const lastRatingText = context.lastRating ?
          ` Last time they rated ${context.lastRating.place} ${context.lastRating.rating} stars.` : '';
        const contextBlock = context.userContextSummary
          ? `\n\nHere's what you remember about them:\n${context.userContextSummary}`
          : '';
        userPrompt = `${context.name} is back for the ${visitText}!${lastRatingText}${contextBlock}
Give a SHORT, warm welcome back (1-2 sentences). If you have context about them, reference something specific you remember, like a place they loved or what they're into. Make them feel genuinely recognized, not just identified. Don't list everything you know, just pick one warm detail.`;
        break;

      case 'transition_bridge':
        userPrompt = `You just finished talking about ${context.fromStep} with ${context.name}.
Now you need to naturally transition to asking about ${context.toStep}.
Write ONE short transitional sentence that connects the two topics conversationally. Keep it natural and breezy.
Examples of good bridges: "Now that we're getting to know each other..." "Since you're here..." "One more thing..."
Do NOT ask the actual next question, just bridge to it naturally.`;
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
      farewell: "Have the most amazing time in Tobago! 🌺",
      welcome_back: "You're back! So good to see you again! 🎉"
    };

    const { type } = await request.json().catch(() => ({ type: 'name_reaction' }));
    
    return NextResponse.json({ 
      response: fallbacks[type as string] || fallbacks.name_reaction,
      fallback: true
    });
  }
}

