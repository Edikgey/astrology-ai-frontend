export const FOLLOW_UP_LABELS = {
  deepen: 'Разобрать глубже',
  personalize: 'Применить к ситуации',
  explore: 'Исследовать дальше',
};

// Response-only data. Legacy strings are accepted during the frontend-first rollout;
// never infer a semantic type from an old question's position.
export function normalizeFollowUps(candidates) {
  if (!Array.isArray(candidates) || candidates.length < 3 || candidates.length > 4) return [];
  const legacy = candidates.every(item => typeof item === 'string');
  const types = Object.keys(FOLLOW_UP_LABELS);
  if (!legacy && (candidates.length !== 3 || !candidates.every(item =>
    item && typeof item === 'object' && types.includes(item.type)))) return [];
  const suggestions = candidates.map(item => legacy ? { type: null, text: item } : item);
  if (suggestions.some(item => typeof item.text !== 'string' || !item.text.trim() ||
    [...item.text].length > 100 || /[\r\n]/.test(item.text))) return [];
  const normalized = suggestions.map(({ type, text }) => ({ type, text: text.trim() }));
  if (new Set(normalized.map(item => item.text.toLowerCase().replace(/[?!.,\s]+$/u, ''))).size !== normalized.length) return [];
  if (legacy) return normalized;
  if (new Set(normalized.map(item => item.type)).size !== 3) return [];
  return types.map(type => normalized.find(item => item.type === type));
}
