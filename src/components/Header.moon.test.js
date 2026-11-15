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

// TOPICS-1 TF3: после «Луна сегодня» теперь «Разборы по темам», затем «Разбор отношений»; SOLAR-1 SR8: между «Луна сегодня» и
// «Разборы по темам» встаёт «Мой год» (порядок обновлён). Сама «Луна сегодня» — сразу после «Мой месяц», как раньше.
test('LD8: guest menu — «Луна сегодня» → /moon right after «Мой месяц», before «Мой год»', () => {
  const month = navLink('Мой месяц');
  expect(month.nextElementSibling.textContent).toBe('Луна сегодня');
  expect(month.nextElementSibling.getAttribute('href')).toBe('/moon');
  expect(month.nextElementSibling.dataset.state).toBeUndefined();
  expect(month.nextElementSibling.nextElementSibling.textContent).toBe('Мой год');
  expect(month.nextElementSibling.nextElementSibling.nextElementSibling.textContent).toBe('Разборы по темам');
  expect(container.querySelector('a[href="/my-charts"]')).toBeNull(); // «Мои карты» гостю по-прежнему нет
});

test('LD8: signed-in menu — the same place, after «Мой месяц»', async () => {
  mockAuth.user = { id: 1 };
  await act(async () => root.render(<Header />));
  const month = navLink('Мой месяц');
  expect(month.previousElementSibling.getAttribute('href')).toBe('/my-charts');
  expect(month.nextElementSibling.textContent).toBe('Луна сегодня');
  expect(month.nextElementSibling.getAttribute('href')).toBe('/moon');
  expect(month.nextElementSibling.nextElementSibling.textContent).toBe('Мой год');
  expect(month.nextElementSibling.nextElementSibling.nextElementSibling.textContent).toBe('Разборы по темам');
  expect(container.querySelectorAll('a[href="/moon"]')).toHaveLength(1);
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
