import { NextRequest, NextResponse } from 'next/server';

// GIPHY API key - set in environment variables
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// Curated search terms - intentional GIFs that SAY something or have clear meaning
const REACTION_SEARCHES: Record<string, string[]> = {
  // Greetings - GIFs that literally wave or say hello
  welcome: ['hello wave', 'hi there wave', 'hey wave', 'waving hello'],
  hey_there: ['hey there', 'hi wave', 'hello friend', 'waving hi'],
  
  // Name reactions - cool, impressed, sunglasses, pointing
  name_reaction: ['cool sunglasses', 'you are awesome', 'finger pointing you', 'impressed nodding', 'thats cool'],
  cool_name: ['deal with it sunglasses', 'cool guy', 'awesome pointing', 'nice one'],
  
  // Thank you - literal thank you GIFs
  thank_you: ['thank you so much', 'thanks gif', 'thanking you', 'appreciate it'],
  thanks: ['thanks a lot', 'thank you gif', 'grateful thank'],
  
  // Travel arrivals
  plane: ['airplane landing', 'plane arrival', 'flying in', 'welcome flight'],
  cruise: ['cruise ship wave', 'ship ahoy', 'sailing in', 'ocean cruise'],
  ferry: ['boat wave', 'ferry ride', 'boat arrival', 'on the water'],
  
  // Activities - expressive GIFs
  beach: ['beach vibes', 'relaxing beach', 'tropical beach', 'paradise beach'],
  adventure: ['lets go adventure', 'exploring nature', 'hiking excited', 'adventure time'],
  food: ['yummy food', 'delicious eating', 'tasty food', 'food lover'],
  nightlife: ['lets party', 'dancing night', 'party time', 'music vibes'],
  photos: ['say cheese', 'taking picture', 'camera flash', 'photo time'],
  
  // Ratings - reactions
  five_stars: ['perfect amazing', 'excellent wow', 'thats amazing', 'so good'],
  good_rating: ['thumbs up nice', 'good job', 'nice one', 'well done'],
  okay_rating: ['understanding nod', 'i understand', 'got it nod', 'okay sure'],
  
  // Farewell
  farewell: ['have fun wave', 'goodbye wave', 'see you later', 'bye bye wave'],
  enjoy: ['have a great time', 'enjoy yourself', 'have fun', 'good vibes'],
  
  // Generic excitement
  excited: ['so excited', 'yay celebration', 'happy dance', 'lets go'],
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

