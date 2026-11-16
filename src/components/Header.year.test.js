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

// FE-NAV-GROUPS (№50): «Мой год» → /my-year — последний пункт группы «Прогнозы» (после «Луна сегодня»); гостю тоже. Обычная ссылка, без состояния.
// Прежние проверки соседей в плоском ряду и всего порядка заменены порядком внутри группы.
test.each([['guest', null], ['signed-in', { id: 1 }]])('SR8: %s — «Мой год» → /my-year is the last item of «Прогнозы», after «Луна сегодня»; the link is there exactly once', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const year = navLink('Мой год');
  expect(year.getAttribute('href')).toBe('/my-year');
  expect(year.dataset.state).toBeUndefined();
  expect(year.closest('.nav-menu').id).toBe('nav-menu-forecasts');
  expect(year.previousElementSibling.textContent).toBe('Луна сегодня');
  expect(year.nextElementSibling).toBeNull();
  expect(container.querySelectorAll('a[href="/my-year"]')).toHaveLength(1);
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
