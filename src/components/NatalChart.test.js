import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import NatalChart from './NatalChart';
import api from './natal/fixtures/api-placidus.json';

let root, container, query, change;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  query = { matches: false, addEventListener: (_, callback) => { change = callback; }, removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => query);
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); delete window.matchMedia; });
const render = () => act(async () => root.render(<NatalChart bodies={api.bodies_for_circle} houses={api.houses} aspects={api.aspects_for_circle} structuredAspects={api.aspects_structured} houseSystem="Placidus"><section id="conversation"><textarea aria-label="Вопрос" /></section></NatalChart>));
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

test('desktop keeps placements beside the unchanged wheel and reference controls after conversation', async () => {
  await render();
  expect(container.querySelector('.chart-layout .chart-summary')).not.toBeNull();
  expect(container.querySelectorAll('.chart-summary')).toHaveLength(1);
  expect(container.querySelector('.chart-layout .wheel-text-details')).toBeNull();
  expect(before(container.querySelector('.wheel-detail'), container.querySelector('#conversation'))).toBe(true);
  expect(before(container.querySelector('#conversation'), container.querySelector('.wheel-text-details'))).toBe(true);
});

test('mobile changes DOM reading order without duplicating content or remounting the renderer', async () => {
  await render();
  const svg = container.querySelector('svg');
  const markup = svg.innerHTML;
  await act(async () => { query.matches = true; change(); });
  expect(container.querySelector('svg')).toBe(svg);
  expect(svg.innerHTML).toBe(markup);
  expect(container.querySelectorAll('.chart-summary')).toHaveLength(1);
  expect(container.querySelectorAll('.placement')).toHaveLength(3);
  expect(before(container.querySelector('#conversation'), container.querySelector('.chart-summary'))).toBe(true);
  expect(before(container.querySelector('.chart-summary'), container.querySelector('.wheel-text-details'))).toBe(true);
  await act(async () => { query.matches = false; change(); });
  expect(container.querySelector('.chart-layout .chart-summary')).not.toBeNull();
  expect(container.querySelector('svg')).toBe(svg);
});

test('relocated planet, house and aspect controls retain selection, disclosure and Escape behavior', async () => {
  await render();
  for (const selector of ['.wheel-point-list button', '.wheel-house-list button', '.wheel-aspect-list button']) {
    const button = container.querySelector(selector);
    await act(async () => button.click());
    expect(container.querySelector('.wheel-clear')).not.toBeNull();
    const detail = container.querySelector('.wheel-detail').textContent;
    await act(async () => container.querySelector('.wheel-text-details summary').dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(container.querySelector('.wheel-detail').textContent).toBe(detail);
    await act(async () => Simulate.keyDown(button, { key: 'Escape', stopPropagation() {} }));
    expect(container.querySelector('.wheel-clear')).toBeNull();
  }
  await act(async () => container.querySelector('.wheel-point-list button').click());
  await act(async () => container.querySelector('textarea').dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(container.querySelector('.wheel-clear')).toBeNull();
});
