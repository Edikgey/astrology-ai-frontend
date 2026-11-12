import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import ChartWheel from './ChartWheel';
import { normalizeChart, longitudeText } from './model';
import api from './fixtures/api-placidus.json';

let root, container, model;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  model = normalizeChart({ bodies: api.bodies_for_circle, houses: api.houses, aspects: api.aspects_for_circle, structuredAspects: api.aspects_structured, houseSystem: 'Placidus' });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async () => act(async () => root.render(<ChartWheel model={model} />));

test('one SVG, twelve sign glyphs and twelve exact cusp rays render without optional patterns', async () => {
  await render();
  expect(container.querySelectorAll('svg')).toHaveLength(1);
  expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 600 600');
  expect(container.querySelector('svg title').textContent).toContain('точные положения');
  expect(container.querySelectorAll('[data-sign]')).toHaveLength(12);
  expect(container.querySelectorAll('[data-cusp]')).toHaveLength(12);
  expect(container.querySelector('[data-label="☉"]')).not.toBeNull();
  expect(container.querySelector('[data-label="⚸"]')).toBeNull();
});
test('planet keyboard selection exposes exact source data and Escape clears selection', async () => {
  await render();
  const sun = container.querySelector('[data-label="☉"]');
  await act(async () => Simulate.keyDown(sun, { key: 'Enter', preventDefault() {} }));
  expect(container.querySelector('.wheel-detail').textContent).toContain(longitudeText(model.byId['☉'].longitude));
  expect(container.querySelector('.wheel-detail').textContent).not.toContain('API');
  expect(container.querySelectorAll('.wheel-aspect.is-dim').length).toBeGreaterThan(0);
  await act(async () => Simulate.keyDown(container.querySelector('.chart-v2'), { key: 'Escape', stopPropagation() {} }));
  expect(container.querySelector('.wheel-detail').textContent).toContain('Выберите планету');
});
test('aspect mode changes only visibility, and aspect tap shows the supplied orb', async () => {
  await render();
  const select = container.querySelector('select');
  const majorCount = container.querySelectorAll('[data-aspect-id]').length;
  await act(async () => Simulate.change(select, { target: { value: 'all' } }));
  expect(container.querySelectorAll('[data-aspect-id]').length).toBeGreaterThan(majorCount);
  const aspect = model.aspects.find(a => a.from === '☉' && a.to === '☿');
  await act(async () => container.querySelector(`[data-aspect-id="${aspect.id}"] .aspect-hit`).dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(container.querySelector('.wheel-detail').textContent).toContain(aspect.orb);
  await act(async () => Simulate.change(select, { target: { value: 'none' } }));
  expect(container.querySelectorAll('[data-aspect-id]')).toHaveLength(0);
  expect(container.querySelectorAll('.wheel-aspect-list button')).toHaveLength(model.aspects.length);
});
test('outside tap clears a pinned selection without changing input data', async () => {
  await render(); const original = JSON.stringify(model);
  await act(async () => container.querySelector('[data-label="☉"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(container.querySelector('.wheel-detail').textContent).toContain('Выберите планету');
  expect(JSON.stringify(model)).toBe(original);
});
test('missing required data renders an explanation rather than NaN SVG geometry', async () => {
  model = normalizeChart({ bodies: { '☉': api.bodies_for_circle['☉'] }, houses: [] });
  await render(); expect(container.querySelector('svg')).toBeNull();
  expect(container.textContent).toContain('неполны');
});

test('dense group selection highlights its exact anchors and offers each member', async () => {
  const bodies = Object.fromEntries(Object.entries(api.bodies_for_circle).map(([id, body]) => [id, { ...body, degree: ['AS', 'DS', 'MC', 'IC'].includes(id) ? body.degree : 359.8 }]));
  model = normalizeChart({ bodies, houses: api.houses, aspects: api.aspects_for_circle });
  await render();
  const group = container.querySelector('[aria-label^="Группа:"]');
  expect(group).not.toBeNull();
  await act(async () => group.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const members = container.querySelectorAll('.group-members button');
  expect(members.length).toBeGreaterThan(1);
  expect(container.querySelectorAll('[data-point-anchor]:not(.is-dim)')).toHaveLength(members.length);
  await act(async () => members[0].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(container.querySelector('.wheel-detail').textContent).toContain('Рыбы 29°48′');
});

test('no internal word «API» reaches the visible text, the accessible description or the selected point and house', async () => {
  await render();
  await act(async () => Simulate.keyDown(container.querySelector('[data-label="☉"]'), { key: 'Enter', preventDefault() {} }));
  expect(container.querySelector('.wheel-detail').textContent).not.toMatch(/API|Долгота/);
  await act(async () => container.querySelector('.wheel-house-list button').click());
  expect(container.querySelector('.wheel-detail').textContent).toContain('Куспид:');
  expect(container.querySelector('.wheel-detail').textContent).not.toMatch(/API|Долгота/);
  expect(container.textContent).not.toContain('API');
  expect(container.querySelector('svg desc').textContent).not.toContain('API');
});
test('incomplete data is explained without «API» and names the missing point', async () => {
  const changed = { bodies: { ...api.bodies_for_circle }, houses: api.houses, aspects: [], structuredAspects: null };
  delete changed.bodies.AS;
  model = normalizeChart(changed);
  await render();
  expect(container.textContent).toContain('Не хватает данных для точного положения ASC.');
  expect(container.textContent).not.toMatch(/API|не передан/);
});
