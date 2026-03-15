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
  | 'welcome_intro'      // First greeting for new users
  | 'ask_email'          // Ask for email naturally
  | 'ask_arrival'        // Ask how they got to Tobago
  | 'ask_rating'         // Ask about their journey
  | 'ask_activities'     // Ask what they're into
  | 'menu_response';     // Respond to a returning user's menu choice

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
        menuChoice?: 'rate' | 'recommend' | 'chat' | 'help';
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

      case 'welcome_intro':
        userPrompt = `You're greeting a brand new visitor to Tobago for the first time. Introduce yourself as Emma and ask their name.
Write exactly 2 short sentences:
- First sentence: a casual, warm hello. Not "Hey there!" every time. Vary it. Could be "Welcome to the island!", "So glad you made it!", or something that sets the Tobago mood.
- Second sentence: introduce yourself briefly and ask their name. Don't say "Tobago welcome buddy" or anything that sounds like a job title. Sound like a local who's genuinely curious.
Keep it natural. No emojis.`;
        break;

      case 'ask_email':
        userPrompt = `You just met ${context.name}. Now you want to get their email so you can send them local tips and spots.
Write ONE casual sentence asking for their email. Don't say "drop your email" every time. Vary it naturally:
- Maybe mention you want to send them your personal list of spots
- Or say you'll hook them up with some places the guidebooks miss
- Or tell them you have some tips their hotel won't tell them about
Sound like a friend offering to share the inside scoop, not a form asking for data. No emojis.`;
        break;

      case 'ask_arrival':
        userPrompt = `You're chatting with ${context.name} and want to know how they got to Tobago.
Write ONE casual sentence asking about their arrival. Don't say "How did you get to Tobago?" in a bland way. Make it conversational:
- Maybe reference the airport being tiny and charming
- Or ask if they took the ferry across (the crossing is something)
- Or wonder if they sailed in
Make it sound like genuine curiosity, not a survey question. No emojis.`;
        break;

      case 'ask_rating':
        userPrompt = `${context.name} just told you they arrived by ${context.arrivalMethod || 'plane'}. Now you want to know how their journey went.
Write ONE sentence asking about the trip quality. Connect it to HOW they arrived:
- If plane: maybe ask about the flight, the view on approach, or if it was smooth
- If ferry: ask about the crossing, the sea, or if they enjoyed it
- If cruise: ask about the sail in, the port arrival
Don't say "How was your journey here?" generically. Make it specific to their actual travel. No emojis.`;
        break;

      case 'ask_activities':
        userPrompt = `${context.name} rated their journey ${context.rating}/5 stars. Now you want to find out what kind of things they're excited to do in Tobago.
Write ONE sentence asking what appeals to them. Connect it to the energy of the conversation:
- If they rated 5: they're in a great mood, match that energy
- If they rated 3 or less: acknowledge the journey wasn't ideal and pivot to "but the island will make up for it, what are you most looking forward to?"
Don't say "What excites you most about Tobago?" robotically. Make it feel like a natural follow-up. No emojis.`;
        break;

      case 'menu_response':
        const menuDescriptions: Record<string, string> = {
          rate: 'rate a place they visited',
          recommend: 'get recommendations for things to do',
          chat: 'just chat and hang out',
          help: 'get help with something',
        };
        const menuAction = menuDescriptions[context.menuChoice || 'chat'] || 'chat';
        const returnContext = context.userContextSummary
          ? `\n\nWhat you know about them:\n${context.userContextSummary}`
          : '';
        userPrompt = `${context.name} is a returning visitor (visit #${context.visitCount || 2}) and they want to ${menuAction}.${returnContext}
Write 2 short sentences to kick off this conversation:
- First: acknowledge what they want to do. If you have context about them, reference it naturally (e.g., if they're rating, "Back to share another review?" or if they want recs and you know they're a foodie, lean into that)
- Second: an open-ended question to get them started
Sound like a friend they're reconnecting with, not a menu system. No emojis.`;
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
      name_reaction: "Nice to meet you!",
      email_thanks: "Got it, I'll send you the good stuff.",
      arrival_reaction: "Welcome to the island!",
      rating_reaction: "Thanks for sharing, the island will more than make up for it.",
      activity_tip: "You picked a good one, I have some real spots for you.",
      farewell: "Go enjoy yourself out there!",
      welcome_back: "You're back! Good to see you again.",
      welcome_intro: "Welcome to Tobago! I'm Emma, what's your name?",
      ask_email: "What's your email? I'll send you some local spots the guidebooks miss.",
      ask_arrival: "So how did you get here, fly in or take the ferry?",
      ask_rating: "How was the trip getting here?",
      ask_activities: "So what are you most looking forward to doing here?",
      menu_response: "Good to have you back! What's on your mind?",
    };

    const { type } = await request.json().catch(() => ({ type: 'name_reaction' }));
    
    return NextResponse.json({ 
      response: fallbacks[type as string] || fallbacks.name_reaction,
      fallback: true
    });
  }
}

