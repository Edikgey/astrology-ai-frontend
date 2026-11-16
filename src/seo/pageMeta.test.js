import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import App from '../App';
import { PAGES } from './pageMeta';

// Same router stand-in as NotFoundPage.test.js: real routing from react-router, BrowserRouter replaced by MemoryRouter.
let mockPath = '/';
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  return { ...router, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter, { initialEntries: [mockPath] }, children) };
}, { virtual: true });

const BASE_TITLE = 'Lunaria — Ваша карта. Разговор о вас.';
const BASE_DESCRIPTION = 'Описание из index.html';
const PROTECTED = /^\/relationships\//;
const sample = pattern => pattern.replace(/:\w+/g, '1');
const descriptionTag = () => document.head.querySelector('meta[name="description"]');

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: async () => ({}) }));
  window.scrollTo = jest.fn();
  localStorage.clear();
  document.title = BASE_TITLE;
  const tag = document.createElement('meta');
  tag.name = 'description';
  tag.content = BASE_DESCRIPTION;
  document.head.appendChild(tag);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  descriptionTag()?.remove();
});

const openApp = async to => {
  mockPath = to;
  await act(async () => root.render(<App />));
};

test('every route of the table has its own title ending in Lunaria; open ones have a description up to 160 characters', () => {
  const openTitles = PAGES.filter(page => page.open).map(page => page.title);
  expect(new Set(openTitles).size).toBe(openTitles.length);
  PAGES.forEach(page => {
    expect(page.title).toMatch(/Lunaria/);
    if (page.open) {
      expect(page.description.length).toBeGreaterThan(30);
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
  });
});

test.each(PAGES.map(page => [page.path, page]))('%s sets its own title (and description if open) and restores the old ones on leaving', async (_, page) => {
  await openApp(sample(page.path));
  // A signed-out visitor is sent from the protected relationship pages to sign-in: its title shows there.
  expect(document.title).toBe(PROTECTED.test(page.path) ? 'Вход — Lunaria' : page.title);
  expect(descriptionTag().content).toBe(page.open ? page.description : BASE_DESCRIPTION);
  await act(async () => root.unmount());
  expect(document.title).toBe(BASE_TITLE);
  expect(descriptionTag().content).toBe(BASE_DESCRIPTION);
  root = createRoot(container);
});

test('moving between pages inside the app switches the title', async () => {
  await openApp('/terms');
  expect(document.title).toBe(PAGES.find(p => p.path === '/terms').title);
  await act(async () => container.querySelector('a[href="/support"]').click());
  expect(document.title).toBe(PAGES.find(p => p.path === '/support').title);
  expect(descriptionTag().content).toBe(PAGES.find(p => p.path === '/support').description);
});

test('an unknown address keeps the 404 title', async () => {
  await openApp('/abc');
  expect(document.title).toBe('Страница не найдена — Lunaria');
  expect(descriptionTag().content).toBe(BASE_DESCRIPTION);
});

test('every route path of App.js is in the table (or is an allowed exception)', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../App.js'), 'utf8');
  const routes = [...source.matchAll(/path="([^"]+)"/g)].map(match => match[1]);
  expect(routes.length).toBeGreaterThan(10);
  const known = [...PAGES.map(page => page.path), '/dashboard', '*'];
  routes.forEach(route => expect(known).toContain(route));
});

test('a description tag without content is left without content after leaving a page', async () => {
  descriptionTag().removeAttribute('content');
  await openApp('/terms');
  expect(descriptionTag().content).toBe(PAGES.find(p => p.path === '/terms').description);
  await act(async () => root.unmount());
  expect(descriptionTag().hasAttribute('content')).toBe(false);
  root = createRoot(container);
});

test('public/sitemap.xml lists exactly the open pages of the table', () => {
  const xml = fs.readFileSync(path.resolve(__dirname, '../../public/sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim());
  const open = PAGES.filter(page => page.open).map(page => `https://mylunariaai.com${page.path}`);
  expect(locs.sort()).toEqual(open.sort());
});

test('closed pages are not in the sitemap and are covered by Disallow in public/robots.txt', () => {
  const robots = fs.readFileSync(path.resolve(__dirname, '../../public/robots.txt'), 'utf8').split(/\r?\n/);
  PAGES.filter(page => !page.open).forEach(page => {
    const covered = robots.some(line => line.startsWith('Disallow: ') && sample(page.path).startsWith(line.slice('Disallow: '.length).trim()));
    expect(covered).toBe(true);
  });
});
