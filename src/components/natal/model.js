import { normalizeDegrees } from './geometry';

export const SIGNS = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
export const PLANETS = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];
export const ANGLES = ['AS', 'DS', 'MC', 'IC'];
export const ANGLE_LABELS = { AS: 'ASC', DS: 'DSC', MC: 'MC', IC: 'IC' };
export const ASPECT_TYPES = {
  '☌': { name: 'Соединение', angle: 0, family: 'conjunction', major: true },
  '⚹': { name: 'Секстиль', angle: 60, family: 'soft', major: true, dash: '3 4' },
  '□': { name: 'Квадрат', angle: 90, family: 'hard', major: true, dash: '8 3' },
  '△': { name: 'Трин', angle: 120, family: 'soft', major: true },
  '☍': { name: 'Оппозиция', angle: 180, family: 'hard', major: true },
  '⚻': { name: 'Квинконс', angle: 150, family: 'minor', dash: '2 5' },
  '∠': { name: 'Полуквадрат', angle: 45, family: 'minor', dash: '2 5' },
  '∠∠': { name: 'Полутороквадрат', angle: 135, family: 'minor', dash: '2 5' },
  'Q': { name: 'Квинтиль', angle: 72, family: 'minor', dash: '2 5' },
  'bQ': { name: 'Биквинтиль', angle: 144, family: 'minor', dash: '2 5' },
  'N': { name: 'Новиль', angle: 40, family: 'minor', dash: '2 5' },
  'S': { name: 'Септиль', angle: 51.43, family: 'minor', dash: '2 5' },
  '⚺': { name: 'Полусекстиль', angle: 30, family: 'minor', dash: '2 5' },
};
const canonicalAspect = type => ({ '✶': '⚹', '✱': '⚹', '⚼': '∠∠' }[type] || type);
const canonicalPoint = id => ({ ASC: 'AS', DSC: 'DS' }[id] || id);
const cleanName = name => String(name || '').replace(/\s*\(R\)$/i, '').trim().toLowerCase();
const pairKey = (a, b, type) => `${[a, b].sort().join('|')}|${type}`;

// This is longitude formatting, not an independent sign/position calculation.
export function longitudeText(value) {
  if (!Number.isFinite(value)) return 'Нет данных';
  const longitude = normalizeDegrees(value);
  const minutes = Math.floor((longitude % 30) * 60 + 1e-8);
  return `${SIGNS[Math.floor(longitude / 30)]} ${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}′`;
}

function readOrbs(structured, aliases) {
  const orbs = new Map();
  for (const line of Object.values(structured || {}).flat()) {
    if (typeof line !== 'string') continue;
    const match = line.match(/^\s*(\S+)\s+(.+?)\s+орбис:\s*(.+)\s*$/i);
    if (!match) continue;
    const type = canonicalAspect(match[1]);
    const config = ASPECT_TYPES[type];
    if (!config) continue;
    const separator = ` ${config.name.toLowerCase()} `;
    const names = match[2].toLowerCase().split(separator);
    if (names.length !== 2) continue;
    const from = aliases[cleanName(names[0])], to = aliases[cleanName(names[1])];
    if (!from || !to) continue;
    const key = pairKey(from, to, type);
    // Keep the backend's formatted value verbatim; no derived/recalculated orb.
    const orb = match[3].trim();
    if (orbs.has(key) && orbs.get(key) !== orb) orbs.set(key, null);
    else if (!orbs.has(key)) orbs.set(key, orb);
  }
  return orbs;
}

export function normalizeChart({ bodies = {}, aspects = [], houses = [], patterns = [], structuredAspects = {}, houseSystem, zodiacMode }) {
  const issues = [];
  const points = [];
  const byId = {};
  const aliases = {};
  for (const [key, body] of Object.entries(bodies || {})) {
    if (!body || !Number.isFinite(body.degree)) { issues.push(`Нет точной долготы: ${body?.label || key}`); continue; }
    const id = canonicalPoint(body.symbol || key);
    if (byId[id]) { issues.push(`Повторяющаяся точка: ${id}`); continue; }
    const point = { id, longitude: body.degree, name: body.label || ANGLE_LABELS[id] || id,
      sign: body.sign || null, house: body.house ?? null, retrograde: body.retrograde === true,
      kind: ANGLES.includes(id) ? 'angle' : PLANETS.includes(id) ? 'planet' : id === '☊' ? 'node' : id === '⚷' ? 'chiron' : 'extra' };
    points.push(point); byId[id] = point;
    for (const name of [key, id, body.label]) if (name) aliases[cleanName(name)] = id;
  }
  const cusps = (houses || []).map((house, index) => ({ id: `house-${index + 1}`, number: index + 1, longitude: house?.degree }));
  const validCusps = cusps.length === 12 && cusps.every(cusp => Number.isFinite(cusp.longitude)) && new Set(cusps.map(c => normalizeDegrees(c.longitude))).size === 12;
  if (!validCusps) issues.push('Для круга нужны 12 различных точных куспидов из API.');
  for (const id of ANGLES) if (!byId[id]) issues.push(`API не передал точную долготу ${ANGLE_LABELS[id]}.`);
  const orbs = readOrbs(structuredAspects, aliases);
  const renderAspects = (aspects || []).map((aspect, index) => {
    const fromRaw = aspect.from_body || aspect.from, toRaw = aspect.to_body || aspect.to;
    const from = aliases[cleanName(fromRaw)] || canonicalPoint(fromRaw), to = aliases[cleanName(toRaw)] || canonicalPoint(toRaw);
    const type = canonicalAspect(aspect.aspect);
    const config = ASPECT_TYPES[type] || { name: type || 'Аспект', family: 'minor', dash: '2 5' };
    return { id: `aspect-${index}`, from, to, type, ...config, orb: orbs.get(pairKey(from, to, type)) || null,
      drawable: Boolean(byId[from] && byId[to]) };
  });
  for (const aspect of renderAspects) if (!aspect.drawable) issues.push(`Аспект ${aspect.from} ${aspect.type} ${aspect.to}: нет долготы участника.`);
  const renderPatterns = (patterns || []).map((pattern, index) => {
    const members = [...new Set((pattern.bodies || []).map(body => aliases[cleanName(body.symbol)] || aliases[cleanName(body.label)]).filter(Boolean))];
    return { id: `pattern-${index}`, name: pattern.type, members, sourceBodies: pattern.bodies || [],
      stellium: /стеллиум|stellium/i.test(pattern.type),
      aspects: renderAspects.filter(aspect => members.includes(aspect.from) && members.includes(aspect.to)).map(aspect => aspect.id) };
  });
  return { points, byId, cusps, aspects: renderAspects, patterns: renderPatterns, issues,
    ready: validCusps && ANGLES.every(id => byId[id]), asc: byId.AS?.longitude,
    houseSystem: houseSystem || null, zodiacMode: zodiacMode || null };
}
