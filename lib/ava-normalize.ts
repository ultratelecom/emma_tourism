/**
 * Canonical-form normalization for captured field values.
 *
 * The capture model can return "Yes", "skilled trades", "7" — values that are
 * semantically right but don't match the strict enum/scale shapes the schema
 * defines. We snap them to canonical form here, BEFORE persistence, so that
 * downstream code (pickers, admin views, exports) can do equality against
 * `spec.options` and trust the result.
 *
 * Returns `null` when the value can't be confidently coerced — the caller
 * should drop the update rather than persist garbage.
 */

import type { AvaProfileFieldSpec } from './ava-config';

const YES_NO_MAYBE_ALIASES: Record<string, 'yes' | 'no' | 'maybe'> = {
  yes: 'yes', y: 'yes', yeah: 'yes', yep: 'yes', yup: 'yes', sure: 'yes',
  absolutely: 'yes', definitely: 'yes', 'for sure': 'yes',
  'hundred percent': 'yes', '100%': 'yes', certainly: 'yes',
  no: 'no', n: 'no', nope: 'no', nah: 'no', 'no thanks': 'no',
  'not really': 'no', "i'm not": 'no', "not my thing": 'no',
  maybe: 'maybe', perhaps: 'maybe', possibly: 'maybe',
  'thinking about it': 'maybe', 'thought about it': 'maybe',
  'would consider': 'maybe', 'could be': 'maybe',
};

const INDUSTRY_ALIASES: Record<string, string> = {
  'finance banking': 'finance_banking',
  finance: 'finance_banking',
  banking: 'finance_banking',
  fintech: 'finance_banking',
  healthcare: 'healthcare',
  'health care': 'healthcare',
  health: 'healthcare',
  medical: 'healthcare',
  technology: 'technology',
  tech: 'technology',
  software: 'technology',
  engineering: 'technology',
  it: 'technology',
  education: 'education',
  teaching: 'education',
  academia: 'education',
  business: 'business_entrepreneurship',
  entrepreneurship: 'business_entrepreneurship',
  'business entrepreneurship': 'business_entrepreneurship',
  startup: 'business_entrepreneurship',
  government: 'government_public_service',
  'public service': 'government_public_service',
  'government public service': 'government_public_service',
  creative: 'creative_industries',
  'creative industries': 'creative_industries',
  arts: 'creative_industries',
  media: 'creative_industries',
  trades: 'skilled_trades',
  'skilled trades': 'skilled_trades',
  trade: 'skilled_trades',
  construction: 'skilled_trades',
};

const VISIT_FREQ_ALIASES: Record<string, string> = {
  'multiple times per year': 'multiple_times_per_year',
  'several times a year': 'multiple_times_per_year',
  'few times a year': 'multiple_times_per_year',
  'a few times a year': 'multiple_times_per_year',
  'twice a year': 'multiple_times_per_year',
  'once per year': 'once_per_year',
  'once a year': 'once_per_year',
  yearly: 'once_per_year',
  annually: 'once_per_year',
  'every few years': 'every_few_years',
  occasionally: 'every_few_years',
  rarely: 'rarely',
  'almost never': 'rarely',
  'been too long': 'rarely',
  'not in years': 'rarely',
  never: 'never',
  'never been back': 'never',
};

const CONTRIBUTION_ALIASES: Record<string, string> = {
  investment: 'investment', investing: 'investment', invest: 'investment',
  mentorship: 'mentorship_coaching', coaching: 'mentorship_coaching',
  'mentorship coaching': 'mentorship_coaching', mentoring: 'mentorship_coaching',
  advisory: 'advisory', advice: 'advisory',
  'knowledge sharing teaching': 'knowledge_sharing_teaching',
  'knowledge sharing': 'knowledge_sharing_teaching',
  knowledge: 'knowledge_sharing_teaching', teaching: 'knowledge_sharing_teaching',
  'business partnerships': 'business_partnerships',
  partnerships: 'business_partnerships',
  philanthropy: 'philanthropy', charity: 'philanthropy', giving: 'philanthropy',
  'tourism promotion': 'tourism_promotion', tourism: 'tourism_promotion',
  'return migration': 'return_migration', returning: 'return_migration',
};

const BARRIERS_ALIASES: Record<string, string> = {
  'lack of information': 'lack_of_information', information: 'lack_of_information',
  'lack of trust': 'lack_of_trust_transparency',
  'lack of trust transparency': 'lack_of_trust_transparency',
  trust: 'lack_of_trust_transparency',
  transparency: 'lack_of_trust_transparency',
  'limited opportunities': 'limited_investment_opportunities',
  'limited investment opportunities': 'limited_investment_opportunities',
  opportunities: 'limited_investment_opportunities',
  bureaucracy: 'bureaucracy', 'red tape': 'bureaucracy',
  'distance logistics': 'distance_logistics',
  distance: 'distance_logistics',
  logistics: 'distance_logistics',
  'time constraints': 'time_constraints',
  time: 'time_constraints',
  'lack of structured programs': 'lack_of_structured_programs',
  programs: 'lack_of_structured_programs',
};

const FEATURE_PRIORITIES_ALIASES: Record<string, string> = {
  'investment dashboard': 'investment_dashboard',
  dashboard: 'investment_dashboard',
  networking: 'networking', network: 'networking',
  'job opportunities': 'job_business_opportunities',
  'job business opportunities': 'job_business_opportunities',
  jobs: 'job_business_opportunities',
  'government updates': 'government_updates',
  'mentorship programs': 'mentorship_programs',
  mentorship: 'mentorship_programs',
  'event notifications': 'event_notifications',
  events: 'event_notifications',
  'data privacy security': 'data_privacy_security',
  'data privacy': 'data_privacy_security',
  privacy: 'data_privacy_security',
  security: 'data_privacy_security',
};

const FUTURE_ROLES_ALIASES: Record<string, string> = {
  'diaspora advisory group': 'diaspora_advisory_group',
  advisory: 'diaspora_advisory_group',
  'advisory group': 'diaspora_advisory_group',
  'future surveys': 'future_surveys',
  surveys: 'future_surveys',
  'virtual meetings': 'virtual_meetings',
  meetings: 'virtual_meetings',
  'investment opportunities': 'investment_opportunities',
  investments: 'investment_opportunities',
  'pilot programs': 'pilot_programs',
  pilots: 'pilot_programs',
};

const INVEST_SECTORS_ALIASES: Record<string, string> = {
  tourism: 'tourism', tourist: 'tourism', hotels: 'tourism',
  airbnb: 'real_estate', 'real estate': 'real_estate',
  property: 'real_estate', land: 'real_estate',
  agriculture: 'agriculture', farm: 'agriculture', farming: 'agriculture',
  agritech: 'agriculture',
  'renewable energy': 'renewable_energy', solar: 'renewable_energy',
  renewable: 'renewable_energy', energy: 'renewable_energy',
  'small business': 'small_business', sme: 'small_business',
};

const GENERATION_ALIASES: Record<string, string> = {
  '1st': '1st', 'first': '1st', '1': '1st', born: '1st',
  '2nd': '2nd', 'second': '2nd', '2': '2nd',
  '3rd': '3rd', 'third': '3rd', '3': '3rd',
  '4th+': '4th+', '4th': '4th+', 'fourth': '4th+', '4': '4th+',
};

const AGE_BRACKET_ALIASES: Record<string, string> = {
  '18-24': '18-24', 'teens': '18-24', '20s': '25-34',
  '25-34': '25-34', '30s': '35-44',
  '35-44': '35-44', '40s': '45-54',
  '45-54': '45-54', '50s': '55-64',
  '55-64': '55-64', '60s': '65+',
  '65+': '65+', 'retired': '65+',
};

const EDUCATION_ALIASES: Record<string, string> = {
  secondary: 'secondary', 'high school': 'secondary', 'highschool': 'secondary',
  diploma: 'diploma', associate: 'diploma',
  bachelors: 'bachelors', "bachelor's": 'bachelors', ba: 'bachelors',
  bsc: 'bachelors', bs: 'bachelors', undergraduate: 'bachelors', university: 'bachelors',
  masters: 'masters', "master's": 'masters', mba: 'masters', ma: 'masters',
  msc: 'masters', ms: 'masters',
  doctorate: 'doctorate', phd: 'doctorate', 'ph.d': 'doctorate', md: 'doctorate',
};

const GENDER_ALIASES: Record<string, string> = {
  male: 'male', man: 'male', he: 'male', him: 'male',
  female: 'female', woman: 'female', she: 'female', her: 'female',
  other: 'other', 'non-binary': 'other', nonbinary: 'other', they: 'other', them: 'other',
  'prefer not to say': 'prefer_not_to_say',
};

const ALIAS_BY_FIELD: Record<string, Record<string, string>> = {
  industry: INDUSTRY_ALIASES,
  visit_frequency: VISIT_FREQ_ALIASES,
  contribution_modes: CONTRIBUTION_ALIASES,
  barriers: BARRIERS_ALIASES,
  feature_priorities: FEATURE_PRIORITIES_ALIASES,
  future_roles: FUTURE_ROLES_ALIASES,
  invest_sectors: INVEST_SECTORS_ALIASES,
  generation: GENERATION_ALIASES,
  age_bracket: AGE_BRACKET_ALIASES,
  education_level: EDUCATION_ALIASES,
  gender: GENDER_ALIASES,
};

function canonicalEnumItem(fieldKey: string, raw: unknown, options: string[]): string | null {
  const s = String(raw).trim().toLowerCase().replace(/[\s/]+/g, ' ');
  // Direct option match (with underscore tolerance).
  const optSet = new Set(options.map((o) => o.toLowerCase()));
  if (optSet.has(s)) return options.find((o) => o.toLowerCase() === s) ?? null;
  const underscored = s.replace(/\s+/g, '_');
  if (optSet.has(underscored)) {
    return options.find((o) => o.toLowerCase() === underscored) ?? null;
  }
  // Alias map for the field.
  const aliases = ALIAS_BY_FIELD[fieldKey];
  if (aliases) {
    if (aliases[s]) return aliases[s];
    // Try contains-match: e.g. "skilled trades work" -> "skilled_trades"
    for (const [key, val] of Object.entries(aliases)) {
      if (s.includes(key)) return val;
    }
  }
  return null;
}

/**
 * Normalize a value the capture model returned for a field. Returns the
 * canonical value to persist, or `null` to drop the update.
 */
export function normalizeCapturedValue(
  spec: AvaProfileFieldSpec,
  raw: unknown,
): string | string[] | number | null {
  if (raw === null || raw === undefined || raw === '') return null;

  switch (spec.type) {
    case 'text': {
      const s = String(raw).trim();
      return s.length > 0 && s.length <= 500 ? s : null;
    }

    case 'scale_1_5': {
      const n =
        typeof raw === 'number' ? raw : parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
      if (!Number.isFinite(n)) return null;
      const clamped = Math.max(1, Math.min(5, Math.round(n)));
      return clamped;
    }

    case 'yes_no_maybe': {
      const s = String(raw).trim().toLowerCase();
      if (s === 'yes' || s === 'no' || s === 'maybe') return s;
      const alias = YES_NO_MAYBE_ALIASES[s];
      if (alias) return alias;
      for (const [k, v] of Object.entries(YES_NO_MAYBE_ALIASES)) {
        if (s.includes(k)) return v;
      }
      return null;
    }

    case 'enum': {
      if (!spec.options) return null;
      return canonicalEnumItem(spec.key, raw, spec.options);
    }

    case 'enum_multi': {
      if (!spec.options) return null;
      const items = Array.isArray(raw) ? raw : [raw];
      const out: string[] = [];
      for (const item of items) {
        const canon = canonicalEnumItem(spec.key, item, spec.options);
        if (canon && !out.includes(canon)) out.push(canon);
      }
      return out.length > 0 ? out : null;
    }

    default:
      return null;
  }
}
