// FE-AUTH-SESSION regression (DESIGN.md §6, file A): the whole App against a fetch double routed by URL.
// S1–S7: the sign-in check fails; T1–T7: another tab and late answers. Synthetic tokens only (jwt-A, jwt-B).
// Order is driven by explicit promises and dispatched events; the only clock is jest fake timers (S4).
// The tests watch the network double, the DOM, the router location and localStorage — never internal calls,
// so they hold whether /auth/me goes through getMe or through a request of AuthContext itself.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from '../App';

// Jest 27 cannot load react-router-dom v7, so the real router comes from react-router (as in NotFoundPage.test.js).
// BrowserRouter becomes a MemoryRouter with a probe that exposes the current location to the test.
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

// DESIGN.md §5, verbatim.
const TEXT_CHECK_FAILED = 'Не удалось проверить вход: нет связи с сервером. Мы не вывели вас из аккаунта — проверьте интернет или подождите минуту и нажмите «Повторить».';
const TEXT_EXPIRED = 'Сессия истекла. Войдите снова, чтобы вернуться к своим картам и разговорам.';
const TEXT_ELSEWHERE = 'Вход в аккаунт завершён в другой вкладке. Войдите снова, чтобы продолжить.';
const AUTH_HEADING = 'Рады видеть вас снова';
const GUEST_TOKEN = '12345678-1234-4234-8234-123456789abc';
// Usage counters double as account markers: they appear on /pricing only for the account that owns them.
const USAGE = { 'jwt-A': 4711, 'jwt-B': 5822 };

const response = (status, body, type = 'application/json') => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300, status, statusText: '',
    headers: { get: name => (String(name).toLowerCase() === 'content-type' ? type : null), has: () => false },
    json: async () => JSON.parse(raw), // HTML or plain text throws SyntaxError like a real Response
    text: async () => raw,
    clone() { return response(status, body, type); },
  };
};
const ok = data => response(200, data);

// A request that waits for the test; it rejects with AbortError when its signal aborts, as fetch does.
const pending = signal => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort);
  return { promise, resolve, reject };
};

const bearer = options => {
  const headers = options?.headers;
  if (!headers) return null;
  const value = typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization || headers.authorization;
  return value || null;
};
const tokenOf = options => (bearer(options) || '').replace(/^Bearer /, '') || null;

// me: (token, options) => response | Promise<response>; default — every token is a valid account.
let me;
let meRequests;
const ACCOUNTS = { 'jwt-A': { id: 1, email: 'a@example.test' }, 'jwt-B': { id: 2, email: 'b@example.test' } };
const validMe = token => (ACCOUNTS[token] ? ok(ACCOUNTS[token]) : response(401, { detail: 'Сессия истекла.' }));
const holdMe = () => (token, options) => {
  const request = pending(options?.signal);
  meRequests.push({ token, ...request });
  return request.promise;
};

const route = async (url, options = {}) => {
  const token = tokenOf(options);
  if (url.includes('/auth/me')) return me(token, options);
  if (url.includes('/auth/login')) return ok({ access_token: 'jwt-B', token_type: 'bearer', guest_chart_migration: { status: 'not_requested', chart_id: null } });
  if (url.includes('/public-config')) return ok({ free_beta_enabled: false });
  if (url.includes('/account/usage')) return ok({ plan: 'free', saved_charts_used: 1, saved_charts_limit: 3,
    gpt_messages_used: USAGE[token] ?? 0, gpt_messages_limit: 9999, gpt_messages_reserved: 0,
    gpt_limit_type: 'lifetime', gpt_period_valid: true, current_period_start: null, current_period_end: null });
  if (url.includes('/natal-charts')) return ok({ count: 0, limit: 3, charts: [] });
  if (/\/natal-chart\/7$/.test(url)) return ok({ chart_id: 7, houses: [{ symbol: 'I', degree: 10 }] });
  if (url.includes('/gpt-messages')) return ok([]);
  if (url.includes('/relationships')) return ok({ relationships: [] });
  if (url.includes('/feedback/limits')) return ok({ remaining: 3, retry_after_seconds: 0 });
  if (url.includes('/ask-gpt')) return response(500, { detail: 'not expected in these tests' });
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
  me = validMe;
  meRequests = [];
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
  jest.useRealTimers();
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
const text = () => norm(container.textContent);
const withRole = (role, wanted) => [...container.querySelectorAll(`[role="${role}"]`)].find(el => norm(el.textContent).includes(wanted));
const button = label => [...container.querySelectorAll('button')].find(el => norm(el.textContent) === label);
const headerButton = label => [...container.querySelectorAll('header.site-header button')].find(el => norm(el.textContent) === label);
// «Войти» of the notice is a link; the header has a button with the same label.
const noticeSignInLink = () => [...container.querySelectorAll('a')].find(a => norm(a.textContent) === 'Войти' && !a.closest('header.site-header'));
const mainHeading = () => norm(container.querySelector('main h1')?.textContent || '');
const calls = part => global.fetch.mock.calls.filter(([url]) => String(url).includes(part));
const callsSince = (mark, part) => global.fetch.mock.calls.slice(mark).filter(([url]) => String(url).includes(part));
const privateRequests = () => global.fetch.mock.calls.filter(([url]) => /\/natal-charts|\/relationships/.test(String(url)));
const withToken = (list, token) => list.filter(([, options]) => tokenOf(options) === token);
// Another tab changes the shared storage; the browser then delivers a storage event to this tab.
const otherTab = async (key, newValue) => {
  const oldValue = localStorage.getItem(key);
  if (newValue === null) localStorage.removeItem(key); else localStorage.setItem(key, newValue);
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, storageArea: localStorage, url: 'http://localhost/' }));
  });
};
const focusTab = async () => act(async () => {
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
});

const expectCheckFailedState = path => {
  // Not signed out: the token stays and the tab is not sent to the sign-in page.
  expect(localStorage.getItem('access_token')).toBe('jwt-A');
  expect(mockRouter.location.pathname).toBe(path);
  expect(text()).not.toContain(AUTH_HEADING);
  // Not let in either: no account controls, no private page and none of its requests.
  expect(headerButton('Выйти')).toBeUndefined();
  expect(mainHeading()).not.toBe('Разбор отношений');
  expect(privateRequests()).toHaveLength(0);
  // The person is told what happened and can retry.
  expect(withRole('alert', TEXT_CHECK_FAILED)).toBeDefined();
  const retry = button('Повторить');
  expect(retry).toBeDefined();
  expect(retry.disabled).toBe(false);
};

const failures = {
  'network TypeError': async () => { throw new TypeError('Failed to fetch'); },
  '500 plain text': async () => response(500, 'Internal Server Error', 'text/plain'),
  '502 HTML': async () => response(502, '<html><body><h1>502 Bad Gateway</h1></body></html>', 'text/html'),
  '503 JSON': async () => response(503, { detail: 'Service Unavailable' }),
  '200 HTML': async () => response(200, '<!doctype html><html><body>Lunaria</body></html>', 'text/html'),
  '200 JSON without id': async () => ok({ email: 'a@example.test' }),
};

describe('S: a failed sign-in check keeps the account and says what to do', () => {
  test.each([
    ['S1', 'network TypeError'],
    ['S2', '500 plain text'], ['S2', '502 HTML'], ['S2', '503 JSON'],
    ['S3', '200 HTML'], ['S3', '200 JSON without id'],
  ].flatMap(([id, failure]) => ['/', '/relationships/new'].map(path => [id, failure, path])))(
    '%s: /auth/me %s on %s keeps the token, shows the notice with «Повторить» and opens nothing private',
    async (id, failure, path) => {
      me = failures[failure];
      await openApp(path);
      expect(calls('/auth/me').length).toBeGreaterThan(0);
      expectCheckFailedState(path);
    });

  test('S4: no answer — «Проверка аккаунта...» until 15 s, then the same failure state', async () => {
    jest.useFakeTimers();
    me = holdMe();
    await openApp('/relationships/new');
    expect(meRequests).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(14900); });
    expect(text()).toContain('Проверка аккаунта...');
    expect(withRole('alert', TEXT_CHECK_FAILED)).toBeUndefined();
    expect(localStorage.getItem('access_token')).toBe('jwt-A');
    await act(async () => { jest.advanceTimersByTime(100); });
    await flush();
    expect(text()).not.toContain('Проверка аккаунта...');
    expectCheckFailedState('/relationships/new');
  });

  test('S5: «Повторить» re-checks once, shows «Проверяем…», and a successful answer opens the page', async () => {
    me = failures['network TypeError'];
    await openApp('/relationships/new');
    expectCheckFailedState('/relationships/new');
    const before = calls('/auth/me').length;
    me = holdMe();
    // Two clicks before React re-renders: one new request only.
    await act(async () => { button('Повторить').click(); button('Повторить')?.click(); });
    expect(calls('/auth/me').length - before).toBe(1);
    const checking = button('Проверяем…');
    expect(checking).toBeDefined();
    expect(checking.disabled).toBe(true);
    await act(async () => { checking.click(); });
    expect(calls('/auth/me').length - before).toBe(1);
    expect(withToken(calls('/auth/me').slice(before), 'jwt-A')).toHaveLength(1);
    await act(async () => meRequests[0].resolve(ok(ACCOUNTS['jwt-A'])));
    await flush();
    expect(withRole('alert', TEXT_CHECK_FAILED)).toBeUndefined();
    expect(button('Повторить')).toBeUndefined();
    expect(headerButton('Выйти')).toBeDefined();
    expect(mainHeading()).toBe('Разбор отношений');
    expect(mockRouter.location.pathname).toBe('/relationships/new');
    expect(localStorage.getItem('access_token')).toBe('jwt-A');
  });

  test.each([[401, '/relationships/new'], [404, '/relationships/new'], [401, '/pricing'], [404, '/pricing']])(
    'S6: /auth/me %i on %s signs out and says the session expired with a way back in', async (status, path) => {
      me = async () => response(status, { detail: status === 401 ? 'Сессия истекла. Войдите в аккаунт снова.' : 'Аккаунт не найден' });
      await openApp(path);
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(headerButton('Войти')).toBeDefined();
      expect(headerButton('Выйти')).toBeUndefined();
      expect(withRole('alert', TEXT_CHECK_FAILED)).toBeUndefined();
      expect(withRole('status', TEXT_EXPIRED)).toBeDefined();
      if (path === '/relationships/new') {
        expect(mockRouter.location.pathname).toBe('/authorization');
        expect(mainHeading()).toBe(AUTH_HEADING);
        expect(mockRouter.location.state?.returnTo).toBe('/relationships/new');
      } else {
        const signIn = noticeSignInLink();
        expect(signIn).toBeDefined();
        await act(async () => signIn.click());
        expect(mockRouter.location.pathname).toBe('/authorization');
        expect(mockRouter.location.state?.returnTo).toBe('/pricing');
      }
      expect(privateRequests()).toHaveLength(0);
    });

  test.each(['pending', 'failed'])('S7 guard: while the check is %s the private page and its requests never appear', async state => {
    me = state === 'pending' ? holdMe() : failures['503 JSON'];
    await openApp('/relationships/new');
    await focusTab();
    expect(mainHeading()).not.toBe('Разбор отношений');
    expect(privateRequests()).toHaveLength(0);
    expect(headerButton('Выйти')).toBeUndefined();
  });
});

describe('T: another tab and late answers', () => {
  test.each(['/relationships/new', '/pricing'])('T1: sign-out in another tab is reflected on %s', async path => {
    await openApp(path);
    expect(headerButton('Выйти')).toBeDefined();
    if (path === '/pricing') expect(text()).toContain(String(USAGE['jwt-A']));
    const mark = global.fetch.mock.calls.length;
    await otherTab('access_token', null);
    await focusTab();
    expect(headerButton('Войти')).toBeDefined();
    expect(headerButton('Выйти')).toBeUndefined();
    expect(withRole('status', TEXT_ELSEWHERE)).toBeDefined();
    expect(text()).not.toMatch(/Загрузка лимитов/);
    expect(text()).not.toContain('Загрузка данных плана…');
    expect(text()).not.toContain(String(USAGE['jwt-A']));
    expect(withToken(global.fetch.mock.calls.slice(mark), 'jwt-A')).toHaveLength(0);
    if (path === '/relationships/new') {
      expect(mockRouter.location.pathname).toBe('/authorization');
      expect(mockRouter.location.state?.returnTo).toBe('/relationships/new');
    } else {
      const signIn = noticeSignInLink();
      expect(signIn).toBeDefined();
      await act(async () => signIn.click());
      expect(mockRouter.location.pathname).toBe('/authorization');
      expect(mockRouter.location.state?.returnTo).toBe('/pricing');
    }
  });

  test('T2: after sign-out in another tab the chart chat answers a question with the guest window, never a silent «Спросить»', async () => {
    await openApp('/natal-chart-result/7');
    expect(container.querySelector('[data-chart="7"]')).not.toBeNull();
    expect(container.querySelector('.chat-input').disabled).toBe(false);
    await otherTab('access_token', null);
    const input = container.querySelector('.chat-input');
    await act(async () => Simulate.change(input, { target: { value: 'Какие у меня сильные стороны?' } }));
    await act(async () => Simulate.submit(container.querySelector('.chat-composer')));
    expect(calls('/ask-gpt')).toHaveLength(0);
    expect(container.querySelector('dialog[open]')).not.toBeNull();
  });

  test('T3: sign-in as B in another tab re-checks and loads limits for B only', async () => {
    await openApp('/pricing');
    expect(text()).toContain(String(USAGE['jwt-A']));
    const mark = global.fetch.mock.calls.length;
    await otherTab('access_token', 'jwt-B');
    await flush();
    expect(withToken(callsSince(mark, '/auth/me'), 'jwt-B').length).toBeGreaterThan(0);
    expect(withToken(callsSince(mark, '/account/usage'), 'jwt-B').length).toBeGreaterThan(0);
    expect(withToken(global.fetch.mock.calls.slice(mark), 'jwt-A')).toHaveLength(0);
    expect(text()).toContain(String(USAGE['jwt-B']));
    expect(text()).not.toContain(String(USAGE['jwt-A']));
    expect(localStorage.getItem('access_token')).toBe('jwt-B');
  });

  test('T4: a late success for jwt-A after sign-out in another tab is not applied', async () => {
    me = holdMe();
    await openApp('/pricing');
    expect(meRequests).toHaveLength(1);
    await otherTab('access_token', null);
    await act(async () => meRequests[0].resolve(ok(ACCOUNTS['jwt-A'])));
    await focusTab();
    expect(headerButton('Выйти')).toBeUndefined();
    expect(headerButton('Войти')).toBeDefined();
    expect(text()).not.toMatch(/Загрузка лимитов/);
    expect(calls('/account/usage')).toHaveLength(0);
    expect(withRole('status', TEXT_ELSEWHERE)).toBeDefined();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  test('T5: a late 401 for jwt-A does not erase jwt-B that another tab already stored', async () => {
    me = holdMe();
    await openApp('/pricing');
    expect(meRequests).toHaveLength(1);
    localStorage.setItem('access_token', 'jwt-B'); // the storage event has not been delivered yet
    me = validMe; // a check of jwt-B (on reconciling now or after the event) is answered at once
    await act(async () => meRequests[0].resolve(response(401, { detail: 'Сессия истекла.' })));
    expect(localStorage.getItem('access_token')).toBe('jwt-B');
    expect(withRole('status', TEXT_EXPIRED)).toBeUndefined();
    // The event arrives late; after reconciling the tab is signed in as B.
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', oldValue: 'jwt-A', newValue: 'jwt-B', storageArea: localStorage, url: 'http://localhost/' }));
    });
    await flush();
    expect(localStorage.getItem('access_token')).toBe('jwt-B');
    expect(headerButton('Выйти')).toBeDefined();
    expect(withToken(calls('/account/usage'), 'jwt-B').length).toBeGreaterThan(0);
    expect(withToken(calls('/account/usage'), 'jwt-A')).toHaveLength(0);
    expect(text()).toContain(String(USAGE['jwt-B']));
  });

  test.each([
    ['pageshow', () => { const event = new Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); window.dispatchEvent(event); }],
    ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
  ])('T6: storage changed without an event; %s reconciles the tab', async (_, fire) => {
    expect(document.visibilityState).toBe('visible');
    await openApp('/pricing');
    expect(headerButton('Выйти')).toBeDefined();
    localStorage.removeItem('access_token'); // missed storage event (bfcache, frozen tab)
    await act(async () => fire());
    expect(headerButton('Войти')).toBeDefined();
    expect(headerButton('Выйти')).toBeUndefined();
    expect(withRole('status', TEXT_ELSEWHERE)).toBeDefined();
    expect(text()).not.toContain(String(USAGE['jwt-A']));
  });

  test.each([200, 401])('T7 guard: sign-in as B in this tab while jwt-A is checked; a late %i for jwt-A changes nothing', async status => {
    me = holdMe();
    await openApp('/authorization');
    expect(meRequests).toHaveLength(1);
    me = validMe;
    await act(async () => Simulate.change(container.querySelector('input[type="email"]'), { target: { value: 'b@example.test' } }));
    await act(async () => Simulate.change(container.querySelector('input[type="password"]'), { target: { value: 'test-password-only' } }));
    await act(async () => Simulate.submit(container.querySelector('form.auth-form')));
    await flush();
    expect(localStorage.getItem('access_token')).toBe('jwt-B');
    expect(headerButton('Выйти')).toBeDefined();
    const mark = global.fetch.mock.calls.length;
    await act(async () => meRequests[0].resolve(status === 200 ? ok(ACCOUNTS['jwt-A']) : response(401, { detail: 'Сессия истекла.' })));
    await flush();
    expect(global.fetch.mock.calls.length).toBe(mark);
    expect(localStorage.getItem('access_token')).toBe('jwt-B');
    expect(headerButton('Выйти')).toBeDefined();
    expect(withRole('status', TEXT_EXPIRED)).toBeUndefined();
    expect(withToken(calls('/account/usage'), 'jwt-A')).toHaveLength(0);
  });
});
