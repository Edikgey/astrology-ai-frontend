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

// --- FE-WHEEL-INTERACT: tooltip with chart facts, «Спросить об этом», reveal ---
const click = el => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const tip = () => container.querySelector('.wheel-tip');
const askButton = () => [...container.querySelectorAll('.wheel-tip button')].find(b => b.textContent === 'Спросить об этом');
const renderAsk = onAsk => act(async () => root.render(<ChartWheel model={model} onAsk={onAsk} />));

test('tapping a planet shows a tooltip with only its sign, degree and house', async () => {
  await renderAsk(jest.fn());
  expect(tip()).toBeNull();
  await click(container.querySelector('[data-label="♀"]'));
  expect(tip().textContent).toContain(`Венера · ${longitudeText(model.byId['♀'].longitude)} · 6 дом`);
  expect(tip().textContent).not.toMatch(/означает|API/);
});

test('«Спросить об этом» hands a ready question to the chat and does not send anything itself', async () => {
  const onAsk = jest.fn(); const originalFetch = global.fetch; global.fetch = jest.fn();
  await renderAsk(onAsk);
  await click(container.querySelector('[data-label="♀"]'));
  await click(askButton());
  expect(onAsk).toHaveBeenCalledTimes(1);
  expect(onAsk).toHaveBeenCalledWith('Что значит Венера в Стрельце в 6 доме в моей карте?');
  expect(global.fetch).not.toHaveBeenCalled();
  global.fetch = originalFetch;
});

test('aspect and house tooltips show type and orb or cusp, and offer their own question', async () => {
  const onAsk = jest.fn();
  await renderAsk(onAsk);
  const aspect = model.aspects.find(a => a.from === '☉' && a.to === '☿');
  await click(container.querySelector(`[data-aspect-id="${aspect.id}"] .aspect-hit`));
  expect(tip().textContent).toContain(`Солнце — соединение — Меркурий, орбис ${aspect.orb}`);
  await click(askButton());
  expect(onAsk).toHaveBeenLastCalledWith('Что значит аспект «Солнце — соединение — Меркурий» в моей карте?');
  await click(container.querySelector('.house-hit'));
  expect(tip().textContent).toContain(`Дом I · куспид ${longitudeText(model.cusps[0].longitude)}`);
  await click(askButton());
  expect(onAsk).toHaveBeenLastCalledWith('Что значит первый дом в моей карте?');
});

test('keyboard: Enter opens the tooltip and moves focus to its button, Escape closes it and returns focus', async () => {
  await renderAsk(jest.fn());
  const venus = container.querySelector('[data-label="♀"]'); venus.focus();
  await act(async () => Simulate.keyDown(venus, { key: 'Enter', preventDefault() {} }));
  expect(tip()).not.toBeNull();
  expect(document.activeElement).toBe(askButton());
  await act(async () => Simulate.keyDown(askButton(), { key: 'Escape', stopPropagation() {} }));
  expect(tip()).toBeNull();
  expect(document.activeElement).toBe(venus);
});

test('tap outside the wheel closes the tooltip', async () => {
  await renderAsk(jest.fn());
  await click(container.querySelector('[data-label="♀"]'));
  expect(tip()).not.toBeNull();
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(tip()).toBeNull();
});

test('hover shows facts without the ask button, which only appears once the object is pinned', async () => {
  await renderAsk(jest.fn());
  await act(async () => Simulate.mouseEnter(container.querySelector('[data-label="♀"]')));
  expect(tip().textContent).toContain('Венера');
  expect(askButton()).toBeUndefined();
});

describe('first-open reveal', () => {
  const setMotion = reduce => { window.matchMedia = jest.fn(() => ({ matches: reduce })); };
  afterEach(() => { delete window.matchMedia; jest.useRealTimers(); });
  test('the reveal class is set on first open and removed once the planets are in place', async () => {
    setMotion(false); jest.useFakeTimers();
    await renderAsk(jest.fn());
    expect(container.querySelector('.chart-v2').classList.contains('is-reveal')).toBe(true);
    await act(async () => { jest.advanceTimersByTime(2500); });
    expect(container.querySelector('.chart-v2').classList.contains('is-reveal')).toBe(false);
  });
  test('with prefers-reduced-motion the reveal class is never set', async () => {
    setMotion(true);
    await renderAsk(jest.fn());
    expect(container.querySelector('.chart-v2').classList.contains('is-reveal')).toBe(false);
  });
});

// --- round 2 (review P3) ---
test('Escape returns focus to the object that opened the tooltip, also after a mouse tap', async () => {
  await renderAsk(jest.fn());
  const venus = container.querySelector('[data-label="♀"]');
  await click(venus);
  askButton().focus();
  await act(async () => Simulate.keyDown(askButton(), { key: 'Escape', stopPropagation() {} }));
  expect(tip()).toBeNull();
  expect(document.activeElement).toBe(venus);
});

test('the ask button is described by the tooltip facts', async () => {
  await renderAsk(jest.fn());
  await click(container.querySelector('[data-label="♀"]'));
  const facts = document.getElementById(askButton().getAttribute('aria-describedby'));
  expect(facts).not.toBeNull();
  expect(facts.textContent).toContain('Венера');
});

test('a long reveal stagger stays inside the reveal window even with every optional point shown', async () => {
  await renderAsk(jest.fn());
  for (const box of container.querySelectorAll('.chart-more input[type="checkbox"]:not(:checked)')) await act(async () => box.click());
  const delays = [...container.querySelectorAll('.planet-label')].map(el => Number(el.style.getPropertyValue('--reveal-i')));
  expect(delays.length).toBeGreaterThan(13);
  expect(Math.max(...delays)).toBeLessThanOrEqual(12);
});
