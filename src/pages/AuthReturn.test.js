// FE-AUTH-SESSION regression (DESIGN.md §6, file B): where the sign-in page sends a person afterwards.
// R1–R6: the path back after sign-in, and attempts to send the person to another site through state.returnTo.
// The whole App runs on the real router (MemoryRouter); every navigate() of the app is recorded before it is
// performed, so a dangerous target is caught even when the in-memory router would have survived it.
// Synthetic data only (jwt-A, example.test addresses).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from '../App';

// Jest 27 cannot load react-router-dom v7, so the real router comes from react-router (as in NotFoundPage.test.js).
const mockRouter = { entries: ['/'], index: 0, location: null, navigate: null, calls: [] };
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  const Probe = () => { mockRouter.location = router.useLocation(); mockRouter.navigate = router.useNavigate(); return null; };
  const useNavigate = () => {
    const navigate = router.useNavigate();
    return React.useCallback((...args) => { mockRouter.calls.push(args); return navigate(...args); }, [navigate]);
  };
  return { ...router, useNavigate, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter,
    { initialEntries: mockRouter.entries, initialIndex: mockRouter.index }, React.createElement(Probe), children) };
}, { virtual: true });
jest.mock('../components/NatalChart', () => props => <div data-chart={props.chartId}>{props.children}</div>);
jest.mock('../components/GoogleSignIn', () => () => null);

const GUEST_TOKEN = '12345678-1234-4234-8234-123456789abc';
const response = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: '',
  headers: { get: name => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null), has: () => false },
  json: async () => JSON.parse(JSON.stringify(body)),
  text: async () => JSON.stringify(body),
  clone() { return response(status, body); },
});
const ok = data => response(200, data);
const bearer = options => {
  const headers = options?.headers;
  if (!headers) return null;
  return (typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization || headers.authorization) || null;
};

let migration;
const route = async (url, options = {}) => {
  if (url.includes('/auth/me')) return bearer(options) === 'Bearer jwt-A' ? ok({ id: 1, email: 'a@example.test' }) : response(401, { detail: 'Сессия истекла.' });
  if (url.includes('/auth/login')) return ok({ access_token: 'jwt-A', token_type: 'bearer', guest_chart_migration: migration });
  if (url.includes('/public-config')) return ok({ free_beta_enabled: false });
  if (url.includes('/account/usage')) return ok({ plan: 'free', saved_charts_used: 1, saved_charts_limit: 3, gpt_messages_used: 1,
    gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_limit_type: 'lifetime', gpt_period_valid: true });
  if (url.includes('/natal-charts')) return ok({ count: 1, limit: 3, charts: [{ chart_id: 7 }] });
  if (/\/natal-chart\/7$/.test(url)) return ok({ chart_id: 7, houses: [{ symbol: 'I', degree: 10 }] });
  if (url.includes('/gpt-messages')) return ok([]);
  if (url.includes('/relationships')) return ok({ relationships: [] });
  if (url.includes('/feedback/limits')) return ok({ remaining: 3, retry_after_seconds: 0 });
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
  migration = { status: 'not_requested', chart_id: null };
  mockRouter.calls = [];
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

const openApp = async (entries, index = entries.length - 1) => {
  mockRouter.entries = entries;
  mockRouter.index = index;
  await act(async () => root.render(<App />));
};
const norm = text => text.replace(/\s+/g, ' ').trim();
const mainHeading = () => norm(container.querySelector('main h1')?.textContent || '');
const signInWithForm = async () => {
  await act(async () => Simulate.change(container.querySelector('input[type="email"]'), { target: { value: 'a@example.test' } }));
  await act(async () => Simulate.change(container.querySelector('input[type="password"]'), { target: { value: 'test-password-only' } }));
  await act(async () => Simulate.submit(container.querySelector('form.auth-form')));
  await act(async () => {});
};
const authPageWith = state => ({ pathname: '/authorization', state });
const targets = () => mockRouter.calls.map(([to]) => to);

const BS = String.fromCharCode(92);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const UNSAFE = [
  ['backslash', `/${BS}evil.example`],
  ['tab', `/${TAB}/evil.example`],
  ['line feed', `/${LF}/evil.example`],
  ['protocol-relative', '//evil.example'],
  ['absolute https', 'https://evil.example'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['sign-in page', '/authorization'],
  ['sign-in page via dot segments', '/a/../authorization'],
  ['password reset page', '/reset-password'],
  ['relative path', 'relationships/new'],
  ['empty string', ''],
  ['null', null],
  ['object with pathname', { pathname: '/relationships/new' }],
];

describe('R: return after sign-in', () => {
  test('R1: a private page opened signed out is reopened after sign-in, not the home page', async () => {
    await openApp(['/relationships/new']);
    expect(mockRouter.location.pathname).toBe('/authorization');
    await signInWithForm();
    expect(localStorage.getItem('access_token')).toBe('jwt-A');
    expect(mockRouter.location.pathname).toBe('/relationships/new');
    expect(mainHeading()).toBe('Разбор отношений');
  });

  test.each(UNSAFE.flatMap(([name, value]) => [['form sign-in', name, value], ['already signed in', name, value]]))(
    'R2: %s with returnTo %s (%p) goes home and never navigates anywhere else', async (mode, _, returnTo) => {
      if (mode === 'already signed in') localStorage.setItem('access_token', 'jwt-A');
      await openApp([authPageWith({ returnTo })]);
      if (mode === 'form sign-in') await signInWithForm();
      expect(mockRouter.calls.filter(([to]) => to !== '/')).toEqual([]);
      expect(mockRouter.calls).toContainEqual(['/', { replace: true }]);
      expect(JSON.stringify(targets())).not.toContain('evil');
      expect(mockRouter.location.pathname).toBe('/');
    });

  test.each(['form sign-in', 'already signed in'])('R3: %s keeps only the path of returnTo — no query, no fragment', async mode => {
    if (mode === 'already signed in') localStorage.setItem('access_token', 'jwt-A');
    await openApp([authPageWith({ returnTo: '/relationships/new?x=1#token=abc' })]);
    if (mode === 'form sign-in') await signInWithForm();
    expect(mockRouter.calls).toContainEqual(['/relationships/new', { replace: true }]);
    expect(JSON.stringify(mockRouter.calls)).not.toMatch(/token=|\?x=1/);
    expect(mockRouter.location).toMatchObject({ pathname: '/relationships/new', search: '', hash: '' });
  });

  test.each(['redirect_after_login', 'returnTo'])('R4: a leftover localStorage key %s does not choose the destination', async key => {
    localStorage.setItem(key, '/my-charts');
    await openApp(['/authorization']);
    await signInWithForm();
    expect(targets()).not.toContain('/my-charts');
    expect(mockRouter.location.pathname).toBe('/');
  });

  test('R5 guard: an ordinary returnTo "/pricing" still returns there', async () => {
    await openApp([authPageWith({ returnTo: '/pricing' })]);
    await signInWithForm();
    expect(mockRouter.calls).toContainEqual(['/pricing', { replace: true }]);
    expect(mockRouter.location.pathname).toBe('/pricing');
  });

  test('R5 guard: guest chart migration still returns to the chart with its result', async () => {
    migration = { status: 'migrated', chart_id: 7 };
    const guestChart = { chartId: 7, sessionToken: GUEST_TOKEN, pendingQuestion: 'Какие у меня сильные стороны?' };
    await openApp([authPageWith({ guestChart, returnTo: '/natal-chart-result/7' })]);
    await signInWithForm();
    const login = global.fetch.mock.calls.find(([url]) => url.includes('/auth/login'));
    expect(JSON.parse(login[1].body)).toMatchObject({ guest_chart_id: 7 });
    expect(mockRouter.location.pathname).toBe('/natal-chart-result/7');
    expect(mockRouter.location.state.chartAuth).toMatchObject({ chartId: 7, status: 'migrated', sessionToken: null,
      pendingQuestion: guestChart.pendingQuestion });
  });

  test('R6: the redirect to sign-in carries returnTo and replaces history, so «Назад» leaves without a loop', async () => {
    await openApp(['/pricing', '/relationships/new']);
    expect(mockRouter.location.pathname).toBe('/authorization');
    expect(mockRouter.location.state?.returnTo).toBe('/relationships/new');
    await act(async () => mockRouter.navigate(-1));
    expect(mockRouter.location.pathname).toBe('/pricing');
  });
});
