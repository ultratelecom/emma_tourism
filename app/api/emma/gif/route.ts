import { NextRequest, NextResponse } from 'next/server';

// GIPHY API key - set in environment variables
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// ============================================
// PRE-APPROVED, CURATED GIF IDs
// Quirky, family-friendly, NO romantic vibes
// ============================================

const CURATED_GIFS: Record<string, string[]> = {
  // GREETINGS - Waving hello, quirky characters
  welcome: [
    'xT9IgG50Fb7Mi0prBC', // Minions waving
    '3ornka9rAaKRA2Rkac', // Cute wave
    'ASd0Ukj0y3qMM',      // Friendly wave
    'l0MYGb1LuZ3n7dRnO',  // Hello wave
    'dzaUX7CAG0Ihi',      // Hey there wave
  ],
  hey_there: [
    'xT9IgG50Fb7Mi0prBC', // Minions waving
    'icUEIrjnUuFCWDxFpU', // Hey there!
    '3o7TKSjRrfIPjeiVyM', // Waving hi
    'l3q2zVr6cu95nF6O4',  // Friendly hello
    'l0MYC0LajbaPoEADu',  // Hi wave
  ],
  
  // NAME REACTIONS - Cool, impressed, thumbs up (NOT romantic)
  name_reaction: [
    'l0MYt5jPR6QX5pnqM', // Thumbs up cool
    '3ohzdIuqJoo8QdKlnW', // Impressed nodding
    'l3q2K5jinAlChoCLS', // Nice! pointing
    'xT9DPBMumj2Q0hlI3K', // You got it
    '111ebonMs90YLu',     // Thumbs up
  ],
  cool_name: [
    'l0MYt5jPR6QX5pnqM', // Thumbs up
    'd3mlE7uhX8KFgEmY',  // Clapping
    '3ohzdIuqJoo8QdKlnW', // Nodding impressed
    'l3vR85PnGsBwu1PFK', // Nice one!
    'l0MYGHzBrmmkolWqQ', // Cool cool cool
  ],
  
  // THANK YOU - Grateful, appreciative
  thank_you: [
    '3oz8xIsloV320f3p0Q', // Thank you bow
    'osjgQPWRx3cac',      // Thanks!
    '3oEdva9BUHPIs2SkGk', // Grateful
    'ZfK4cXKJTTay1Ava29', // Thank you!
    '1Z02vuppxP1Pa',      // Thanks wave
  ],
  thanks: [
    '3oz8xIsloV320f3p0Q', // Thank you bow
    'osjgQPWRx3cac',      // Thanks
    '3oEdva9BUHPIs2SkGk', // Appreciating
    '3oriO5t2QB4IPKgxHi', // Thank you!
    'xT9DPIlGnuHpr2yObu', // Thanks!
  ],
  
  // TRAVEL - Plane, cruise, ferry arrivals
  plane: [
    'xT0xeMA62E1XIlup68', // Airplane
    '3o7TKMt1VVNkHV2PaE', // Flying
    'l0HlQXlQ3nHyLMvte', // Travel excited
    '26AHLNr8en8J3ovOo', // Adventure
    'l41m0CPz6UCnaUmxG', // Flying in
  ],
  cruise: [
    'l3vR3EssXbYY1PrFu', // Ship
    '3o7TKnvDNFHmM7IxXq', // Sailing
    'xT1XGzAnABSXy8DPCU', // Ocean vibes
    '3o7WIQ4FARJdpmUni8', // Cruise life
    'xUPGcC0R9QjyxkPnS8', // On the water
  ],
  ferry: [
    'l3vR3EssXbYY1PrFu', // Boat
    'l0HlQXlQ3nHyLMvte', // Travel
    'xT1XGzAnABSXy8DPCU', // Sea breeze
    '3o7aCTNjq3qiUbzALu', // Water vibes
    '26BRuo6sLetdllPAQ', // Ferry ride
  ],
  
  // ACTIVITIES
  beach: [
    'l3vR1d1zXi4EvPlKM', // Beach vibes
    'xT1XGWGd90MKj2kg7u', // Paradise
    '3oEjI4sFlp73fvEYgw', // Relaxing
    'xT9DPr4VjeCgeiLoMo', // Beach life
    'l0MYOKGaBQDmWGMAg', // Tropical
  ],
  adventure: [
    'l3vRfhFD8hJCiP0uQ', // Let's go!
    '26BRpSRZa9yNrmN0Q', // Adventure time
    'l0HlQXlQ3nHyLMvte', // Excited
    '26AHCgWcYM1xSKuRy', // Exploring
    '3o7TKMt1VVNkHV2PaE', // Ready
  ],
  food: [
    'l0MYyv6UK5Fq5oUVy', // Yummy
    'xT0xeJpnrWC4XWblEk', // Delicious
    '3oKIPa2TdahY8LAAxy', // Tasty
    'xUA7bfRIpTjkb9oJwY', // Food love
    '4NnTap3gOhhlik1YEw', // Eating happy
  ],
  nightlife: [
    'l0MYt5jPR6QX5pnqM', // Party time
    '26BRzozg4TCBXv6QU', // Dancing
    'l3vR85PnGsBwu1PFK', // Music vibes
    '5GoVLqeAOo6PK',      // Party!
    'BlVnrxJgTGsUw',      // Dancing
  ],
  photos: [
    'UtVNvrJWYq2WalvAOC', // Say cheese!
    'l41lVsYDBC0UVQJCE',  // Camera
    '3oKIPkHLKivpHwYCIM', // Photo time
    'l3vRaFPOdskYxqLzG',  // Snapshot
    '3o7TKSjRrfIPjeiVyM', // Picture time
  ],
  
  // RATINGS
  five_stars: [
    'd3mlE7uhX8KFgEmY',  // Clapping
    '3ohzdIuqJoo8QdKlnW', // Amazing!
    'l0MYt5jPR6QX5pnqM', // Perfect
    '26AHCgWcYM1xSKuRy', // Wow!
    '3oEjI4sFlp73fvEYgw', // Excellent
  ],
  good_rating: [
    '111ebonMs90YLu',     // Thumbs up
    'l0MYt5jPR6QX5pnqM', // Nice!
    '3ohzdIuqJoo8QdKlnW', // Good one
    'xT9DPBMumj2Q0hlI3K', // Well done
    'd3mlE7uhX8KFgEmY',  // Good job
  ],
  okay_rating: [
    'xT9DPBMumj2Q0hlI3K', // Got it
    '3ohzdIuqJoo8QdKlnW', // Understood
    '26AHLNr8en8J3ovOo', // Okay
    'l0MYGHzBrmmkolWqQ', // Alright
    '111ebonMs90YLu',     // Thumbs up
  ],
  
  // FAREWELL
  farewell: [
    '3ornka9rAaKRA2Rkac', // Bye wave
    'ASd0Ukj0y3qMM',      // Goodbye
    'l0MYC0LajbaPoEADu', // See you
    '42D3CxaINsAFemFuId', // Have fun!
    'xT9IgG50Fb7Mi0prBC', // Bye bye
  ],
  enjoy: [
    'l3vRfhFD8hJCiP0uQ', // Have fun!
    '3oEjI4sFlp73fvEYgw', // Enjoy
    '26AHCgWcYM1xSKuRy', // Good vibes
    'l0MYt5jPR6QX5pnqM', // Great time
    '3ornka9rAaKRA2Rkac', // Enjoy wave
  ],
  
  // WELCOME BACK - Returning user celebration
  welcome_back: [
    '3ohzdIuqJoo8QdKlnW', // Excited to see you
    'l0MYGb1LuZ3n7dRnO',  // Welcoming back
    'xT9IgG50Fb7Mi0prBC', // Happy to see you
    '3o7abKhOpu0NwenH3O', // Miss you!
    'd3mlE7uhX8KFgEmY',   // Happy clapping
    '3oriO5t2QB4IPKgxHi', // So glad you're back
    '26BRuo6sLetdllPAQ',  // Welcome!
  ],
  
  // GENERIC EXCITEMENT
  excited: [
    '5GoVLqeAOo6PK',      // Excited!
    'l3vRfhFD8hJCiP0uQ', // Let's go!
    '26BRzozg4TCBXv6QU', // Yay!
    'xT9IgG50Fb7Mi0prBC', // Happy
    '3ohzdIuqJoo8QdKlnW', // Woohoo
  ],
};

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!GIPHY_API_KEY) {
      console.error('GIPHY_API_KEY not configured');
      return NextResponse.json({ error: 'GIPHY API key not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'excited';

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

