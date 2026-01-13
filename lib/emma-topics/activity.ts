/**
 * Activity Rating Topic Module
 */

import { TopicModule } from './index';

export const activityTopic: TopicModule = {
  id: 'activity',
  name: 'Activity Rating',
  description: 'Rate a tour, activity, or experience',
  
  triggers: [
    'tour', 'activity', 'experience', 'adventure', 'dive', 'diving',
    'hike', 'hiking', 'trail', 'rainforest', 'bird', 'birding',
    'kayak', 'paddleboard', 'boat', 'fishing', 'zip line',
    'goat race', 'sunday school', 'party', 'nightlife', 'glass bottom',
    'turtle watching', 'waterfall', 'nature', 'wildlife'
  ],
  
  entryMessage: "Adventure time! 🌴 Tell me about the activity or tour you did!",
  
  questions: [
    {
      id: 'activity_name',
      type: 'text',
      prompt: "What activity or tour did you do?",
      required: true,
    },
    {
      id: 'provider',
      type: 'text',
      prompt: "Who was the tour operator or guide? (if applicable)",
      required: false,
    },
    {
      id: 'overall_rating',
      type: 'stars',
      prompt: "How would you rate the overall experience?",
      required: true,
    },
    {
      id: 'value_rating',
      type: 'stars',
      prompt: "How was the value for money?",
      required: false,
    },
    {
      id: 'guide_rating',
      type: 'stars',
      prompt: "How was your guide? (if you had one)",
      required: false,
    },
    {
      id: 'highlights',
      type: 'text',
      prompt: "What was the highlight?",
      required: false,
    },
    {
      id: 'would_recommend',
      type: 'choice',
      prompt: "Would you recommend this?",
      options: ['Absolutely!', 'Yes', 'Maybe', 'No'],
      required: true,
    },
    {
      id: 'tips',
      type: 'text',
      prompt: "Any tips for others?",
      required: false,
    },
  ],
  
  followUpPrompts: {
    '5_star': [
      "5 stars! What an adventure! 🌟",
      "Perfect score! Sounds incredible!",
      "Amazing! That's the Tobago experience!",
    ],
    '4_star': [
      "4 stars - great activity! 👍",
      "Almost perfect! Sounds fun!",
      "Nice! Glad you enjoyed it!",
    ],
    'diving': [
      "The diving here is world-class! 🤿",
      "Did you see any manta rays?",
      "Speyside has some of the best diving!",
    ],
    'rainforest': [
      "The Main Ridge is magical! 🌿",
      "Oldest protected rainforest in the Western Hemisphere!",
      "Did you spot any birds?",
    ],
    'sunday_school': [
      "Sunday School is legendary! 🎵",
      "Buccoo comes alive on Sundays!",
      "The best party in Tobago!",
    ],
  },
  
  exitConditions: [
    'done', 'finished', 'that\'s all', 'nothing else', 'thanks'
  ],
  
  gifType: 'adventure',
};

/**
 * Popular Tobago activities for auto-suggest
 */
export const POPULAR_ACTIVITIES = [
  { name: 'Main Ridge Rainforest Hike', type: 'nature', duration: '2-4 hours' },
  { name: 'Argyle Waterfall', type: 'nature', duration: '1-2 hours' },
  { name: 'Buccoo Reef Glass Bottom Boat', type: 'water', duration: '2-3 hours' },
  { name: 'Nylon Pool Visit', type: 'water', duration: '1-2 hours' },
  { name: 'Scuba Diving at Speyside', type: 'water', duration: 'Half day' },
  { name: 'Sunday School Party', type: 'nightlife', duration: 'Evening' },
  { name: 'Turtle Watching (seasonal)', type: 'wildlife', duration: '2-4 hours' },
  { name: 'Little Tobago Bird Sanctuary', type: 'nature', duration: 'Half day' },
  { name: 'Fort King George Visit', type: 'history', duration: '1-2 hours' },
  { name: 'Goat Racing (Easter)', type: 'cultural', duration: '3-4 hours' },
  { name: 'Fishing Charter', type: 'water', duration: 'Half/Full day' },
  { name: 'Stand-up Paddleboarding', type: 'water', duration: '1-2 hours' },
];

/**
 * Check if input matches a known activity
 */
export function matchKnownActivity(input: string): typeof POPULAR_ACTIVITIES[0] | null {
  const lowered = input.toLowerCase();
  return POPULAR_ACTIVITIES.find(a => 
    lowered.includes(a.name.toLowerCase()) ||
    a.name.toLowerCase().includes(lowered)
  ) || null;
}
