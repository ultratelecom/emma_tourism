import { NextRequest, NextResponse } from 'next/server';

// GIPHY API - using the public beta key for now
// For production, get your own key at https://developers.giphy.com/
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // Public beta key

// Curated search terms for different reaction types
const REACTION_SEARCHES: Record<string, string[]> = {
  welcome: ['welcome', 'hello wave', 'hey there', 'greetings'],
  name_reaction: ['impressed', 'nice', 'cool', 'awesome reaction'],
  thank_you: ['thank you', 'thanks', 'grateful', 'appreciate'],
  excited: ['excited', 'yay', 'celebration', 'happy dance'],
  travel: ['travel', 'vacation', 'beach vibes', 'tropical'],
  plane: ['airplane', 'flying', 'takeoff', 'travel plane'],
  cruise: ['cruise ship', 'ocean', 'sailing', 'boat wave'],
  ferry: ['boat', 'ferry', 'sea travel', 'ocean waves'],
  beach: ['beach', 'relaxing beach', 'tropical paradise', 'ocean waves'],
  adventure: ['adventure', 'hiking', 'nature', 'exploring'],
  food: ['delicious food', 'yummy', 'eating', 'tasty'],
  nightlife: ['party', 'dancing', 'music vibes', 'night out'],
  photos: ['camera', 'taking photos', 'photography', 'snapshot'],
  five_stars: ['amazing', 'perfect', 'five stars', 'excellent'],
  good_rating: ['thumbs up', 'nice', 'good job', 'approval'],
  okay_rating: ['its okay', 'not bad', 'understanding', 'nodding'],
  farewell: ['goodbye wave', 'see you', 'bye bye', 'have fun'],
  heart: ['heart', 'love', 'sending love', 'heart reaction'],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'excited';
    const random = searchParams.get('random') === 'true';

    // Get search terms for this reaction type
    const searches = REACTION_SEARCHES[type] || REACTION_SEARCHES.excited;
    const searchTerm = random 
      ? searches[Math.floor(Math.random() * searches.length)]
      : searches[0];

    // Fetch from GIPHY
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=10&rating=g&lang=en`
    );

    if (!response.ok) {
      throw new Error('GIPHY API failed');
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      // Fallback to trending if no results
      const trendingResponse = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=5&rating=g`
      );
      const trendingData = await trendingResponse.json();
      
      if (trendingData.data && trendingData.data.length > 0) {
        const randomGif = trendingData.data[Math.floor(Math.random() * trendingData.data.length)];
        return NextResponse.json({
          url: randomGif.images.fixed_height.url,
          width: randomGif.images.fixed_height.width,
          height: randomGif.images.fixed_height.height,
          title: randomGif.title,
        });
      }
    }

    // Pick a random GIF from results
    const randomGif = data.data[Math.floor(Math.random() * data.data.length)];
    
    return NextResponse.json({
      url: randomGif.images.fixed_height.url,
      width: randomGif.images.fixed_height.width,
      height: randomGif.images.fixed_height.height,
      title: randomGif.title,
    });

  } catch (error) {
    console.error('GIF fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch GIF' }, { status: 500 });
  }
}

