/**
 * Restaurant Rating Topic Module
 */

import { TopicModule } from './index';

export const restaurantTopic: TopicModule = {
  id: 'restaurant',
  name: 'Restaurant Rating',
  description: 'Rate your dining experience',
  
  triggers: [
    'restaurant', 'food', 'eat', 'ate', 'dinner', 'lunch', 'breakfast',
    'cafe', 'bar', 'beach bar', 'roti', 'doubles', 'bake and shark',
    'crab', 'dumpling', 'fish', 'curry', 'dining', 'meal'
  ],
  
  entryMessage: "Ooh food talk! 🍽️ I love hearing about dining experiences. Which restaurant or food spot did you visit?",
  
  questions: [
    {
      id: 'place_name',
      type: 'text',
      prompt: "What's the name of the place?",
      required: true,
    },
    {
      id: 'location',
      type: 'text',
      prompt: "Where is it located? (e.g., Store Bay, Scarborough, Speyside)",
      required: false,
    },
    {
      id: 'food_rating',
      type: 'stars',
      prompt: "How was the food? Rate 1-5 stars",
      required: true,
    },
    {
      id: 'service_rating',
      type: 'stars',
      prompt: "How was the service?",
      required: true,
    },
    {
      id: 'signature_dish',
      type: 'text',
      prompt: "What did you try? Any standout dishes?",
      required: false,
    },
    {
      id: 'would_recommend',
      type: 'choice',
      prompt: "Would you recommend this spot?",
      options: ['Definitely yes!', 'Maybe', 'Probably not'],
      required: true,
    },
    {
      id: 'review',
      type: 'text',
      prompt: "Any other thoughts? What should other visitors know?",
      required: false,
    },
  ],
  
  followUpPrompts: {
    '5_star': [
      "Wow, 5 stars! That's amazing! 🌟",
      "A perfect score! Must have been incredible!",
      "5 stars - that's going straight to my top recommendations!",
    ],
    '4_star': [
      "4 stars - solid choice! 👍",
      "Almost perfect! What could make it 5?",
      "Great rating! Sounds like a good spot.",
    ],
    '3_star': [
      "3 stars - decent! What could be better?",
      "Middle of the road. Fair enough!",
      "Not bad, not great. I appreciate the honesty!",
    ],
    'low_star': [
      "Oof, sorry to hear that! 😬",
      "That's disappointing. What went wrong?",
      "Thanks for the heads up - helps other visitors!",
    ],
    'recommend_yes': [
      "Awesome! I'll definitely tell other visitors! 📝",
      "Added to my recommendation list!",
      "Great to know - spreading the word!",
    ],
    'recommend_no': [
      "Noted! I'll keep that in mind 📋",
      "Thanks for being honest - helps everyone!",
      "Appreciate you sharing that!",
    ],
  },
  
  exitConditions: [
    'done', 'finished', 'that\'s all', 'nothing else',
    'no more', 'thanks', 'thank you', 'bye'
  ],
  
  gifType: 'food',
};

/**
 * Popular Tobago restaurants for auto-suggest
 */
export const POPULAR_RESTAURANTS = [
  { name: 'Store Bay Facilities', location: 'Crown Point', specialty: 'Bake & Shark, Crab & Dumpling' },
  { name: 'Jemma\'s Tree House', location: 'Speyside', specialty: 'Local seafood with ocean view' },
  { name: 'Kariwak Village', location: 'Crown Point', specialty: 'Vegetarian-friendly, local cuisine' },
  { name: 'The Seahorse Inn', location: 'Grafton', specialty: 'Fine dining seafood' },
  { name: 'Shutters on the Bay', location: 'Milford Bay', specialty: 'Caribbean fusion' },
  { name: 'Café Coco', location: 'Crown Point', specialty: 'Beachside casual dining' },
  { name: 'Blue Crab Restaurant', location: 'Scarborough', specialty: 'Local Tobagonian food' },
  { name: 'Bonkers', location: 'Crown Point', specialty: 'International cuisine, nightlife' },
  { name: 'La Tartaruga', location: 'Buccoo', specialty: 'Italian-Caribbean fusion' },
  { name: 'Fish Pot', location: 'Pleasant Prospect', specialty: 'Fresh seafood' },
];

/**
 * Check if input matches a known restaurant
 */
export function matchKnownRestaurant(input: string): typeof POPULAR_RESTAURANTS[0] | null {
  const lowered = input.toLowerCase();
  return POPULAR_RESTAURANTS.find(r => 
    lowered.includes(r.name.toLowerCase()) ||
    r.name.toLowerCase().includes(lowered)
  ) || null;
}
