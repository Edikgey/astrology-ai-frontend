import fixture from './fixtures/relationship.json';
import { normalizeSynastry, orbText } from './model';
import { layoutSynastry, pointAt, TRACKS } from './geometry';

const copy = () => JSON.parse(JSON.stringify(fixture.calculation));

test('both participants retain all ten stored full-precision longitudes', () => {
  const model = normalizeSynastry(copy());
  for (const person of ['A', 'B']) {
    expect(model.points.filter(point => point.person === person)).toHaveLength(10);
    for (const point of model.points.filter(point => point.person === person)) {
      expect(point.longitude).toBe(fixture.calculation.inputs[person].positions[point.body]);
    }
  }
  expect(model.byId['A:☉'].id).not.toBe(model.byId['B:☉'].id);
  expect(model.reference).toBe(fixture.calculation.inputs.A.angles.AS);
  expect(pointAt(model.reference, model.reference, 100)).toEqual({ x: 260, y: 360 });
});

test('only saved inter-chart planet aspects are shown; no inferred or natal aspects', () => {
  const data = copy();
  data.aspects = [
    { participant_a: 'A', body_a: '☉', participant_b: 'B', body_b: '☽', aspect: '△', orb_deg: 1.783333 },
    { participant_a: 'A', body_a: '☉', participant_b: 'A', body_b: '☽', aspect: '☌', orb_deg: 0 },
    { participant_a: 'B', body_a: '☉', participant_b: 'B', body_b: '☽', aspect: '☌', orb_deg: 0 },
    { participant_a: 'A', body_a: '☉', participant_b: 'B', body_b: 'AS', aspect: '△', orb_deg: 2 },
    null,
  ];
  const model = normalizeSynastry(data), layout = layoutSynastry(model);
  expect(model.aspects).toHaveLength(1);
  // Even an intentionally inconsistent fixture classification is preserved, never recalculated.
  expect(model.aspects[0]).toMatchObject({ from: 'A:☉', to: 'B:☽', type: '△', orb: 1.783333 });
  expect(layout.aspects[0].start).toEqual(pointAt(model.byId['A:☉'].longitude, model.reference, TRACKS.A.aspect));
  expect(layout.aspects[0].end).toEqual(pointAt(model.byId['B:☽'].longitude, model.reference, TRACKS.B.aspect));
  expect(orbText(model.aspects[0].orb)).toBe('1°47′');
  data.aspects = [];
  expect(normalizeSynastry(data).aspects).toEqual([]);
});

test('reverse B-to-A endpoints keep participant identity', () => {
  const data = copy();
  data.aspects = [{ participant_a: 'B', body_a: '♀', participant_b: 'A', body_b: '♀', aspect: '☍', orb_deg: 2 }];
  expect(normalizeSynastry(data).aspects[0]).toMatchObject({ from: 'B:♀', to: 'A:♀', orb: 2 });
});

test.each([null, [], Array(12).fill(0), [0, 330, 300, 270, 240, 210, 180, 150, 120, 90, 60, 30]])('invalid A cusps degrade without using B houses: %j', cusps => {
  const data = copy(); data.inputs.A.cusps = cusps;
  const model = normalizeSynastry(data);
  expect(model.cusps).toBeNull();
  expect(model.points).toHaveLength(20);
  expect(model.aspects.length).toBeGreaterThan(0);
});

test('missing angles are not reconstructed from cusps; zero Aries is explicit fallback', () => {
  const data = copy(); data.inputs.A.angles = {}; data.angle_availability.A = { AS: false, MC: false };
  const model = normalizeSynastry(data);
  expect(model.reference).toBe(0); expect(model.angles).toEqual({}); expect(model.cusps).toBeNull();
});

test('invalid angles and unsupported house system are never displayed', () => {
  const data = copy(); data.inputs.A.angles = { AS: '80', MC: 360 };
  expect(normalizeSynastry(data).angles).toEqual({});
  data.inputs.A.angles = { AS: 80, MC: 280 }; data.inputs.A.house_system = 'unknown';
  expect(normalizeSynastry(data).cusps).toBeNull();
});

test('house overlays come only from unambiguous saved placements', () => {
  const data = copy(); data.house_overlays = [];
  expect(normalizeSynastry(data).overlays).toEqual({});
  data.house_overlays = [{ planet_participant: 'B', house_participant: 'A', available: true, placements: [{ body: '♀', house: 7 }] }];
  expect(normalizeSynastry(data).overlays).toEqual({ 'B:♀': { person: 'A', house: 7 } });
  data.house_overlays[0].available = false;
  expect(normalizeSynastry(data).overlays).toEqual({});
});

test('all-same-longitude and wraparound dense tracks remain deterministic and bounded', () => {
  for (const clustered of [false, true]) {
    const data = copy();
    for (const person of ['A', 'B']) Object.keys(data.inputs[person].positions).forEach((body, index) => {
      data.inputs[person].positions[body] = clustered ? 359.999999 : (359 + index * .25) % 360;
    });
    const before = JSON.stringify(data), model = normalizeSynastry(data), layout = layoutSynastry(model);
    expect(layoutSynastry(model)).toEqual(layout);
    expect(layout.anchors).toHaveLength(20);
    expect(layout.labels.flatMap(label => label.members).sort()).toEqual(model.points.map(point => point.id).sort());
    expect(layout.labels.some(label => label.members.length > 1)).toBe(true);
    for (const anchor of layout.anchors) {
      expect({ x: anchor.x, y: anchor.y }).toEqual(pointAt(anchor.longitude, model.reference, TRACKS[anchor.person].anchor));
    }
    for (const label of layout.labels) {
      expect(Math.abs(((label.displayLongitude - model.byId[label.id].longitude + 540) % 360) - 180)).toBeLessThanOrEqual(18.000001);
      expect(label.x - 33).toBeGreaterThan(0); expect(label.x + 33).toBeLessThan(720);
      expect(label.y - 33).toBeGreaterThan(0); expect(label.y + 33).toBeLessThan(720);
      for (const other of layout.labels.filter(item => item !== label)) expect(Math.hypot(label.x - other.x, label.y - other.y)).toBeGreaterThanOrEqual(67.99999);
    }
    expect(JSON.stringify(data)).toBe(before);
  }
});

test('unknown snapshot and missing positions fail gracefully without fabricating planets', () => {
  expect(normalizeSynastry(null)).toBeNull();
  expect(normalizeSynastry({ ...copy(), schema_version: 2 })).toBeNull();
  const data = copy(); delete data.inputs.B.positions['☉'];
  const model = normalizeSynastry(data);
  expect(model.incomplete).toBe(true); expect(model.byId['B:☉']).toBeUndefined();
});
