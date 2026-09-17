// Saved snapshot projection only: no aspect detection or house assignment.
import { PLANETS, ASPECT_TYPES } from '../natal/model';
import { normalizeDegrees } from '../natal/geometry';

export const PLANET_NAMES = { '☉': 'Солнце', '☽': 'Луна', '☿': 'Меркурий', '♀': 'Венера', '♂': 'Марс',
  '♃': 'Юпитер', '♄': 'Сатурн', '♅': 'Уран', '♆': 'Нептун', '♇': 'Плутон' };
const longitudeValid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360;
const rows = value => Array.isArray(value) ? value : [];

function validCusps(input) {
  const cusps = input?.cusps;
  if (input?.house_system !== 'Placidus' || !Array.isArray(cusps) || cusps.length !== 12 || !cusps.every(longitudeValid)) return null;
  const spans = cusps.map((cusp, index) => normalizeDegrees(cusps[(index + 1) % 12] - cusp));
  return spans.every(span => span > 1e-10) && Math.abs(spans.reduce((a, b) => a + b, 0) - 360) < 1e-8 ? cusps : null;
}

export function normalizeSynastry(snapshot) {
  if (snapshot?.schema_version !== 1 || snapshot?.ruleset_version !== 'synastry-major-8-v1') return null;
  const points = [], byId = {};
  for (const person of ['A', 'B']) {
    for (const body of PLANETS) {
      const longitude = snapshot.inputs?.[person]?.positions?.[body];
      if (!longitudeValid(longitude)) continue;
      const point = { id: `${person}:${body}`, person, body, name: PLANET_NAMES[body], longitude };
      points.push(point); byId[point.id] = point;
    }
  }
  const angles = {};
  for (const body of ['AS', 'MC']) {
    const longitude = snapshot.inputs?.A?.angles?.[body];
    if (longitudeValid(longitude) && snapshot.angle_availability?.A?.[body] !== false) angles[body] = longitude;
  }
  // Only A's houses define the frame. Never substitute B's cusps or derive ASC/MC.
  const reference = angles.AS ?? 0;
  const cusps = angles.AS !== undefined ? validCusps(snapshot.inputs?.A) : null;
  const seen = new Set();
  const aspects = rows(snapshot.aspects).flatMap(row => {
    if (!row || !['A', 'B'].includes(row.participant_a) || !['A', 'B'].includes(row.participant_b) || row.participant_a === row.participant_b) return [];
    const from = `${row.participant_a}:${row.body_a}`, to = `${row.participant_b}:${row.body_b}`;
    const config = ASPECT_TYPES[row.aspect];
    // V1 central field is planet-to-planet only. Saved angle aspects remain in page reference details.
    if (!byId[from] || !byId[to] || !config?.major || !Number.isFinite(row.orb_deg) || row.orb_deg < 0) return [];
    const id = `${[from, to].sort().join('|')}|${row.aspect}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, from, to, type: row.aspect, name: config.name, family: config.family, dash: config.dash, orb: row.orb_deg }];
  });
  const overlays = {};
  for (const point of points) {
    const other = point.person === 'A' ? 'B' : 'A';
    const matches = rows(snapshot.house_overlays).filter(row => row?.planet_participant === point.person && row.house_participant === other && row.available === true);
    if (matches.length !== 1) continue;
    const placements = rows(matches[0].placements).filter(row => row?.body === point.body);
    const house = placements[0]?.house;
    if (placements.length === 1 && Number.isInteger(house) && house >= 1 && house <= 12) overlays[point.id] = { person: other, house };
  }
  return { points, byId, reference, angles, cusps, aspects, overlays, incomplete: points.length !== 20 };
}

export function orbText(orb) {
  const minutes = Math.round(orb * 60);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}′`;
}
