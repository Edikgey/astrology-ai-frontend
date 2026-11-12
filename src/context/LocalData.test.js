// FE-LOCAL-DATA regression (DESIGN.md §4): what the browser keeps about a person between sessions.
// F4/F5 sign-out and expired session wipe the chart number and the retired birth-data keys; F6 clean-up at start;
// G2 the guest chart number survives sign-in; G3 a tab that only follows another tab writes nothing.
// The whole App against a fetch double routed by URL; synthetic data only (jwt-A, jwt-B, a made-up guest token).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from '../App';

// Jest 27 cannot load react-router-dom v7: the real router comes from react-router (as in AuthSession.test.js).
const mockRouter = { entries: ['/'], index: 0, location: null };
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  const Probe = () => { mockRouter.location = router.useLocation(); return null; };
  return { ...router, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter,
    { initialEntries: mockRouter.entries, initialIndex: mockRouter.index }, React.createElement(Probe), children) };
}, { virtual: true });
jest.mock('../components/NatalChart', () => props => <div data-chart={props.chartId}>{props.children}</div>);

const GUEST_TOKEN = '12345678-1234-4234-8234-123456789abc';
const TEXT_ELSEWHERE = 'Вход в аккаунт завершён в другой вкладке. Войдите снова, чтобы продолжить.';
const GUEST_LOST = 'Эта карта была построена до входа и не сохранилась в аккаунте. Постройте её снова — это займёт минуту.';
const houses = [{ symbol: 'I', degree: 10 }];

const response = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: '',
  headers: { get: name => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null), has: () => false },
  json: async () => JSON.parse(JSON.stringify(body)), text: async () => JSON.stringify(body),
  clone() { return response(status, body); },
});
const ok = data => response(200, data);
const pending = signal => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort);
  return { promise, resolve, reject };
};

let me;
let meRequests;
let guestChartExists;
const holdMe = () => (token, options) => {
  const request = pending(options?.signal);
  meRequests.push({ token, ...request });
  return request.promise;
};
const route = async (url, options = {}) => {
  const link = String(url);
  if (link.includes('opencagedata')) return ok({ results: [{ formatted: 'Kyiv', geometry: { lat: 50.45, lng: 30.52 },
    components: { country: 'Ukraine' }, annotations: { timezone: { name: 'Europe/Kyiv' } } }] });
  if (link.includes('/auth/me')) return me(String(options?.headers?.Authorization || '').replace(/^Bearer /, '') || null, options);
  if (link.includes('/auth/login')) return ok({ access_token: 'jwt-B', token_type: 'bearer', guest_chart_migration: { status: 'not_requested', chart_id: null } });
  if (link.includes('/public-config')) return ok({ free_beta_enabled: false });
  if (link.includes('/account/usage')) return ok({ plan: 'free', saved_charts_used: 0, saved_charts_limit: 3,
    gpt_messages_used: 0, gpt_messages_limit: 9999, gpt_messages_reserved: 0, gpt_limit_type: 'lifetime', gpt_period_valid: true });
  if (/\/natal-chart$/.test(link)) return ok({ chart_id: 7, houses });
  if (/\/natal-chart\/7$/.test(link)) return guestChartExists ? ok({ chart_id: 7, houses })
    : response(404, { detail: '❌ Карта не найдена' });
  if (link.includes('/natal-charts')) return ok({ count: 0, limit: 3, charts: [] });
  if (link.includes('/gpt-messages')) return ok([]);
  if (link.includes('/relationships')) return ok({ relationships: [] });
  if (link.includes('/feedback/limits')) return ok({ remaining: 3, retry_after_seconds: 0 });
  return response(404, { detail: 'unexpected test request' });
};

let root;
let container;
let originalFetch;
let originalShowModal;
let originalClose;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem('session_token', GUEST_TOKEN);
  me = async () => ok({ id: 1, email: 'a@example.test' });
  meRequests = [];
  guestChartExists = true;
  originalFetch = global.fetch;
  global.fetch = jest.fn(route);
  window.scrollTo = jest.fn();
  originalShowModal = HTMLDialogElement.prototype.showModal;
  originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
  jest.spyOn(console, 'log').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
  jest.restoreAllMocks();
});

const openApp = async (path, token = 'jwt-A') => {
  if (token) localStorage.setItem('access_token', token);
  mockRouter.entries = [path];
  mockRouter.index = 0;
  await act(async () => root.render(<App />));
};
const flush = async () => act(async () => {});
const norm = text => text.replace(/\s+/g, ' ').trim();
const headerButton = label => [...container.querySelectorAll('header.site-header button')].find(el => norm(el.textContent) === label);
const withRole = (role, wanted) => [...container.querySelectorAll(`[role="${role}"]`)].find(el => norm(el.textContent).includes(wanted));
const focusTab = async () => act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
const stored = key => localStorage.getItem(key);

// What a person leaves on the device: the last chart number, the two keys earlier versions wrote with birth data,
// and the things this task must NOT touch (guest session, saved profile, chart label).
const RETIRED = { tempUserData: JSON.stringify({ birthDate: '2000-01-01', birthTime: '12:37', birthPlace: 'Test city' }),
  natalChart: JSON.stringify({ chart_id: 7, birth_utc: '2000-01-01T09:37:00', timezone: 'Europe/Kyiv' }) };
const KEPT = { session_token: GUEST_TOKEN, userData: JSON.stringify({ name: 'Test person' }),
  'chart-presentation:7': JSON.stringify({ name: 'Моя карта' }) };
const putRetired = () => Object.entries({ ...RETIRED, chart_id: '7', ...KEPT }).forEach(([key, value]) => localStorage.setItem(key, value));
const expectOnlyPersonalChartDataGone = () => {
  ['chart_id', 'natalChart', 'tempUserData'].forEach(key => expect(stored(key)).toBeNull());
  Object.entries(KEPT).forEach(([key, value]) => expect(stored(key)).toBe(value)); // the scope boundary
};

describe('FE-LOCAL-DATA F4/F5: leaving the account wipes the chart number and the retired birth data', () => {
  test('F4: «Выйти» in the header', async () => {
    await openApp('/');
    expect(headerButton('Выйти')).toBeDefined();
    putRetired(); // after mounting: the start-up clean-up must not be what removes them
    await act(async () => headerButton('Выйти').click());
    await flush();
    expect(stored('access_token')).toBeNull();
    expect(headerButton('Войти')).toBeDefined();
    expectOnlyPersonalChartDataGone();
  });

  test('F5: /auth/me answers 401 for the stored token', async () => {
    me = holdMe();
    await openApp('/');
    expect(meRequests).toHaveLength(1);
    putRetired();
    await act(async () => meRequests[0].resolve(response(401, { detail: 'Сессия истекла.' })));
    await flush();
    expect(stored('access_token')).toBeNull();
    expect(headerButton('Войти')).toBeDefined();
    expectOnlyPersonalChartDataGone();
  });
});

describe('FE-LOCAL-DATA F6: start-up removes only the two retired keys', () => {
  test.each([['with a stored token', 'jwt-A'], ['without a token (guest)', null]])('%s', async (_, token) => {
    putRetired();
    await openApp('/', token);
    await flush();
    expect(stored('tempUserData')).toBeNull();
    expect(stored('natalChart')).toBeNull();
    expect(stored('chart_id')).toBe('7'); // a guest still needs it
    Object.entries(KEPT).forEach(([key, value]) => expect(stored(key)).toBe(value));
    if (token) expect(stored('access_token')).toBe(token);
  });
});

describe('FE-LOCAL-DATA guards', () => {
  test('G2: a guest chart built on this device keeps its number through a plain sign-in and the explanation still shows', async () => {
    await openApp('/try-free', null);
    const place = () => container.querySelector('[name="birthPlace"]');
    await act(async () => Simulate.change(place(), { target: { name: 'birthPlace', value: 'Kyiv' } }));
    await act(async () => container.querySelector('.suggestions-list li').click());
    await act(async () => Simulate.submit(place().closest('form')));
    await flush();
    expect(stored('chart_id')).toBe('7');
    expect(mockRouter.location.pathname).toBe('/natal-chart-result/7');
    expect(container.querySelector('[data-chart="7"]')).not.toBeNull();
    // Leave the result page (no guestChart is handed to the sign-in page) and sign in from the menu.
    await act(async () => container.querySelector('a.brand').click());
    expect(mockRouter.location.pathname).toBe('/');
    await act(async () => container.querySelector('.login-btn').click());
    expect(mockRouter.location.pathname).toBe('/authorization');
    expect(mockRouter.location.state?.guestChart).toBeUndefined();
    await act(async () => Simulate.change(container.querySelector('input[type="email"]'), { target: { value: 'b@example.test' } }));
    await act(async () => Simulate.change(container.querySelector('input[type="password"]'), { target: { value: 'test-password-only' } }));
    await act(async () => Simulate.submit(container.querySelector('form.auth-form')));
    await flush();
    expect(stored('access_token')).toBe('jwt-B');
    expect(JSON.parse(global.fetch.mock.calls.find(([url]) => String(url).includes('/auth/login'))[1].body)).not.toHaveProperty('guest_chart_id');
    expect(stored('chart_id')).toBe('7');
    // Reload on the chart: the account has no chart 7 (the server decides) and the page explains why.
    guestChartExists = false;
    await act(async () => root.unmount());
    root = createRoot(container);
    await openApp('/natal-chart-result/7', null);
    await flush();
    expect(withRole('alert', GUEST_LOST)).toBeDefined();
    expect(container.querySelector('[data-chart]')).toBeNull();
    expect(stored('chart_id')).toBe('7');
  });

  test('G3: a tab that only follows another tab writes nothing: the guest chart built there after sign-out survives', async () => {
    await openApp('/pricing');
    expect(headerButton('Выйти')).toBeDefined();
    // The other tab signs out and builds a guest chart before this tab hears about it.
    localStorage.removeItem('access_token');
    localStorage.setItem('chart_id', '12');
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', oldValue: 'jwt-A', newValue: null, storageArea: localStorage, url: 'http://localhost/' }));
    });
    await focusTab();
    expect(withRole('status', TEXT_ELSEWHERE)).toBeDefined();
    expect(headerButton('Войти')).toBeDefined();
    expect(stored('chart_id')).toBe('12');
  });
});
