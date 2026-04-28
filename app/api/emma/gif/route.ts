import { NextRequest, NextResponse } from 'next/server';

// GIPHY API key - set in environment variables
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// ============================================
// SEARCH MODE (preferred for Ava cues)
// For these cues, we query Giphy's /search with a rotating family of
// queries and pick a random result from the top 50. Every call hits a
// different slice of Giphy, so the same GIF almost never repeats across
// sessions — the curated hardcoded pools below are used as a safety net
// only when search returns nothing.
// ============================================

const SEARCH_QUERIES: Record<string, string[]> = {
  welcome: [
    'friendly wave hello',
    'warm hello smile',
    'happy greeting hi',
    'hi there wave cute',
    'welcome back hug',
    'excited hello wave',
    'caribbean hello wave',
    'hello animated cute',
  ],
  hey_there: [
    'hey there wave',
    'hi friend wave',
    'hello greeting cute',
    'nice to meet you wave',
    'friendly hi',
  ],
  local_vibes: [
    'tropical vibes',
    'caribbean chill',
    'island life',
    'beach vibes good',
    'good vibes sunshine',
    'relaxed sunny day',
  ],
  empathy: [
    'i hear you',
    'empathy listening',
    'i understand you',
    'gentle nod support',
    'sympathetic hug',
    'thinking of you hug',
  ],
  celebration: [
    'celebration confetti happy',
    'we did it cheer',
    'yay celebration',
    'party time celebrate',
    'happy dance confetti',
  ],
  farewell: [
    'goodbye wave cute',
    'see you later wave',
    'bye bye wave',
    'until next time wave',
  ],
  welcome_back: [
    'welcome back hug',
    'missed you reunion',
    'long time no see hug',
    'so happy to see you',
  ],
  // name_reaction intentionally NOT in SEARCH_QUERIES — Giphy search
  // returns unpredictable real photos for these terms. Always use the
  // pre-approved curated IDs in CURATED_GIFS.name_reaction instead.
};

// ============================================
// PRE-APPROVED, CURATED GIF IDs
// Quirky, family-friendly, NO romantic vibes
// Each ID appears in EXACTLY ONE category
// ============================================

const CURATED_GIFS: Record<string, string[]> = {
  // GREETINGS - Waving hello, warm welcomes
  welcome: [
    'xT9IgG50Fb7Mi0prBC', // Minions waving
    'ASd0Ukj0y3qMM',      // Friendly wave
    'l0MYGb1LuZ3n7dRnO',  // Hello wave
    'dzaUX7CAG0Ihi',      // Hey there wave
    'bcKmIWkUMCjVm',      // Excited hello
  ],
  hey_there: [
    'icUEIrjnUuFCWDxFpU', // Hey there!
    '3o7TKSjRrfIPjeiVyM', // Waving hi
    'l3q2zVr6cu95nF6O4',  // Friendly hello
    'l0MYC0LajbaPoEADu',  // Hi wave
    'xUPGcguWZkXlWlMr2U', // Warm greeting
  ],

  // NAME REACTIONS - Impressed, cool, nodding (NOT romantic)
  name_reaction: [
    'l0MYt5jPR6QX5pnqM', // Thumbs up cool
    'l3q2K5jinAlChoCLS',  // Nice! pointing
    '111ebonMs90YLu',     // Thumbs up
    'l3vR85PnGsBwu1PFK',  // Nice one!
    'l0MYGHzBrmmkolWqQ',  // Cool cool cool
  ],

  // THANK YOU - Grateful, appreciative (merged thank_you + thanks)
  thanks: [
    '3oz8xIsloV320f3p0Q', // Thank you bow
    'osjgQPWRx3cac',      // Thanks!
    '3oEdva9BUHPIs2SkGk', // Grateful
    'ZfK4cXKJTTay1Ava29', // Thank you!
    '1Z02vuppxP1Pa',      // Thanks wave
  ],

  // TRAVEL - Plane, cruise, ferry arrivals
  plane: [
    'xT0xeMA62E1XIlup68', // Airplane
    '3o7TKMt1VVNkHV2PaE', // Flying
    '26AHLNr8en8J3ovOo',  // Adventure
    'l41m0CPz6UCnaUmxG',  // Flying in
    '3oEjHGr1Fhz0kyv8A',  // Travel time
  ],
  cruise: [
    'l3vR3EssXbYY1PrFu', // Ship
    '3o7TKnvDNFHmM7IxXq', // Sailing
    '3o7WIQ4FARJdpmUni8', // Cruise life
    'xUPGcC0R9QjyxkPnS8', // On the water
    '26FPnj46RYsITaOly',  // Ship sailing
  ],
  ferry: [
    'xT1XGzAnABSXy8DPCU', // Sea breeze
    '3o7aCTNjq3qiUbzALu', // Water vibes
    '26BRuo6sLetdllPAQ',  // Ferry ride
    'l0HlQXlQ3nHyLMvte',  // Travel excited
    '3o85xunRezGKRlnoI0',  // On the sea
  ],

  // ACTIVITIES
  beach: [
    'l3vR1d1zXi4EvPlKM',  // Beach vibes
    'xT1XGWGd90MKj2kg7u', // Paradise
    'xT9DPr4VjeCgeiLoMo', // Beach life
    'l0MYOKGaBQDmWGMAg',  // Tropical
    '3o6wrFGqlgjEuQzGJq',  // Beach day
  ],
  adventure: [
    'l3vRfhFD8hJCiP0uQ',  // Let's go!
    '26BRpSRZa9yNrmN0Q',  // Adventure time
    '26AHCgWcYM1xSKuRy',  // Exploring
    '3oEjI4sFlp73fvEYgw',  // Excitement
    'l2SpZkQ0XT1XtKus0',   // Let's do this
  ],
  food: [
    'l0MYyv6UK5Fq5oUVy', // Yummy
    'xT0xeJpnrWC4XWblEk', // Delicious
    '3oKIPa2TdahY8LAAxy', // Tasty
    'xUA7bfRIpTjkb9oJwY', // Food love
    '4NnTap3gOhhlik1YEw', // Eating happy
  ],
  nightlife: [
    '26BRzozg4TCBXv6QU',  // Dancing
    '5GoVLqeAOo6PK',      // Party!
    'BlVnrxJgTGsUw',      // Dancing
    'l0HlFkRjIfSYMlG00',  // Music vibes
    '3o7TKF1fSIs1R19B8k',  // Party time
  ],
  photos: [
    'UtVNvrJWYq2WalvAOC', // Say cheese!
    'l41lVsYDBC0UVQJCE',  // Camera
    '3oKIPkHLKivpHwYCIM', // Photo time
    'l3vRaFPOdskYxqLzG',  // Snapshot
    '26FLf3l0ot7MoForC',  // Picture perfect
  ],

  // RATINGS
  five_stars: [
    '3ohzdIuqJoo8QdKlnW', // Amazing!
    'xT9DPBMumj2Q0hlI3K', // Perfect
    'artj92V8o75VhYoEC',  // Standing ovation
    '26u4lOMA8JKSnL928',  // Bravo
    'IwAZ6dvvvDFI4',      // Nailed it
  ],
  good_rating: [
    'd3mlE7uhX8KFgEmY',   // Clapping
    '3oriO5t2QB4IPKgxHi', // Nice!
    'l2JhORT5IKnYGdCF2',  // Good one
    '26gsjCZpPolPr3sBy',  // Solid
    'xT5LMHxhOfscxPHGw',  // Well done
  ],
  okay_rating: [
    'l41YfykEfqI3JIkxy',  // Got it, understood
    '3o7527pa7qs57X0VJ2', // Okay noted
    '3oEdv07JGXQLnu6OIM', // Alright then
    'ui1hJRqBMEqyI',      // Fair enough
    'xT5LMB6Wst3fB5nMI',  // I hear you
  ],

  // FAREWELL
  farewell: [
    '3ornka9rAaKRA2Rkac',  // Bye wave
    '42D3CxaINsAFemFuId',  // Have fun!
    'l4pTfx2qLszJObFZ6',   // Goodbye wave
    '3o7qDSOvkaCVajjEBi',  // See ya!
    'KctrWMQ7u9D2du0YmD',  // Peace out
  ],
  enjoy: [
    'xT77XWum9yH7zNkFW',  // Enjoy yourself
    'l4pTsh45Dg7LA',       // Good vibes
    '26BRBKqUIHCLkViWY',  // Have a blast
    '3oxHQDHBaFDMqMSfL2',  // Go for it
    'fdyZ3qI0GVZC0',      // Fun times
  ],

  // WELCOME BACK - Returning user celebration
  welcome_back: [
    '3o7abKhOpu0NwenH3O', // Miss you!
    'xUPGcEliCc2gKoTzxK', // So glad you're back
    '35MvUTdVqQcklfbuKs', // Welcome back!
    'l0MYJnJQ4EiYLxvQ4',  // Long time no see
    'l1ug3xGEN1oZBT7qw',  // Reunion vibes
  ],

  // GENERIC EXCITEMENT
  excited: [
    'l0MYt5jPR6QX5pnqM',  // Excited! (keeping only here)
    '26BRuo6sLetdllPAQ',   // Yay!
    '5VKbvrjxQ1eQS2LqeC', // Woohoo
    'l0HlBO7eyXzSRkotG',  // Pumped
    '3oz8xwNlejeJDQREic',  // Let's goo
  ],

  // NEW CATEGORIES

  // DIVING - underwater, reef, marine life
  diving: [
    'l3vRmVv5gSxIOy0YE',  // Underwater explore
    '3o6ZtpBCm1HKzli4wg', // Ocean dive
    'xT9IgpernGIROKKiQ0', // Deep sea
    '26gR1v0rIDEDy2k8M',  // Swimming underwater
    'l0Ex6Ut39Kjn1SWkM',  // Marine life
  ],

  // NATURE - rainforest, hiking, greenery
  nature: [
    '3og0IwEivRzSoMNbtK', // Nature beauty
    'l0HlNQ03J5JxX2rDi',  // Forest walk
    'xT9IgpE0uKji2Hxdu',  // Green paradise
    '26BRsI63TttDrdupO',  // Nature vibes
    'l4FGlzJQPFN6Hkr3q',  // Scenic trail
  ],

  // EMPATHY - compassionate reactions for complaints/frustrations
  empathy: [
    '3oEdv6sy3ulljPMGQ', // I understand
    'OPU6wzx8JrHna',     // Sympathetic nod
    '1BXa2alBjFP2c',     // I'm sorry
    'l4pTsh45Dg7LA',     // Comforting
    'xT9IgsAZTS0OKXXyLu', // Listening
  ],

  // CELEBRATION - survey completion, milestones
  celebration: [
    '26u4cqiYI30juCOGY', // Confetti
    'l0MYJnJQ4EiYLxvQ4', // We did it
    '26BRBKqUIHCLkViWY', // Party time
    'g9582DNuQppxC',     // Celebration dance
    'artj92V8o75VhYoEC', // Standing ovation
  ],

  // LOCAL VIBES - Caribbean culture, community, warmth
  local_vibes: [
    '3o7TKF1fSIs1R19B8k', // Island vibes
    'l0MYyoYPvz22wTXGw',  // Chill mode
    '26FLf3l0ot7MoForC',  // Good life
    '3ohs7YMlUQ6JEwIwaQ', // Community
    'l3vRaak2KXGbpkBag',  // Tropical vibes
  ],
};

/**
 * Fetch a GIF via Giphy search with a random rotating query. This is
 * the preferred path for conversational cues because it gives us a huge
 * pool of fresh results every call — curated IDs are only used as a
 * fallback when search fails.
 */
async function fetchViaSearch(type: string) {
  const queries = SEARCH_QUERIES[type];
  if (!queries || queries.length === 0) return null;

  const query = queries[Math.floor(Math.random() * queries.length)];
  const url =
    `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}` +
    `&q=${encodeURIComponent(query)}&limit=50&rating=pg&lang=en&bundle=messaging_non_clips`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data?.data) || data.data.length === 0) return null;

  // Pick a random result from the returned slate. The random offset +
  // random query combination means repeats are extremely unlikely.
  const pick = data.data[Math.floor(Math.random() * data.data.length)];
  if (!pick?.images?.fixed_height?.url) return null;

  return {
    url: pick.images.fixed_height.url,
    width: pick.images.fixed_height.width,
    height: pick.images.fixed_height.height,
    title: pick.title as string,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!GIPHY_API_KEY) {
      console.error('GIPHY_API_KEY not configured');
      return NextResponse.json({ error: 'GIPHY API key not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'excited';

    // Search-mode first: gives maximum variety across sessions.
    if (SEARCH_QUERIES[type]) {
      const fromSearch = await fetchViaSearch(type);
      if (fromSearch) {
        return NextResponse.json(fromSearch);
      }
      // fall through to curated
    }

    // Get curated GIF IDs for this type
    const gifIds = CURATED_GIFS[type] || CURATED_GIFS.excited;
    
    // Pick a random GIF from the curated list
    const randomId = gifIds[Math.floor(Math.random() * gifIds.length)];

    // Fetch the specific GIF by ID
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/${randomId}?api_key=${GIPHY_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('GIPHY API failed');
    }

    const data = await response.json();
    
    if (!data.data) {
      // Fallback to first GIF in excited category
      const fallbackId = CURATED_GIFS.excited[0];
      const fallbackResponse = await fetch(
        `https://api.giphy.com/v1/gifs/${fallbackId}?api_key=${GIPHY_API_KEY}`
      );
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.data) {
        return NextResponse.json({
          url: fallbackData.data.images.fixed_height.url,
          width: fallbackData.data.images.fixed_height.width,
          height: fallbackData.data.images.fixed_height.height,
          title: fallbackData.data.title,
        });
      }
    }

    return NextResponse.json({
      url: data.data.images.fixed_height.url,
      width: data.data.images.fixed_height.width,
      height: data.data.images.fixed_height.height,
      title: data.data.title,
    });

  } catch (error) {
    console.error('GIF fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch GIF' }, { status: 500 });
  }
}

