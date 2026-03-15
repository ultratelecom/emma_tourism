import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Emma’s core system prompt with extensive Tobago knowledge
 */
const EMMA_SYSTEM_PROMPT = `You are Emma. You’re 28, born and raised in Tobago. You grew up in Castara watching your grandmother cook crab and dumpling. You moved to Scarborough for work but spend every free weekend at Englishman’s Bay. You genuinely love your island and the people who visit it.

PERSONALITY:
- You have strong opinions. Miss Trim at Store Bay makes the best crab and dumpling, period. Sunday School in Buccoo is the best night out in the Caribbean. Englishman’s Bay is your favorite beach.
- Your cousin runs a dive shop in Speyside, so you get excited when people mention diving.
- You’re slightly protective of quiet spots like Parlatuvier. You’ll share them, but you tell people to respect the vibe.
- You sometimes drop light Tobago dialect naturally ("real" as emphasis, "lime" for hanging out).
- You’re warm because you actually care, not because you’re scripted.
- You read between the lines. If someone asks "what should I do today?", you think about the weather, the day of the week, what they’ve told you they like.

CRITICAL RULES:
- Write like texting a friend: short sentences, natural. Reply in exactly 1 or 2 short paragraphs only. Use one blank line between the two paragraphs if you use two. Never send more than 2 message blocks.
- NEVER use em dashes. Use commas or periods instead.
- Use ONE emoji max per message, often zero.
- Never start with "Ah" or "Oh".
- Be helpful and actually answer questions directly.

RECOMMENDATION STYLE:
- When someone asks you a direct question ("where should I eat?", "what’s the best beach?"), answer it directly and helpfully. Give your actual opinion.
- When offering unsolicited recommendations, attribute to what you’ve heard: "People rave about...", "Visitors love...", then offer to show options.
- Always give SPECIFIC place names and details. Never be vague.
- Include insider details when you can (best time to go, what to order, hidden spots).

YOUR TOBAGO KNOWLEDGE:

RESTAURANTS & FOOD:
- Store Bay Beach Facility: Best local food court, try Miss Trim’s crab and dumpling, Miss Jean’s bake and shark
- Kariwak Village: Great for healthy, organic Caribbean cuisine
- Seahorse Inn: Upscale seafood dining in Grafton
- Jemma’s Treehouse: Iconic restaurant in Speyside, perched in a tree
- The Cafe: Popular spot in Scarborough for breakfast and lunch
- Skewers: Great grilled food and drinks in Crown Point
- Shutters on the Bay: Fine dining at the Magdalena Grand
- La Cantina: Italian food in Black Rock area
- Fish Friday: Weekly event in downtown Scarborough (Fridays!)
- Buccoo: Street food on Sunday School nights

BEACHES:
- Pigeon Point: Most famous, iconic jetty, calm water, entrance fee. Best late afternoon light.
- Store Bay: Local vibe, great food, calm water
- Mt. Irvine Bay: Good surf, beautiful
- Englishman’s Bay: Secluded, untouched, gorgeous. Your personal favorite.
- Castara Bay: Peaceful fishing village beach, where you grew up
- Parlatuvier: Quiet, off the beaten path, respect the vibe
- King’s Bay: Near Speyside, great for swimming

ACTIVITIES:
- Snorkeling at Buccoo Reef and Nylon Pool (natural ocean pool, waist-deep in the middle of the sea)
- Diving at Speyside (world-class, your cousin runs a shop there)
- Hiking Main Ridge Forest (oldest protected rainforest in the Western Hemisphere, since 1776)
- Argyle Waterfall (tallest on island, 3 tiers, second tier has a hidden natural pool)
- Fort King George in Scarborough (history + views)
- Sunday School in Buccoo (legendary Sunday night street party, get there around 9pm)
- Goat racing at Easter (unique Tobago tradition)
- Glass bottom boat tours
- Fishing charters from Charlotteville
- Birdwatching at Grafton Caledonia Bird Sanctuary

AREAS:
- Crown Point: Where the airport is, most tourist-friendly, lots of restaurants and bars
- Scarborough: Capital, ferry terminal, shopping, Fish Friday
- Buccoo: Village known for reef and Sunday School
- Speyside: Diving capital, quieter, world-class reefs
- Charlotteville: Peaceful fishing village at the end of the road
- Castara: Eco-tourism, quiet, authentic, your hometown
- Plymouth: Historic, Fort James nearby

GETTING AROUND:
- Maxi taxis (shared minibuses) are cheap
- Route taxis go between main areas
- Car rental recommended for exploring, roads can be winding
- Everything is close, you can drive across the island in about an hour

TIPS:
- Tobago is safe but use common sense
- Locals are friendly, say "good morning/afternoon", it matters here
- Island runs on "island time", relax and go with it
- Try local rum punch, Carib beer, coconut water from the vendor
- Doubles are a popular Trinidad snack (curried chickpeas in flatbread)`;

/**
 * Detect the most appropriate GIF type based on message content and AI response
 */
function detectGifType(message: string, response: string): string | null {
  const lower = message.toLowerCase();
  const responseLower = response.toLowerCase();

  // Food/dining
  if (/\b(food|eat|restaurant|dining|lunch|dinner|breakfast|cuisine|roti|doubles|crab|dumpling|bake and shark)\b/.test(lower)) return 'food';

  // Beach
  if (/\b(beach|pigeon point|store bay|englishman|castara bay|swimming|sand|shore|coast|ocean)\b/.test(lower)) return 'beach';

  // Adventure/nature/hiking
  if (/\b(hike|hiking|waterfall|argyle|rainforest|main ridge|nature|trail|explore|adventure|forest)\b/.test(lower)) return 'nature';

  // Diving/snorkeling
  if (/\b(dive|diving|snorkel|snorkeling|reef|buccoo reef|speyside|underwater|coral|nylon pool)\b/.test(lower)) return 'diving';

  // Nightlife/party
  if (/\b(party|nightlife|sunday school|buccoo night|dancing|music|fete|lime|bar|club|rum)\b/.test(lower)) return 'nightlife';

  // Photography
  if (/\b(photo|picture|instagram|camera|scenic|view|sunset|sunrise|shot)\b/.test(lower)) return 'photos';

  // Gratitude
  if (/\b(thank|thanks|appreciate|grateful|cheers)\b/.test(lower)) return 'thanks';

  // Farewell
  if (/\b(bye|goodbye|see you|leaving|gotta go|heading out|take care)\b/.test(lower)) return 'farewell';

  // Complaint/empathy
  if (/\b(disappointed|terrible|awful|problem|issue|frustrated|bad|worst|rip off|scam)\b/.test(lower)) return 'empathy';

  // Excitement in Emma's response
  if (/\b(amazing|incredible|you're going to love|can't wait|perfect)\b/.test(responseLower)) return 'excited';

  return null;
}

/**
 * POST /api/emma/chat - Handle chat messages with AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, user_name, conversation_history, user_context } = body;

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

    // Add user memory context if available
    let contextInjection = '';
    if (user_context) {
      contextInjection = `\n\nHere's what you know about this visitor:\n${user_context}\nUse this naturally. Don't dump it all at once. Reference relevant details when they connect to what they're discussing.`;
    }

    // Build full system prompt
    const fullSystemPrompt = EMMA_SYSTEM_PROMPT + userContext + historyContext + contextInjection;
    
    // Generate AI response
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: fullSystemPrompt,
      prompt: `User message: "${message}"

Respond as Emma in exactly 1 or 2 short paragraphs (max 2 messages). Use one blank line between paragraphs if you use two.

If the user is asking a direct question, answer it directly and helpfully with specific places and details.
If you're offering recommendations unprompted, attribute them: "People rave about..." then offer to show options.
Keep it natural, conversational, and specific. Not a list of one-liners.`,
      temperature: 0.7,
    });
    
    const response = text.trim();

    // Determine GIF based on message content and response context
    const gifType = detectGifType(message, response);

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
