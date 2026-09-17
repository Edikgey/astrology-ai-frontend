import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import SynastryChart from './SynastryChart';
import fixture from './fixtures/relationship.json';
import { normalizeSynastry } from './model';
import { longitudeText } from '../natal/model';

let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (relationship = fixture) => act(async () => root.render(<SynastryChart relationship={relationship} />));
const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));

test('two distinct tracks, twenty exact anchors and stored A cusp geometry render', async () => {
  await render();
  expect(container.querySelectorAll('[data-synastry-anchor]')).toHaveLength(20);
  expect(container.querySelectorAll('[data-synastry-sign]')).toHaveLength(12);
  expect(container.querySelectorAll('[data-synastry-cusp]')).toHaveLength(12);
  expect(container.querySelectorAll('[data-synastry-angle]')).toHaveLength(2);
  expect(container.querySelector('[data-synastry-anchor="A:☉"]').classList).toContain('person-A');
  expect(container.querySelector('[data-synastry-anchor="B:☉"]').classList).toContain('person-B');
  expect(container.querySelector('.synastry-legend').textContent).toContain('залитые маркеры');
  expect(container.querySelector('.synastry-legend').textContent).toContain('контурные маркеры');
  expect(container.querySelector('.synastry-detail').textContent).toContain('Нажмите на планету');
});

test.each(['A', 'B'])('%s planet selection shows correct person, saved longitude and exact anchor', async person => {
  await render();
  const marker = [...container.querySelectorAll(`.synastry-planet.person-${person}`)].find(el => !el.dataset.members.includes(','));
  const id = marker.dataset.members, point = normalizeSynastry(fixture.calculation).byId[id];
  await click(marker);
  const detail = container.querySelector('.synastry-detail').textContent;
  expect(detail).toContain(fixture[`person_${person.toLowerCase()}_label`]);
  expect(detail).toContain(point.name); expect(detail).toContain(longitudeText(point.longitude));
  expect(container.querySelector(`[data-synastry-anchor="${id}"]`).classList).toContain('is-selected');
});

test('dense group highlights every exact anchor and exposes individually selectable members', async () => {
  const relationship = JSON.parse(JSON.stringify(fixture));
  Object.keys(relationship.calculation.inputs.A.positions).forEach(body => { relationship.calculation.inputs.A.positions[body] = 359; });
  await render(relationship);
  const group = [...container.querySelectorAll('.synastry-planet.person-A')].find(el => el.dataset.members.includes(','));
  await click(group);
  const members = group.dataset.members.split(',');
  for (const id of members) expect(container.querySelector(`[data-synastry-anchor="${id}"]`).classList).toContain('is-selected');
  expect(container.querySelectorAll('.synastry-group-members button')).toHaveLength(members.length);
  await click(container.querySelector('.synastry-group-members button'));
  expect(container.querySelectorAll('.synastry-anchor.is-selected')).toHaveLength(1);
  expect(container.querySelector('.synastry-detail').textContent).toContain(longitudeText(359));
});

test('aspect keyboard activation selects exact A/B endpoints and stored orb; Escape clears', async () => {
  await render();
  const aspect = container.querySelector('[data-synastry-aspect]');
  const model = normalizeSynastry(fixture.calculation), row = model.aspects.find(item => item.id === aspect.dataset.synastryAspect);
  await act(async () => Simulate.keyDown(aspect, { key: 'Enter', preventDefault() {} }));
  expect(container.querySelector('.synastry-detail').textContent).toContain('Орб:');
  expect(container.querySelector('.synastry-detail').textContent).toContain('Вячеслав');
  expect(container.querySelector('.synastry-detail').textContent).toContain('Анна');
  expect([...container.querySelectorAll('.synastry-anchor.is-selected')].map(el => el.dataset.synastryAnchor).sort()).toEqual([row.from, row.to].sort());
  await act(async () => Simulate.keyDown(container.querySelector('.synastry-chart'), { key: 'Escape' }));
  expect(container.querySelectorAll('.synastry-anchor.is-selected')).toHaveLength(0);
});

test('labels are text, not markup, and missing optional facts are never fabricated', async () => {
  const relationship = JSON.parse(JSON.stringify(fixture));
  relationship.person_a_label = '<img src=x onerror=alert(1)>';
  relationship.calculation.inputs.A.angles = {};
  relationship.calculation.inputs.A.cusps = null;
  relationship.calculation.house_overlays = [];
  await render(relationship);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toContain(relationship.person_a_label);
  expect(container.querySelectorAll('[data-synastry-cusp],[data-synastry-angle]')).toHaveLength(0);
  expect(container.querySelectorAll('.synastry-overlay')).toHaveLength(0);
  expect(container.textContent).toContain('0° Овна слева');
});

test('resize and rerender preserve geometry; a different relationship clears selection', async () => {
  await render();
  const geometry = () => [...container.querySelectorAll('[data-synastry-label]')].map(el => el.getAttribute('transform'));
  const original = geometry();
  await click(container.querySelector('[data-synastry-aspect]'));
  await act(async () => window.dispatchEvent(new Event('resize')));
  await render({ ...fixture });
  expect(geometry()).toEqual(original);
  expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 720 720');
  await render({ ...fixture, id: 43 });
  expect(container.querySelector('.synastry-detail').textContent).toContain('Нажмите на планету');
});

test('missing snapshot renders a useful fallback without throwing', async () => {
  await render({ id: 1 });
  expect(container.querySelector('svg')).toBeNull();
  expect(container.querySelector('[role="status"]').textContent).toContain('не хватает');
});
