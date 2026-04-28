import type { AvaTurnPlan } from '../ava-turn-planner';

export const AVA_REQUIRED_FIELD_ORDER = [
  'current_location_text',
  'current_city_region',
  'current_country',
  'generation',
  'visit_frequency',
  'industry',
  'profession_text',
  'connection_score',
  'contribution_modes',
  'invest_intent',
  'invest_sectors',
  'barriers',
  'feature_priorities',
  'trust_text',
  'future_roles',
  'opportunity_text',
  'age_bracket',
  'gender',
  'education_level',
] as const;

export type AvaRequiredField = (typeof AVA_REQUIRED_FIELD_ORDER)[number];

export function chooseNextRequiredField(
  openFieldKeys: string[],
  opts?: { skipWork?: boolean },
): string | null {
  const skip = new Set(opts?.skipWork ? ['industry', 'profession_text'] : []);
  return AVA_REQUIRED_FIELD_ORDER.find(
    (field) => openFieldKeys.includes(field) && !skip.has(field),
  ) ?? null;
}

export function promptForRequiredField(field: string | null): string | null {
  switch (field) {
    case 'current_location_text':
    case 'current_city_region':
    case 'current_country':
      return 'Where in the world are you these days?';
    case 'generation':
      return 'How far back does Tobago go for you, were you born there or is it parents/grandparents?';
    case 'visit_frequency':
      return 'Did you ever live in Tobago yourself, or mostly visit?';
    case 'industry':
    case 'profession_text':
      return 'What kind of work are you in these days?';
    case 'connection_score':
      return "On a gut level, how tuned in are you to what's happening in Tobago these days?";
    case 'contribution_modes':
      return 'If the runway was there, what would you actually want to give back to Tobago, time, knowledge, money, reach, or something else?';
    case 'invest_intent':
      return 'Would you ever put money behind something in Tobago, or is that not really your lane?';
    case 'invest_sectors':
      return 'If you did consider investing, what sectors would catch your eye, tourism, land, agriculture, renewable energy, small business?';
    case 'barriers':
      return "What's the biggest thing that would stop you from contributing more to Tobago, information, trust, time, distance, or something else?";
    case 'feature_priorities':
      return 'If there was an online home for the diaspora, what would make it useful enough for you to actually come back to?';
    case 'trust_text':
      return 'What would it take for you to trust a platform like this, truly?';
    case 'future_roles':
      return 'Would you want to be involved in anything future-facing, advisory, virtual meetings, surveys, pilots, or would you rather just stay informed?';
    case 'opportunity_text':
      return "Last big one, no rush. In your eyes, where is Tobago's real opportunity for economic growth?";
    case 'age_bracket':
      return "Mind me asking a rough decade you're in, 20s, 30s, 40s?";
    case 'gender':
      return 'And how do you identify, he, she, they, something else?';
    case 'education_level':
      return "Where did you train for what you do, what's your background academically?";
    default:
      return null;
  }
}

export function recoveryReplyForPlan(plan: AvaTurnPlan): string | null {
  if (plan.next_best_question_focus === 'profile complete / graceful close') {
    return 'I have a much better sense of you now. The way you spoke about where you are, your Tobago roots, and what you would want to see for the island gives me plenty to hold onto.';
  }
  if (plan.reply_shape !== 'recover_to_profile_ask') return null;
  const prompt = promptForRequiredField(plan.next_best_question_focus);
  if (!prompt) return 'That gives me enough context there. What feels most important to you about staying connected to Tobago now?';
  return `That gives me enough context there. ${prompt}`;
}
