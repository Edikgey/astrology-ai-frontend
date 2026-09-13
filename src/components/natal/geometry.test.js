import apiFixture from './fixtures/api-placidus.json';
import { normalizeChart } from './model';
import { normalizeDegrees, longitudeToScreenAngle, polarToCartesian, project, buildHouseSectors, buildPlanetAnchors, layoutPlanetLabels, buildAspectEndpoints } from './geometry';

export const fixtureModel = () => normalizeChart({ bodies: apiFixture.bodies_for_circle, aspects: apiFixture.aspects_for_circle, houses: apiFixture.houses, structuredAspects: apiFixture.aspects_structured, patterns: apiFixture.patterns_data, houseSystem: apiFixture.house_system });
const near = (point, x, y) => { expect(point.x).toBeCloseTo(x, 6); expect(point.y).toBeCloseTo(y, 6); };

test.each([[-1, 359], [361, 1], [720, 0], [-721, 359]])('normalizes %s to %s', (input, expected) => expect(normalizeDegrees(input)).toBe(expected));
test('ASC is left, DSC opposite, and ASC+90 is below using one transform', () => {
  near(polarToCartesian(longitudeToScreenAngle(100, 100), 200), 100, 300);
  near(project(280, 100, 200), 500, 300);
  near(project(190, 100, 200), 300, 500);
});
test('359/0 wrap stays continuous', () => {
  expect(longitudeToScreenAngle(0, 359)).toBe(179);
  expect(Math.hypot(project(359, 100, 200).x - project(0, 100, 200).x, project(359, 100, 200).y - project(0, 100, 200).y)).toBeLessThan(3.5);
});

// Independent fixed expectations captured with the backend fixture, not computed
// by the projection under test. Units are SVG coordinates at r=200, cx=cy=300.
test.each([
  ['☉', 201.066775675832, 486.6324261387661, 228.1088495462896],
  ['☽', 155.1859227350397, 481.53487880264123, 383.93502116584204],
  ['MC', 236.16553313581716, 411.3590804102466, 133.8700652796606],
])('real adapter fixture: %s longitude -> delta -> pixel', (id, delta, x, y) => {
  const model = fixtureModel();
  expect(normalizeDegrees(model.byId[id].longitude - model.asc)).toBeCloseTo(delta, 8);
  near(project(model.byId[id].longitude, model.asc, 200), x, y);
});
test('MC is not forced to the top and IC stays opposite by its own API longitude', () => {
  const model = fixtureModel();
  const mc = project(model.byId.MC.longitude, model.asc, 200), ic = project(model.byId.IC.longitude, model.asc, 200);
  expect(mc.x).not.toBeCloseTo(300, 1);
  near({ x: (mc.x + ic.x) / 2, y: (mc.y + ic.y) / 2 }, 300, 300);
});
test('all twelve unequal Placidus sectors keep each exact API cusp, including closing wrap', () => {
  const model = fixtureModel(), sectors = buildHouseSectors(model.cusps, model.asc, 200);
  expect(sectors).toHaveLength(12);
  expect(new Set(sectors.map(h => h.span.toFixed(3))).size).toBeGreaterThan(1);
  expect(sectors.reduce((sum, h) => sum + h.span, 0)).toBeCloseTo(360, 7);
  sectors.forEach((sector, index) => { expect(sector.longitude).toBe(apiFixture.houses[index].degree); expect(sector.start).toEqual(project(apiFixture.houses[index].degree, model.asc, 200)); });
  near(sectors[0].start, 100, 300);
  near(sectors[1].start, 110.10143512173445, 362.75774898110325);
  near(sectors[2].start, 137.5240116990928, 416.6256971067846);
});

test.each([false, true])('dense wrapped cluster uses finite non-overlapping deterministic labels, compact=%s', compact => {
  const points = Array.from({ length: 40 }, (_, i) => ({ id: `point-${i}`, longitude: normalizeDegrees(359 + i * .04) }));
  const anchors = buildPlanetAnchors(points, 100), original = JSON.stringify(anchors);
  const layout = layoutPlanetLabels(anchors, 100, { compact, degrees: true });
  expect(layoutPlanetLabels([...anchors].reverse(), 100, { compact, degrees: true })).toEqual(layout);
  expect(JSON.stringify(anchors)).toBe(original);
  expect(layout.flatMap(label => label.members).sort()).toEqual(points.map(p => p.id).sort());
  expect(layout.some(label => label.members.length > 1)).toBe(true);
  for (const [i, label] of layout.entries()) {
    expect(label.lane).toBeLessThan(3);
    for (const value of [label.x, label.y, label.displayLongitude]) expect(Number.isFinite(value)).toBe(true);
    for (const other of layout.slice(i + 1)) {
      const a = label.bounds, b = other.bounds;
      expect(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom).toBe(true);
    }
  }
});
test('aspect endpoints and exact ticks ignore displaced display labels and stay stable across viewport layouts', () => {
  const points = [{ id: 'a', longitude: 359 }, { id: 'b', longitude: .3 }, { id: 'c', longitude: .5 }];
  const byId = Object.fromEntries(points.map(p => [p.id, p]));
  const anchors = buildPlanetAnchors(points, 100);
  const before = buildAspectEndpoints([{ id: 'ab', from: 'a', to: 'b' }], byId, 100, 200);
  const labels = layoutPlanetLabels(anchors, 100, { compact: true });
  expect(labels.some(label => label.displayLongitude !== byId[label.id].longitude || label.lane > 0)).toBe(true);
  expect(buildAspectEndpoints([{ id: 'ab', from: 'a', to: 'b' }], byId, 100, 200)).toEqual(before);
  near(before[0].start, project(359, 100, 200).x, project(359, 100, 200).y);
  near(before[0].end, project(.3, 100, 200).x, project(.3, 100, 200).y);
});
