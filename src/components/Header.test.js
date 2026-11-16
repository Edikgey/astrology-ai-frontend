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

const navLink = text => [...container.querySelectorAll('#main-navigation a')].find(item => item.textContent === text);
const menuOf = id => container.querySelector(`#nav-menu-${id}`);
const trigger = id => container.querySelector(`[aria-controls="nav-menu-${id}"]`);
const pairs = links => [...links].map(a => [a.textContent, a.getAttribute('href')]);
const signIn = async () => { mockAuth.user = { id: 1 }; await act(async () => root.render(<Header />)); };

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
  const link = navLink('Отношения'); // FE-NAV-GROUPS: was «Разбор отношений»; now under the group «Разборы»
  expect(link.getAttribute('href')).toBe('/try-free');
  expect(JSON.parse(link.dataset.state)).toEqual({ landingRelationshipIntent: LANDING_RELATIONSHIP_INTENT });
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

// ---- FE-NAV-GROUPS (№50): the menu is grouped. Left: «Прогнозы» (Мой месяц, Луна сегодня, Мой год), «Разборы» (По темам, Отношения),
// «Тарифы». Right: «Мои карты» (signed-in only), «Создать карту», the account menu or «Войти». These replace the flat-order tests. ----
test('guest menu: two groups, «Тарифы», «Создать карту» and «Войти»; no «Мои карты», no account menu', () => {
  expect(pairs(menuOf('forecasts').querySelectorAll('a'))).toEqual([['Мой месяц', '/my-month'], ['Луна сегодня', '/moon'], ['Мой год', '/my-year']]);
  expect(pairs(menuOf('readings').querySelectorAll('a'))).toEqual([['По темам', '/topics'], ['Отношения', '/try-free']]);
  expect(pairs(container.querySelectorAll('.nav-main > a'))).toEqual([['Тарифы', '/pricing']]);
  expect(pairs(container.querySelectorAll('.nav-side > a'))).toEqual([['Создать карту', '/try-free']]);
  expect(container.querySelector('.login-btn').textContent).toBe('Войти');
  expect(container.querySelector('a[href="/my-charts"]')).toBeNull();
  expect(trigger('account')).toBeNull();
});

test('signed-in menu: «Мои карты» before «Создать карту», relationship link without state, account menu with «Подписка» and «Выйти»', async () => {
  await signIn();
  expect(pairs(menuOf('readings').querySelectorAll('a'))).toEqual([['По темам', '/topics'], ['Отношения', '/relationships/new']]);
  expect(navLink('Отношения').dataset.state).toBeUndefined();
  expect(pairs(container.querySelectorAll('.nav-side > a'))).toEqual([['Мои карты', '/my-charts'], ['Создать карту', '/try-free']]);
  expect(container.querySelector('.login-btn')).toBeNull();
  expect(pairs(menuOf('account').querySelectorAll('a'))).toEqual([['Подписка', '/pricing']]);
  expect(container.querySelector('a[href="/settings"]')).toBeNull();
  await act(async () => [...menuOf('account').querySelectorAll('button')].find(b => b.textContent === 'Выйти').click());
  expect(mockAuth.logout).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('forecast and topic links are in the menu exactly once for guest and signed-in', async () => {
  for (const signedIn of [false, true]) {
    if (signedIn) await signIn();
    for (const href of ['/my-month', '/moon', '/my-year', '/topics']) expect(container.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1);
  }
});

test('analytics attributes stay on «Создать карту», «Тарифы» and «Войти»', () => {
  expect(navLink('Создать карту').dataset.analytics).toBe('landing_cta_chart');
  expect(navLink('Тарифы').dataset.analytics).toBe('landing_cta_pricing');
  expect(container.querySelector('.login-btn').dataset.analytics).toBe('landing_cta_login');
});

test('the plan page is called «Тарифы» and the plan label on the account button has no English text', async () => {
  expect(navLink('Тарифы')).toBeDefined();
  expect(container.textContent).not.toContain('Free & Premium');
  await signIn();
  expect(trigger('account').textContent).toContain('Бесплатно');
});

// ---- the drop-downs: closed at first; a click opens one (only one at a time); Escape, a click outside, tabbing out and a link close it ----
test('drop-downs are closed at first and a click toggles one', async () => {
  for (const id of ['forecasts', 'readings']) { expect(trigger(id).getAttribute('aria-expanded')).toBe('false'); expect(menuOf(id).hidden).toBe(true); }
  await act(async () => trigger('forecasts').click());
  expect(trigger('forecasts').getAttribute('aria-expanded')).toBe('true');
  expect(menuOf('forecasts').hidden).toBe(false);
  await act(async () => trigger('forecasts').click());
  expect(trigger('forecasts').getAttribute('aria-expanded')).toBe('false');
  expect(menuOf('forecasts').hidden).toBe(true);
});

test('only one drop-down is open at a time', async () => {
  await act(async () => trigger('forecasts').click());
  await act(async () => trigger('readings').click());
  expect(menuOf('forecasts').hidden).toBe(true);
  expect(trigger('forecasts').getAttribute('aria-expanded')).toBe('false');
  expect(menuOf('readings').hidden).toBe(false);
});

test('Escape closes the open drop-down and returns focus to its button', async () => {
  await act(async () => trigger('readings').click());
  const link = menuOf('readings').querySelector('a'); link.focus();
  await act(async () => link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(menuOf('readings').hidden).toBe(true);
  expect(trigger('readings').getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger('readings'));
});

test('a click outside closes the open drop-down; a press inside the menu does not', async () => {
  await act(async () => trigger('forecasts').click());
  await act(async () => menuOf('forecasts').dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(menuOf('forecasts').hidden).toBe(false);
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(menuOf('forecasts').hidden).toBe(true);
});

test('moving focus out of the menu closes the open drop-down, moving it inside does not', async () => {
  await act(async () => trigger('forecasts').click());
  const inside = menuOf('forecasts').querySelector('a');
  await act(async () => trigger('forecasts').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inside })));
  expect(menuOf('forecasts').hidden).toBe(false);
  const outside = document.createElement('button'); document.body.appendChild(outside);
  await act(async () => trigger('forecasts').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside })));
  expect(menuOf('forecasts').hidden).toBe(true);
  outside.remove();
});

test('following a link closes the drop-down', async () => {
  await act(async () => trigger('forecasts').click());
  const link = navLink('Мой год');
  link.addEventListener('click', event => event.preventDefault(), { once: true });
  await act(async () => link.click());
  expect(menuOf('forecasts').hidden).toBe(true);
});

test('the account menu opens the same way and «Выйти» closes it', async () => {
  await signIn();
  expect(menuOf('account').hidden).toBe(true);
  await act(async () => trigger('account').click());
  expect(menuOf('account').hidden).toBe(false);
  await act(async () => [...menuOf('account').querySelectorAll('button')].find(b => b.textContent === 'Выйти').click());
  expect(menuOf('account').hidden).toBe(true);
});

test('on a phone the groups are plain headings with their items, not drop-downs', async () => {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  try {
    await act(async () => root.render(<Header key="phone" />));
    expect(trigger('forecasts')).toBeNull();
    expect([...container.querySelectorAll('.nav-group-title')].map(h => h.textContent)).toEqual(['Прогнозы', 'Разборы']);
    expect(container.querySelectorAll('a[href="/moon"]')).toHaveLength(1);
  } finally { delete window.matchMedia; }
});

// ---- MY-MONTH-PAGE-fe MM1 / LUNAR-1 LD8 / SOLAR-1 SR8 / TOPICS-1 TF3: «Мой месяц» and «По темам» are plain links (no state)
// for everyone, and tapping one closes the mobile menu («Луна сегодня» and «Мой год» — in Header.moon/year.test.js). Their order is set by the groups (tests above). ----
test.each([['Мой месяц', '/my-month'], ['По темам', '/topics']])(
  'plain link «%s» for guest and signed-in; tapping it closes the mobile menu', async (text, href) => {
    for (const signedIn of [false, true]) {
      if (signedIn) await signIn();
      const toggle = container.querySelector('[aria-controls="main-navigation"]');
      await act(async () => toggle.click());
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const link = navLink(text);
      expect(link.getAttribute('href')).toBe(href);
      expect(link.dataset.state).toBeUndefined();
      link.addEventListener('click', event => event.preventDefault(), { once: true });
      await act(async () => link.click());
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    }
  });
