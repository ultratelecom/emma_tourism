import type { ExtractionResult, ExtractedProfileUpdate } from './ava-extract';
import type { AvaTurnPlan } from './ava-turn-planner';

const LOCATION_COUNTRY_MAP: Array<{ pattern: RegExp; country: string; city?: string }> = [
  { pattern: /\b(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b/i, country: 'United States', city: 'New York' },
  { pattern: /\b(miami|atlanta|houston|boston|washington dc|dc|orlando|tampa|fort lauderdale|los angeles|chicago)\b/i, country: 'United States' },
  { pattern: /\b(toronto|scarborough,?\s+ontario|mississauga|brampton|ottawa|montreal|calgary|vancouver)\b/i, country: 'Canada' },
  { pattern: /\b(london|birmingham|manchester|leeds|croydon)\b/i, country: 'United Kingdom' },
];

function clean(input: string): string {
  return input.trim().replace(/[.!?]+$/, '');
}

function update(
  field_key: string,
  value: ExtractedProfileUpdate['value'],
  confidence: number,
  evidence: string,
): ExtractedProfileUpdate {
  return { field_key, value, confidence, evidence };
}

function normalizeLocation(raw: string): ExtractedProfileUpdate[] {
  const value = clean(raw);
  if (!value) return [];
  const found = LOCATION_COUNTRY_MAP.find((entry) => entry.pattern.test(value));
  return [
    update('current_location_text', value, 0.98, raw),
    update('current_city_region', found?.city ?? value, found ? 0.85 : 0.7, raw),
    ...(found ? [update('current_country', found.country, 0.75, raw)] : []),
  ];
}

function generationFromShortAnswer(raw: string): ExtractedProfileUpdate | null {
  const lower = raw.toLowerCase();
  if (/\b(i was|i'm|i am|born there|born in tobago|born on the island|me)\b/.test(lower)) {
    return update('generation', '1st', 0.9, raw);
  }
  if (/\b(parent|parents|mother|father|mom|mum|dad)\b/.test(lower)) {
    return update('generation', '2nd', 0.85, raw);
  }
  if (/\b(grandparent|grandparents|grandmother|grandfather|grandma|grandad|granddad|gre?antparents?|granparents?)\b/.test(lower)) {
    return update('generation', '3rd', 0.85, raw);
  }
  if (/\b(great[- ]grand|great grand|fourth|4th)\b/.test(lower)) {
    return update('generation', '4th+', 0.8, raw);
  }
  return null;
}

function visitFrequencyFromAnswer(raw: string): ExtractedProfileUpdate | null {
  const lower = raw.toLowerCase();
  if (/\b(multiple|few|several).{0,20}\b(year|annually|per year)\b/.test(lower)) {
    return update('visit_frequency', 'multiple_times_per_year', 0.8, raw);
  }
  if (/\b(once|one time).{0,20}\b(year|annually|per year)\b/.test(lower)) {
    return update('visit_frequency', 'once_per_year', 0.8, raw);
  }
  if (/\bevery few years\b|\bevery couple years\b|\bevery other year\b/.test(lower)) {
    return update('visit_frequency', 'every_few_years', 0.8, raw);
  }
  if (/\brarely\b|\bnot often\b|\bhardly\b|\bnot much\b/.test(lower)) {
    return update('visit_frequency', 'rarely', 0.75, raw);
  }
  if (/\bnever\b/.test(lower)) {
    return update('visit_frequency', 'never', 0.9, raw);
  }
  if (
    /\blived there\b|\blived in tobago\b|\blived (in )?(castara|scarborough|buccoo|tobago)\b|\bgrew up there\b|\bgrew up in tobago\b|\bfrom small\b/.test(lower)
  ) {
    return update('visit_frequency', 'every_few_years', 0.55, raw);
  }
  return null;
}

function industryFromWork(raw: string): ExtractedProfileUpdate | null {
  const lower = raw.toLowerCase();
  const pairs: Array<[RegExp, string]> = [
    [/\b(software|developer|programmer|network|ai|data|it|cyber|technology|verizon|google|microsoft|amazon|aws)\b/, 'technology'],
    [/\b(nurse|doctor|health|hospital|clinic|medical|therapist|pharmacist|mount sinai)\b/, 'healthcare'],
    [/\b(teacher|professor|lecturer|school|education|university|college)\b/, 'education'],
    [/\b(bank|finance|accountant|trader|investor|wealth|insurance)\b/, 'finance_banking'],
    [/\b(founder|business|entrepreneur|shop|restaurant|deli|startup)\b/, 'business_entrepreneurship'],
    [/\b(government|public service|civil service|policy|ministry)\b/, 'government_public_service'],
    [/\b(artist|music|film|producer|writer|creative|designer|photographer)\b/, 'creative_industries'],
    [/\b(plumber|electrician|mechanic|carpenter|contractor|trade)\b/, 'skilled_trades'],
  ];
  const match = pairs.find(([re]) => re.test(lower));
  return match ? update('industry', match[1], 0.75, raw) : null;
}

export function deterministicCaptureFromTurn(params: {
  userMessage: string;
  lastAvaMessage: string | null;
  turnPlan: AvaTurnPlan;
}): ExtractionResult | null {
  const raw = params.userMessage;
  const last = params.lastAvaMessage?.toLowerCase() ?? '';
  const updates: ExtractedProfileUpdate[] = [];

  if (params.turnPlan.next_best_question_focus === 'their Tobago roots / generation') {
    updates.push(...normalizeLocation(raw));
  }

  if (params.turnPlan.next_best_question_focus === 'whether they lived in or visited Tobago, and how often they return') {
    const generation = generationFromShortAnswer(raw);
    if (generation) updates.push(generation);
  }

  if (params.turnPlan.next_best_question_focus === 'their work / what fills their days') {
    const visit = visitFrequencyFromAnswer(raw);
    if (visit) updates.push(visit);
  }

  if (/what kind of work|work are you in|what do you do|what fills your days/.test(last)) {
    updates.push(update('profession_text', clean(raw), 0.9, raw));
    const industry = industryFromWork(raw);
    if (industry) updates.push(industry);
  }

  if (updates.length === 0) return null;

  return {
    profile_updates: updates,
    entities: [],
    notes: [],
    raw_model_output: '[deterministic-capture]',
    model_info: { provider: 'system', modelId: 'deterministic-capture' },
    elapsed_ms: 0,
    parse_ok: true,
  };
}
