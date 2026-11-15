import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './Header';
import { LANDING_RELATIONSHIP_INTENT } from '../pages/landingIntent';

let mockAuth;
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../context/UsageContext', () => ({ useUsage: () => ({ usage: { plan: 'free' } }) }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });

let root, container;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuth = { user: null, logout: jest.fn(), loading: false };
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); await act(async () => root.render(<Header />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.clearAllMocks(); });

test('mobile menu exposes its state and Escape closes it and restores toggle focus', async () => {
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = container.querySelector('a[href="/try-free"]'); link.focus();
  await act(async () => link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
});

test('mobile menu closes on outside interaction', async () => {
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

test('relationship link starts guest onboarding and closes the mobile menu', async () => {
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  const link = [...container.querySelectorAll('#main-navigation a')].find(item => item.textContent === 'Разбор отношений');
  expect(link.getAttribute('href')).toBe('/try-free');
  expect(JSON.parse(link.dataset.state)).toEqual({ landingRelationshipIntent: LANDING_RELATIONSHIP_INTENT });
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

test('signed-in navigation exposes owned charts, relationship analysis and logout', async () => {
  mockAuth.user = { id: 1 };
  await act(async () => root.render(<Header />));
  const charts = container.querySelector('a[href="/my-charts"]');
  // MY-MONTH-PAGE MM1: «Мой месяц» стоит сразу после «Мои карты». LUNAR-1 LD8: «Луна сегодня» — сразу после «Мой месяц»,
  // дальше — «Разбор отношений» (порядок обновлён: прежнее «отношения сразу после месяца» больше не верно).
  expect(charts.nextElementSibling.textContent).toBe('Мой месяц');
  expect(charts.nextElementSibling.getAttribute('href')).toBe('/my-month');
  expect(charts.nextElementSibling.nextElementSibling.textContent).toBe('Луна сегодня');
  expect(charts.nextElementSibling.nextElementSibling.getAttribute('href')).toBe('/moon');
  // TOPICS-1 TF3: «Разборы по темам» — сразу после «Луна сегодня», дальше — «Разбор отношений» (порядок обновлён).
  expect(charts.nextElementSibling.nextElementSibling.nextElementSibling.textContent).toBe('Разборы по темам');
  expect(charts.nextElementSibling.nextElementSibling.nextElementSibling.getAttribute('href')).toBe('/topics');
  expect(charts.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(charts.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.getAttribute('href')).toBe('/relationships/new');
  expect(container.querySelector('a[href="/settings"]')).toBeNull();
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Выйти').click());
  expect(mockAuth.logout).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('the plan page is called «Тарифы» and the plan badge has no English label', async () => {
  const links = [...container.querySelectorAll('#main-navigation a')].map(item => item.textContent);
  expect(links).toContain('Тарифы');
  expect(container.textContent).not.toContain('Free & Premium');
  mockAuth = { user: { id: 1 }, logout: jest.fn(), loading: false };
  await act(async () => root.render(<Header />));
  expect(container.querySelector('.nav-account .badge').textContent).toBe('Бесплатно');
});

// ---- MY-MONTH-PAGE-fe, MM1 (DESIGN §3 «Меню», §5): пункт «Мой месяц» в верхнем меню, его видят все ----
const navLink = text => [...container.querySelectorAll('#main-navigation a')].find(item => item.textContent === text);

test('MM1: guest menu has «Мой месяц» → /my-month right after «Создать карту»', async () => {
  const create = navLink('Создать карту');
  expect(create.nextElementSibling.textContent).toBe('Мой месяц');
  expect(create.nextElementSibling.getAttribute('href')).toBe('/my-month');
  expect(create.nextElementSibling.dataset.state).toBeUndefined(); // обычная ссылка, без намерения «разбор отношений»
  expect(container.querySelector('a[href="/my-charts"]')).toBeNull(); // «Мои карты» гостю по-прежнему нет
});

test.each([['guest', null], ['signed-in', { id: 1 }]])('MM1: %s — tapping «Мой месяц» closes the mobile menu', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = navLink('Мой месяц');
  expect(link.getAttribute('href')).toBe('/my-month');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

// ---- TOPICS-1-fe, TF3 (tasks/TOPICS-1/DESIGN.md §3.3, §5): пункт «Разборы по темам» в верхнем меню, его видят все ----
test('TF3: guest menu — «Разборы по темам» → /topics right after «Луна сегодня», before «Разбор отношений»', () => {
  const topics = navLink('Разборы по темам');
  expect(topics).toBeDefined();
  expect(topics.getAttribute('href')).toBe('/topics');
  expect(topics.dataset.state).toBeUndefined(); // обычная ссылка, без намерения и состояния
  expect(topics.previousElementSibling.textContent).toBe('Луна сегодня');
  expect(topics.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(container.querySelector('a[href="/my-charts"]')).toBeNull(); // «Мои карты» гостю по-прежнему нет
});

test('TF3: signed-in menu — the same place; the link is there exactly once', async () => {
  mockAuth.user = { id: 1 };
  await act(async () => root.render(<Header />));
  const topics = navLink('Разборы по темам');
  expect(topics.getAttribute('href')).toBe('/topics');
  expect(topics.previousElementSibling.textContent).toBe('Луна сегодня');
  expect(topics.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(container.querySelectorAll('a[href="/topics"]')).toHaveLength(1);
});

test.each([['guest', null], ['signed-in', { id: 1 }]])('TF3: %s — tapping «Разборы по темам» closes the mobile menu', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = navLink('Разборы по темам');
  expect(link.getAttribute('href')).toBe('/topics');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
