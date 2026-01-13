/**
 * Emma Topic Modules
 * 
 * Modular conversation topic handlers for different types of interactions.
 */

export interface TopicQuestion {
  id: string;
  type: 'text' | 'stars' | 'choice' | 'multi-choice';
  prompt: string;
  options?: string[];
  required?: boolean;
  validation?: (value: string | number) => boolean;
}

export interface TopicModule {
  id: string;
  name: string;
  description: string;
  triggers: string[]; // Keywords that activate this topic
  entryMessage: string;
  questions: TopicQuestion[];
  followUpPrompts: Record<string, string[]>; // Key responses to follow-up prompts
  exitConditions: string[];
  gifType?: string;
}

export interface TopicResponse {
  message: string;
  nextQuestion?: TopicQuestion;
  complete?: boolean;
  data?: Record<string, unknown>;
  gifType?: string;
}

// Import all topic modules
export { restaurantTopic } from './restaurant';
export { beachTopic } from './beach';
export { activityTopic } from './activity';
export { freeChatTopic } from './free-chat';

// Topic registry
import { restaurantTopic } from './restaurant';
import { beachTopic } from './beach';
import { activityTopic } from './activity';
import { freeChatTopic } from './free-chat';

export const TOPIC_MODULES: TopicModule[] = [
  restaurantTopic,
  beachTopic,
  activityTopic,
  freeChatTopic,
];

/**
 * Find topic by trigger keywords
 */
export function findTopicByTrigger(input: string): TopicModule | null {
  const lowered = input.toLowerCase();
  
  for (const topic of TOPIC_MODULES) {
    for (const trigger of topic.triggers) {
      if (lowered.includes(trigger.toLowerCase())) {
        return topic;
      }
    }
  }
  
  return null;
}

/**
 * Get topic by ID
 */
export function getTopicById(id: string): TopicModule | null {
  return TOPIC_MODULES.find(t => t.id === id) || null;
}

/**
 * Get all available topic names for menu display
 */
export function getAvailableTopics(): { id: string; name: string; description: string }[] {
  return TOPIC_MODULES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}
