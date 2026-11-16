import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './Header';

// ---- LUNAR-1-fe, LD8 «шапка» (tasks/LUNAR-1/DESIGN.md §6 «Страница», §7 LD8) ----
// «Луна сегодня» → /moon сразу после «Мой месяц»; гостю тоже. Обычная ссылка, без намерения и состояния.
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

// FE-NAV-GROUPS (№50): «Луна сегодня» → /moon стоит в группе «Прогнозы» между «Мой месяц» и «Мой год»; гостю тоже. Обычная ссылка, без состояния.
// Прежние проверки «сразу после соседа в плоском ряду» заменены порядком внутри группы.
test.each([['guest', null], ['signed-in', { id: 1 }]])('LD8: %s — «Луна сегодня» → /moon in the group «Прогнозы», between «Мой месяц» and «Мой год»', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const moon = navLink('Луна сегодня');
  expect(moon.getAttribute('href')).toBe('/moon');
  expect(moon.dataset.state).toBeUndefined();
  expect(moon.closest('.nav-menu').id).toBe('nav-menu-forecasts');
  expect(moon.previousElementSibling.textContent).toBe('Мой месяц');
  expect(moon.nextElementSibling.textContent).toBe('Мой год');
  expect(container.querySelectorAll('a[href="/moon"]')).toHaveLength(1);
  expect(!!container.querySelector('a[href="/my-charts"]')).toBe(!!user); // «Мои карты» — только вошедшему
});

test.each([['guest', null], ['signed-in', { id: 1 }]])('LD8: %s — tapping «Луна сегодня» closes the mobile menu', async (_who, user) => {
  mockAuth.user = user;
  await act(async () => root.render(<Header />));
  const toggle = container.querySelector('[aria-controls="main-navigation"]');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const link = navLink('Луна сегодня');
  expect(link.getAttribute('href')).toBe('/moon');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
