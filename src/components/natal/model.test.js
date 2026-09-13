import api from './fixtures/api-placidus.json';
import { normalizeChart, longitudeText, PLANETS } from './model';
const input = () => ({ bodies: api.bodies_for_circle, houses: api.houses, aspects: api.aspects_for_circle, structuredAspects: api.aspects_structured, patterns: api.patterns_data, houseSystem: api.house_system });

test('API model keeps longitudes, assignments, retrograde and all source aspects unchanged', () => {
  const model = normalizeChart(input());
  expect(model.ready).toBe(true);
  for (const point of model.points) {
    expect(point.longitude).toBe(api.bodies_for_circle[point.id].degree);
    expect(point.house).toBe(api.bodies_for_circle[point.id].house);
    expect(point.retrograde).toBe(api.bodies_for_circle[point.id].retrograde);
  }
  expect(model.aspects).toHaveLength(api.aspects_for_circle.length);
  expect(model.houseSystem).toBe('Placidus');
  expect(model.zodiacMode).toBeNull();
});
test('existing textual orbs are matched by unordered pair and type, without new arithmetic', () => {
  const model = normalizeChart(input());
  const sunMercury = model.aspects.find(a => a.from === '☉' && a.to === '☿' && a.type === '☌');
  expect(sunMercury.orb).toBe("7° 56'");
  expect(model.aspects.every(a => a.orb !== null)).toBe(true);
  const changed = input(); changed.aspects = [{ from_body: '☿', to_body: '☉', aspect: '☌' }];
  expect(normalizeChart(changed).aspects[0].orb).toBe("7° 56'");
});
test('absent orb or unknown source point stays explicit; no invented position or aspect', () => {
  const changed = input(); changed.structuredAspects = null;
  changed.aspects = [{ from_body: '☉', to_body: 'unknown', aspect: '☌' }];
  const model = normalizeChart(changed);
  expect(model.aspects[0]).toMatchObject({ orb: null, drawable: false });
  expect(model.byId.unknown).toBeUndefined();
  expect(model.issues.length).toBeGreaterThan(0);
});
test('missing optional points, patterns and asteroids still leave a valid chart', () => {
  const changed = input(); changed.patterns = undefined;
  changed.bodies = Object.fromEntries(Object.entries(changed.bodies).filter(([id]) => [...PLANETS, 'AS', 'DS', 'MC', 'IC'].includes(id)));
  const model = normalizeChart(changed);
  expect(model.ready).toBe(true); expect(model.patterns).toEqual([]);
  expect(model.points.some(p => p.kind === 'extra')).toBe(false);
});
test('missing required ASC or corrupt cusps fail closed without a zero-longitude fallback', () => {
  const changed = input(); changed.bodies = { ...changed.bodies }; delete changed.bodies.AS;
  expect(normalizeChart(changed).ready).toBe(false);
  expect(normalizeChart(changed).asc).toBeUndefined();
  changed.houses = api.houses.slice(0, 11);
  expect(normalizeChart(changed).ready).toBe(false);
});
test('pattern focus resolves supplied members and uses only supplied aspect relationships', () => {
  const changed = input(); changed.patterns = [{ type: 'Стеллиум (synthetic focus fixture)', bodies: [{ symbol: '☉' }, { label: 'Меркурий' }, { symbol: '☽' }] }];
  const model = normalizeChart(changed), pattern = model.patterns[0];
  expect(pattern.members).toEqual(['☉', '☿', '☽']);
  expect(pattern.stellium).toBe(true);
  for (const id of pattern.aspects) {
    const aspect = model.aspects.find(a => a.id === id);
    expect(pattern.members).toContain(aspect.from); expect(pattern.members).toContain(aspect.to);
  }
});
test('longitude presentation formats minutes with wrap, without changing the stored value', () => {
  expect(longitudeText(0)).toBe('Овен 0°00′');
  expect(longitudeText(359.999)).toBe('Рыбы 29°59′');
  expect(longitudeText(361)).toBe('Овен 1°00′');
});
