import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './Header';
import { safeRouteKey } from '../analytics/productPolicy';

// ---- SOLAR-1-fe, SR8 «шапка» и «аналитика» (tasks/SOLAR-1/DESIGN.md §6 «Страница», «Аналитика», §7 SR8) ----
// «Мой год» → /my-year сразу после «Луна сегодня» (перед «Разборы по темам»); гостю тоже. Обычная ссылка, без намерения и состояния.
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

const navLink = text => [...container.querySelectorAll('#main-navigation a')].find(item => item.textContent === text);

test('SR8: guest menu — «Мой год» → /my-year right after «Луна сегодня», before «Разборы по темам»', () => {
  const moon = navLink('Луна сегодня');
  expect(moon.nextElementSibling.textContent).toBe('Мой год');
  expect(moon.nextElementSibling.getAttribute('href')).toBe('/my-year');
  expect(moon.nextElementSibling.dataset.state).toBeUndefined(); // обычная ссылка, без намерения и состояния
  expect(moon.nextElementSibling.nextElementSibling.textContent).toBe('Разборы по темам');
  expect(moon.nextElementSibling.nextElementSibling.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(navLink('Мой месяц').nextElementSibling).toBe(moon); // «Мой месяц» → «Луна сегодня» без вставок
  expect(container.querySelector('a[href="/my-charts"]')).toBeNull(); // «Мои карты» гостю по-прежнему нет
});

test('SR8: signed-in menu — the same place; the link is there exactly once', async () => {
  mockAuth.user = { id: 1 };
  await act(async () => root.render(<Header />));
  const year = navLink('Мой год');
  expect(year.getAttribute('href')).toBe('/my-year');
  expect(year.previousElementSibling.textContent).toBe('Луна сегодня');
  expect(year.nextElementSibling.textContent).toBe('Разборы по темам');
  expect(year.nextElementSibling.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(container.querySelectorAll('a[href="/my-year"]')).toHaveLength(1);
  // весь порядок целиком: Создать карту, Мои карты, Мой месяц, Луна сегодня, Мой год, Разборы по темам, Разбор отношений, Тарифы
  const order = [...container.querySelectorAll('#main-navigation > a')].map(item => item.textContent);
  expect(order.slice(0, 8)).toEqual(['Создать карту', 'Мои карты', 'Мой месяц', 'Луна сегодня', 'Мой год', 'Разборы по темам', 'Разбор отношений', 'Тарифы']);
});

test.each([['guest', null], ['signed-in', { id: 1 }]])('SR8: %s — tapping «Мой год» closes the mobile menu', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = navLink('Мой год');
  expect(link.getAttribute('href')).toBe('/my-year');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

// DESIGN §6 «Аналитика»: `/my-year` без ключа маршрута, новых событий нет — как «Мой месяц» (MM8), «Луна сегодня» (LD8), «Разборы по темам» (TF3).
// Охрана зелёная на базе (ключа у /my-year нет) и должна такой остаться, когда появится страница.
test.each(['/my-year', '/my-year?chart=7', '/my-year/', '/my-year#CANARY', '/my-year?chart=7&tz=Europe%2FKyiv'])('SR8: %s has no analytics route key', path => {
  expect(safeRouteKey(path)).toBeNull();
});
