/**
 * Beach Rating Topic Module
 */

import { TopicModule } from './index';

export const beachTopic: TopicModule = {
  id: 'beach',
  name: 'Beach Rating',
  description: 'Rate a beach or natural spot',
  
  triggers: [
    'beach', 'pigeon point', 'store bay', 'englishman\'s bay', 'castara',
    'parlatuvier', 'man-o-war', 'speyside', 'snorkel', 'swim', 'sand',
    'coral', 'reef', 'nylon pool', 'turtle', 'waterfall', 'argyle',
    'buccoo', 'ocean', 'sea'
  ],
  
  entryMessage: "Beach vibes! 🏖️ Tobago has some amazing spots. Which beach or natural area did you check out?",
  
  questions: [
    {
      id: 'place_name',
      type: 'text',
      prompt: "Which beach or spot?",
      required: true,
    },
    {
      id: 'overall_rating',
      type: 'stars',
      prompt: "How would you rate it overall?",
      required: true,
    },
    {
      id: 'water_quality',
      type: 'choice',
      prompt: "How was the water?",
      options: ['Crystal clear!', 'Pretty good', 'Okay', 'Murky'],
      required: false,
    },
    {
      id: 'crowd_level',
      type: 'choice',
      prompt: "How crowded was it?",
      options: ['Had it to myself!', 'Quiet', 'Moderate', 'Packed'],
      required: false,
    },
    {
      id: 'facilities',
      type: 'choice',
      prompt: "Were there good facilities?",
      options: ['Great facilities', 'Basic but fine', 'Minimal', 'None (that\'s okay)'],
      required: false,
    },
    {
      id: 'activities',
      type: 'text',
      prompt: "What did you do there? (swimming, snorkeling, just relaxing...)",
      required: false,
    },
    {
      id: 'would_recommend',
      type: 'choice',
      prompt: "Would you recommend this spot?",
      options: ['Must visit!', 'Worth it', 'If you have time', 'Skip it'],
      required: true,
    },
    {
      id: 'tips',
      type: 'text',
      prompt: "Any tips for other visitors?",
      required: false,
    },
  ],
  
  followUpPrompts: {
    '5_star': [
      "5 stars! A paradise find! 🌴",
      "Perfect score! That's Tobago magic!",
      "Wow! Sounds absolutely stunning!",
    ],
    '4_star': [
      "4 stars - a great beach day! 👍",
      "Almost perfect! Beautiful spot!",
      "Solid rating! Sounds lovely!",
    ],
    '3_star': [
      "3 stars - decent beach time!",
      "Middle ground - fair enough!",
      "Thanks for the honest review!",
    ],
    'low_star': [
      "Oh no! What happened? 😬",
      "Sorry it wasn't great!",
      "Thanks for the heads up!",
    ],
    'crystal_clear': [
      "That Caribbean blue! Nothing like it! 🌊",
      "That's what we love to hear!",
      "Perfect for snorkeling!",
    ],
    'quiet': [
      "The best kind of beach! 🏝️",
      "A hidden gem vibe!",
      "Peace and quiet - perfect!",
    ],
  },
  
  exitConditions: [
    'done', 'finished', 'that\'s all', 'nothing else', 'thanks'
  ],
  
  gifType: 'beach',
};

/**
 * Popular Tobago beaches for auto-suggest
 */
export const POPULAR_BEACHES = [
  { name: 'Pigeon Point', location: 'Crown Point', features: 'Iconic jetty, calm water, facilities' },
  { name: 'Store Bay', location: 'Crown Point', features: 'Food stalls, glass-bottom boats' },
  { name: 'Englishman\'s Bay', location: 'North coast', features: 'Secluded, pristine, jungle-backed' },
  { name: 'Castara Bay', location: 'North coast', features: 'Fishing village, authentic vibe' },
  { name: 'Parlatuvier Bay', location: 'North coast', features: 'Horseshoe bay, very quiet' },
  { name: 'Man-O-War Bay', location: 'Charlotteville', features: 'Blue flag beach, facilities' },
  { name: 'Buccoo Bay', location: 'Buccoo', features: 'Sunday School party spot' },
  { name: 'Nylon Pool', location: 'Offshore', features: 'Natural sandbar pool' },
  { name: 'Mt. Irvine Bay', location: 'Mt. Irvine', features: 'Great for surfing' },
  { name: 'Speyside Beach', location: 'Speyside', features: 'Diving, Little Tobago access' },
];

/**
 * Check if input matches a known beach
 */
export function matchKnownBeach(input: string): typeof POPULAR_BEACHES[0] | null {
  const lowered = input.toLowerCase();
  return POPULAR_BEACHES.find(b => 
    lowered.includes(b.name.toLowerCase()) ||
    b.name.toLowerCase().includes(lowered)
  ) || null;
}
