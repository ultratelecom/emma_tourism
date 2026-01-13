/**
 * Curated Tobago Places Database
 * 
 * This serves as Emma's knowledge base for recommendations.
 * Photos are from Unsplash (free to use).
 * Ratings and descriptions are curated locally.
 * 
 * In the future, this can be enhanced with Google Places API data.
 */

export type PlaceCategory = 'restaurant' | 'beach' | 'activity' | 'bar' | 'attraction' | 'hotel';

export interface TobagoPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  subcategory: string;
  rating: number;
  reviewCount: number;
  priceLevel: 1 | 2 | 3 | 4; // $ to $$$$
  description: string;
  shortDescription: string;
  location: string;
  area: string;
  coordinates?: { lat: number; lng: number };
  phone?: string;
  website?: string;
  hours?: string;
  imageUrl: string;
  tags: string[];
  emmaNote: string; // Emma's personal recommendation
  mustTry?: string; // Signature dish or experience
}

// ============================================
// RESTAURANTS
// ============================================

export const RESTAURANTS: TobagoPlace[] = [
  {
    id: 'miss-trims',
    name: "Miss Trim's",
    category: 'restaurant',
    subcategory: 'Local Food',
    rating: 4.8,
    reviewCount: 342,
    priceLevel: 1,
    description: "Legendary local food stall at Store Bay Beach Facility. Miss Trim has been serving her famous crab and dumpling for decades. The portions are generous and the flavor is authentic Tobagonian.",
    shortDescription: "Legendary crab & dumpling spot",
    location: "Store Bay Beach Facility",
    area: "Crown Point",
    phone: "+1 868-555-0101",
    hours: "8am - 6pm daily",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    tags: ['local', 'seafood', 'budget-friendly', 'authentic'],
    emmaNote: "This is THE spot for crab and dumpling. Get here early, she sells out!",
    mustTry: "Crab and Dumpling",
  },
  {
    id: 'miss-jeans',
    name: "Miss Jean's",
    category: 'restaurant',
    subcategory: 'Local Food',
    rating: 4.7,
    reviewCount: 289,
    priceLevel: 1,
    description: "Another Store Bay institution famous for bake and shark. The shark is perfectly seasoned and the homemade pepper sauce is incredible.",
    shortDescription: "Famous bake & shark",
    location: "Store Bay Beach Facility",
    area: "Crown Point",
    hours: "9am - 5pm daily",
    imageUrl: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop",
    tags: ['local', 'seafood', 'budget-friendly', 'quick-bite'],
    emmaNote: "The bake and shark here is perfection. Don't skip the pepper sauce!",
    mustTry: "Bake and Shark",
  },
  {
    id: 'kariwak-village',
    name: "Kariwak Village Restaurant",
    category: 'restaurant',
    subcategory: 'Caribbean Fine Dining',
    rating: 4.6,
    reviewCount: 456,
    priceLevel: 3,
    description: "Farm-to-table Caribbean cuisine in a beautiful garden setting. Known for their Friday night buffet with live steel pan music. Organic ingredients from their own garden.",
    shortDescription: "Organic Caribbean fine dining",
    location: "Store Bay Local Road",
    area: "Crown Point",
    phone: "+1 868-639-8442",
    website: "https://kariwak.com",
    hours: "7am - 10pm daily",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
    tags: ['fine-dining', 'organic', 'garden', 'romantic', 'vegetarian-friendly'],
    emmaNote: "Perfect for a special dinner. The Friday buffet with steel pan is magical!",
    mustTry: "Friday Night Buffet",
  },
  {
    id: 'jemmas-treehouse',
    name: "Jemma's Seaview Kitchen",
    category: 'restaurant',
    subcategory: 'Caribbean Seafood',
    rating: 4.5,
    reviewCount: 523,
    priceLevel: 2,
    description: "Iconic restaurant literally built in a tree overlooking Speyside. Fresh seafood with stunning views of Little Tobago island. A must-visit experience.",
    shortDescription: "Restaurant in a tree with ocean views",
    location: "Speyside Main Road",
    area: "Speyside",
    phone: "+1 868-660-4066",
    hours: "10am - 9pm daily",
    imageUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop",
    tags: ['seafood', 'scenic', 'unique', 'instagram-worthy'],
    emmaNote: "Eating in an actual tree! The views are unreal. Get the catch of the day.",
    mustTry: "Fresh Catch of the Day",
  },
  {
    id: 'seahorse-inn',
    name: "Seahorse Inn",
    category: 'restaurant',
    subcategory: 'Seafood & Steakhouse',
    rating: 4.4,
    reviewCount: 234,
    priceLevel: 3,
    description: "Upscale beachfront dining in Grafton. Known for their grilled lobster and romantic sunset views. Great cocktail menu.",
    shortDescription: "Upscale beachfront seafood",
    location: "Grafton Beach Road",
    area: "Black Rock",
    phone: "+1 868-639-0686",
    hours: "11am - 10pm daily",
    imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
    tags: ['upscale', 'seafood', 'romantic', 'sunset', 'cocktails'],
    emmaNote: "Super romantic for date night. The lobster is amazing!",
    mustTry: "Grilled Caribbean Lobster",
  },
  {
    id: 'skewers',
    name: "Skewers",
    category: 'restaurant',
    subcategory: 'Grill & Bar',
    rating: 4.3,
    reviewCount: 187,
    priceLevel: 2,
    description: "Casual grill spot with great kebabs, wings, and drinks. Popular with locals and tourists alike. Good vibes and reasonable prices.",
    shortDescription: "Chill grill spot with great kebabs",
    location: "Milford Road",
    area: "Crown Point",
    hours: "4pm - 11pm, closed Mondays",
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    tags: ['casual', 'grill', 'bar', 'nightlife', 'wings'],
    emmaNote: "Great spot to lime (hang out) with good food and drinks!",
    mustTry: "Mixed Grill Platter",
  },
  {
    id: 'shutters',
    name: "Shutters on the Bay",
    category: 'restaurant',
    subcategory: 'Fine Dining',
    rating: 4.5,
    reviewCount: 312,
    priceLevel: 4,
    description: "Elegant fine dining at the Magdalena Grand Beach Resort. International cuisine with Caribbean flair. Perfect for special occasions.",
    shortDescription: "Elegant resort fine dining",
    location: "Magdalena Grand Beach Resort",
    area: "Lowlands",
    phone: "+1 868-660-8500",
    hours: "6pm - 10pm, closed Sundays",
    imageUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=400&h=300&fit=crop",
    tags: ['fine-dining', 'resort', 'special-occasion', 'romantic'],
    emmaNote: "The fanciest spot on the island. Save it for a celebration!",
    mustTry: "Tasting Menu",
  },
];

// ============================================
// BEACHES
// ============================================

export const BEACHES: TobagoPlace[] = [
  {
    id: 'pigeon-point',
    name: "Pigeon Point Beach",
    category: 'beach',
    subcategory: 'Iconic Beach',
    rating: 4.7,
    reviewCount: 1243,
    priceLevel: 2,
    description: "Tobago's most famous beach with the iconic thatched-roof jetty. Crystal clear water, white sand, and all amenities. Small entrance fee.",
    shortDescription: "Iconic beach with famous jetty",
    location: "Pigeon Point Heritage Park",
    area: "Crown Point",
    hours: "9am - 5pm daily",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop",
    tags: ['iconic', 'calm-water', 'amenities', 'family-friendly', 'instagram'],
    emmaNote: "THE beach everyone has to see. That jetty is everywhere on postcards!",
    mustTry: "Photo at the jetty",
  },
  {
    id: 'store-bay',
    name: "Store Bay Beach",
    category: 'beach',
    subcategory: 'Local Beach',
    rating: 4.5,
    reviewCount: 876,
    priceLevel: 1,
    description: "Local favorite with the best food stalls on the island. Calm water, free entry, and incredible local cuisine right on the beach.",
    shortDescription: "Local beach with amazing food",
    location: "Store Bay Beach Facility",
    area: "Crown Point",
    hours: "Always open",
    imageUrl: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&h=300&fit=crop",
    tags: ['local', 'food', 'free', 'calm-water', 'authentic'],
    emmaNote: "This is where the locals go. The food stalls are incredible!",
    mustTry: "Beach day + crab and dumpling",
  },
  {
    id: 'englishmans-bay',
    name: "Englishman's Bay",
    category: 'beach',
    subcategory: 'Secluded Beach',
    rating: 4.9,
    reviewCount: 234,
    priceLevel: 1,
    description: "Pristine, uncrowded beach surrounded by rainforest. One of the most beautiful and peaceful beaches in the Caribbean. Limited facilities.",
    shortDescription: "Pristine secluded paradise",
    location: "Englishman's Bay Road",
    area: "Castara",
    hours: "Always open",
    imageUrl: "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=400&h=300&fit=crop",
    tags: ['secluded', 'pristine', 'nature', 'quiet', 'romantic'],
    emmaNote: "My secret favorite! So peaceful and untouched. Bring your own snacks.",
    mustTry: "Just floating in paradise",
  },
  {
    id: 'castara-bay',
    name: "Castara Bay",
    category: 'beach',
    subcategory: 'Village Beach',
    rating: 4.6,
    reviewCount: 345,
    priceLevel: 1,
    description: "Charming fishing village beach with local restaurants. Watch fishermen bring in their catch. Authentic Tobago experience.",
    shortDescription: "Charming fishing village beach",
    location: "Castara Village",
    area: "Castara",
    hours: "Always open",
    imageUrl: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=400&h=300&fit=crop",
    tags: ['authentic', 'fishing-village', 'local', 'restaurants', 'peaceful'],
    emmaNote: "Such a vibe! Watch the fishermen, swim, then eat fresh fish.",
    mustTry: "Lunch at a local restaurant",
  },
  {
    id: 'mt-irvine-bay',
    name: "Mt. Irvine Bay",
    category: 'beach',
    subcategory: 'Surf Beach',
    rating: 4.4,
    reviewCount: 456,
    priceLevel: 1,
    description: "Popular surfing spot with consistent waves. Beautiful beach with a mix of calm and surf areas. Beach bar on site.",
    shortDescription: "Great surf spot",
    location: "Mt. Irvine Bay Road",
    area: "Mt. Irvine",
    hours: "Always open",
    imageUrl: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&h=300&fit=crop",
    tags: ['surfing', 'waves', 'beach-bar', 'sports'],
    emmaNote: "Best surf on the island! Even if you don't surf, it's beautiful.",
    mustTry: "Surfing lesson",
  },
];

// ============================================
// ACTIVITIES
// ============================================

export const ACTIVITIES: TobagoPlace[] = [
  {
    id: 'buccoo-reef',
    name: "Buccoo Reef & Nylon Pool",
    category: 'activity',
    subcategory: 'Snorkeling Tour',
    rating: 4.6,
    reviewCount: 1567,
    priceLevel: 2,
    description: "Glass-bottom boat tour to Buccoo Reef for snorkeling, then to the Nylon Pool, a shallow sandbar in the middle of the sea. Legendary experience.",
    shortDescription: "Snorkeling + famous Nylon Pool",
    location: "Buccoo Bay",
    area: "Buccoo",
    hours: "Tours: 10am, 2pm daily",
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    tags: ['snorkeling', 'boat-tour', 'must-do', 'swimming', 'coral'],
    emmaNote: "You HAVE to do this. The Nylon Pool is surreal, waist-deep water in the middle of the ocean!",
    mustTry: "Swimming in the Nylon Pool",
  },
  {
    id: 'sunday-school',
    name: "Sunday School",
    category: 'activity',
    subcategory: 'Nightlife & Party',
    rating: 4.8,
    reviewCount: 892,
    priceLevel: 1,
    description: "Legendary Sunday night street party in Buccoo village. Live music, dancing, BBQ, drinks, and incredible vibes. The party goes late!",
    shortDescription: "Legendary Sunday night party",
    location: "Buccoo Village",
    area: "Buccoo",
    hours: "Sundays from 7pm",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop",
    tags: ['nightlife', 'party', 'music', 'dancing', 'local-culture'],
    emmaNote: "THE Tobago experience! Everyone goes. The energy is unmatched.",
    mustTry: "Dancing to soca music",
  },
  {
    id: 'argyle-waterfall',
    name: "Argyle Waterfall",
    category: 'activity',
    subcategory: 'Nature & Hiking',
    rating: 4.5,
    reviewCount: 678,
    priceLevel: 1,
    description: "Tobago's tallest waterfall with three tiers. Short jungle hike to reach it. You can swim in the pools at each level. Guided tours available.",
    shortDescription: "Tobago's tallest waterfall",
    location: "Argyle Village",
    area: "Roxborough",
    hours: "8am - 4pm daily",
    imageUrl: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&h=300&fit=crop",
    tags: ['waterfall', 'hiking', 'nature', 'swimming', 'photography'],
    emmaNote: "Bring water shoes! You can climb up and swim at each level.",
    mustTry: "Swimming at the top tier",
  },
  {
    id: 'main-ridge',
    name: "Main Ridge Forest Reserve",
    category: 'activity',
    subcategory: 'Nature & Hiking',
    rating: 4.7,
    reviewCount: 445,
    priceLevel: 1,
    description: "The oldest protected rainforest in the Western Hemisphere (since 1776). Amazing birdwatching, hiking trails, and wildlife. Hire a local guide!",
    shortDescription: "World's oldest protected rainforest",
    location: "Main Ridge",
    area: "Roxborough",
    hours: "Daylight hours",
    imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop",
    tags: ['rainforest', 'hiking', 'birdwatching', 'nature', 'history'],
    emmaNote: "Hire a guide! They know where all the birds and wildlife hide.",
    mustTry: "Guided birdwatching tour",
  },
  {
    id: 'speyside-diving',
    name: "Speyside Diving",
    category: 'activity',
    subcategory: 'Diving & Snorkeling',
    rating: 4.8,
    reviewCount: 334,
    priceLevel: 3,
    description: "World-class diving at Speyside. See giant manta rays, brain coral the size of cars, and incredible marine life. Multiple dive shops available.",
    shortDescription: "World-class Caribbean diving",
    location: "Speyside",
    area: "Speyside",
    hours: "Shops open 8am - 5pm",
    imageUrl: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=400&h=300&fit=crop",
    tags: ['diving', 'scuba', 'marine-life', 'manta-rays', 'coral'],
    emmaNote: "Divers say this is some of the best in the Caribbean. The brain coral is massive!",
    mustTry: "Dive at Japanese Gardens",
  },
  {
    id: 'fort-king-george',
    name: "Fort King George",
    category: 'activity',
    subcategory: 'History & Culture',
    rating: 4.3,
    reviewCount: 567,
    priceLevel: 1,
    description: "Historic British fort with panoramic views of Scarborough. Museum inside with Tobago history. Beautiful grounds and cannons.",
    shortDescription: "Historic fort with amazing views",
    location: "Fort Street",
    area: "Scarborough",
    hours: "9am - 5pm, closed Sundays",
    imageUrl: "https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=400&h=300&fit=crop",
    tags: ['history', 'museum', 'views', 'photography', 'culture'],
    emmaNote: "Great views and interesting history. Cool spot for photos!",
    mustTry: "Sunset views from the ramparts",
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAllPlaces(): TobagoPlace[] {
  return [...RESTAURANTS, ...BEACHES, ...ACTIVITIES];
}

export function getPlacesByCategory(category: PlaceCategory): TobagoPlace[] {
  return getAllPlaces().filter(p => p.category === category);
}

export function getPlacesByArea(area: string): TobagoPlace[] {
  return getAllPlaces().filter(p => p.area.toLowerCase() === area.toLowerCase());
}

export function getPlacesByTag(tag: string): TobagoPlace[] {
  return getAllPlaces().filter(p => p.tags.includes(tag.toLowerCase()));
}

export function searchPlaces(query: string): TobagoPlace[] {
  const q = query.toLowerCase();
  return getAllPlaces().filter(p => 
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tags.some(t => t.includes(q)) ||
    p.subcategory.toLowerCase().includes(q)
  );
}

export function getTopRated(category?: PlaceCategory, limit = 3): TobagoPlace[] {
  let places = category ? getPlacesByCategory(category) : getAllPlaces();
  return places.sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export function getRecommendations(intent: string): TobagoPlace[] {
  const q = intent.toLowerCase();
  
  // Food/restaurant queries
  if (q.includes('eat') || q.includes('food') || q.includes('restaurant') || q.includes('hungry') || q.includes('lunch') || q.includes('dinner') || q.includes('breakfast')) {
    return getTopRated('restaurant', 3);
  }
  
  // Beach queries
  if (q.includes('beach') || q.includes('swim') || q.includes('sand') || q.includes('ocean') || q.includes('sea')) {
    return getTopRated('beach', 3);
  }
  
  // Activity queries
  if (q.includes('do') || q.includes('activity') || q.includes('activities') || q.includes('fun') || q.includes('adventure') || q.includes('tour')) {
    return getTopRated('activity', 3);
  }
  
  // Nightlife
  if (q.includes('night') || q.includes('party') || q.includes('dance') || q.includes('bar') || q.includes('drink')) {
    return [
      ...ACTIVITIES.filter(a => a.tags.includes('nightlife')),
      ...RESTAURANTS.filter(r => r.tags.includes('bar') || r.tags.includes('nightlife')),
    ].slice(0, 3);
  }
  
  // Romantic
  if (q.includes('romantic') || q.includes('date') || q.includes('special') || q.includes('anniversary')) {
    return getAllPlaces().filter(p => p.tags.includes('romantic')).slice(0, 3);
  }
  
  // Budget
  if (q.includes('cheap') || q.includes('budget') || q.includes('affordable')) {
    return getAllPlaces().filter(p => p.priceLevel <= 2).sort((a, b) => b.rating - a.rating).slice(0, 3);
  }
  
  // Default: mix of top rated
  return [
    getTopRated('restaurant', 1)[0],
    getTopRated('beach', 1)[0],
    getTopRated('activity', 1)[0],
  ];
}

export function getPriceSymbol(level: number): string {
  return '$'.repeat(level);
}

export function getCategoryIcon(category: PlaceCategory): string {
  const icons: Record<PlaceCategory, string> = {
    restaurant: '🍽️',
    beach: '🏖️',
    activity: '🎯',
    bar: '🍹',
    attraction: '🏛️',
    hotel: '🏨',
  };
  return icons[category] || '📍';
}
