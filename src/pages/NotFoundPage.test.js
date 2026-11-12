import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

// Jest 27 in react-scripts cannot load react-router-dom v7 (its "react-router/dom" subpath),
// so the real routing comes from react-router (needs TextEncoder in jsdom) and only the BrowserRouter wrapper is replaced.
let mockPath = '/';
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  return { ...router, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter, { initialEntries: [mockPath] }, children) };
}, { virtual: true });

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: async () => ({}) }));
  window.scrollTo = jest.fn();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const openApp = async path => {
  mockPath = path;
  await act(async () => root.render(<App />));
};

test.each(['/abc', '/daily-horoscope', '/natal-chart-result/1/extra'])('unknown address %s shows a clear 404 page with a way home', async path => {
  await openApp(path);
  const main = container.querySelector('main');
  const headings = main.querySelectorAll('h1');
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent).toBe('Страница не найдена');
  expect(document.title).toBe('Страница не найдена — Lunaria');
  const home = [...main.querySelectorAll('a')].find(a => a.textContent === 'На главную');
  expect(home).toBeDefined();
  expect(home.getAttribute('href')).toBe('/');
});

test('known public address does not show the 404 page', async () => {
  await openApp('/terms');
  expect(container.querySelector('main').textContent).not.toContain('Страница не найдена');
});

test('private routes still send a signed-out visitor to sign-in, not to the 404 page', async () => {
  await openApp('/relationships/new');
  expect(container.querySelector('main').textContent).toContain('Рады видеть вас снова');
  expect(container.querySelector('main').textContent).not.toContain('Страница не найдена');
});
