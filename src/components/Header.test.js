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
  expect(charts.nextElementSibling.textContent).toBe('Разбор отношений');
  expect(charts.nextElementSibling.getAttribute('href')).toBe('/relationships/new');
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
