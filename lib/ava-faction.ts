/**
 * Faction points: longer, more substantive user replies earn more.
 * Used only on the Ava client; backend unchanged.
 */
export function computeFactionPointsForMessage(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const base = 12;
  const perChar = 1.35;
  const wordBonus = (t.split(/\s+/).filter(Boolean).length - 1) * 3;
  const raw = base + Math.floor(t.length * perChar) + Math.max(0, wordBonus);
  return Math.min(420, raw);
}
