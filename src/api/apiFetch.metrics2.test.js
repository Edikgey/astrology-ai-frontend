// METRICS-2 regression F7 (+ F9, F10 for apiFetch): a failed page request is reported as kind=request.
import { apiFetch, NETWORK_ERROR_TEXT } from './apiError';
import { createHarness, throwingAnalytics, reply } from '../analytics/metrics2Harness';
import { saveConsent } from '../analytics/consent';

let mockTarget;
jest.mock('../analytics/productAnalytics', () => {
  const real = jest.requireActual('../analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});

let harness, originalFetch;
const requests = async () => { await harness.settle(); return harness.named('site_error_occurred'); };
beforeEach(async () => {
  jest.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  originalFetch = global.fetch;
  harness = createHarness(); mockTarget = harness.client;
  await harness.start('/my-charts'); await harness.settle();
  expect(harness.names()).toContain('page_viewed'); // the harness itself delivers events
});
afterEach(() => { harness.client.halt(); global.fetch = originalFetch; jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

describe('F7: apiFetch reports only network failures and 5xx', () => {
  test('no network: same error text as before, one report with kind=request and nothing else', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('CANARY_NETWORK_DETAIL'); });
    await expect(apiFetch('https://api.example.test/charts/CANARY_ID?token=CANARY_TOKEN')).rejects.toThrow(NETWORK_ERROR_TEXT);
    const events = await requests();
    expect(events).toHaveLength(1);
    expect(events[0].properties).toEqual({ kind: 'request' });
    expect(events[0].route_key).toBe('my_charts');
    expect(harness.wire()).not.toMatch(/CANARY|api\.example|\/charts\/|token/);
  });

  test.each([500, 502, 503, 504])('a %s answer is returned unchanged and reported once as kind=request', async status => {
    const answer = reply({ detail: 'CANARY_SERVER_TEXT' }, status);
    global.fetch = jest.fn(async () => answer);
    expect(await apiFetch('https://api.example.test/x')).toBe(answer);
    const events = await requests();
    expect(events.map(value => value.properties)).toEqual([{ kind: 'request' }]);
    expect(harness.wire()).not.toMatch(/CANARY/);
  });

  test.each([200, 201, 204, 400, 401, 403, 404, 409, 422, 429])('a %s answer is returned unchanged and not reported', async status => {
    const answer = reply({}, status);
    global.fetch = jest.fn(async () => answer);
    expect(await apiFetch('https://api.example.test/x')).toBe(answer);
    await goReported();
    expect(await requests()).toHaveLength(0);
  });

  test('a cancelled request keeps its own error and is not reported; neither is some other thrown error', async () => {
    const abort = new DOMException('The user aborted a request.', 'AbortError');
    global.fetch = jest.fn(async () => { throw abort; });
    await expect(apiFetch('https://api.example.test/x')).rejects.toBe(abort);
    const odd = new RangeError('CANARY_ODD');
    global.fetch = jest.fn(async () => { throw odd; });
    await expect(apiFetch('https://api.example.test/x')).rejects.toBe(odd);
    expect(await requests()).toHaveLength(0);
    // and the reporter is alive: a real network failure still reports
    global.fetch = jest.fn(async () => { throw new TypeError('x'); });
    await apiFetch('https://api.example.test/x').catch(() => {});
    expect(await requests()).toHaveLength(1);
  });

  test('repeated failures on one section are reported once', async () => {
    global.fetch = jest.fn(async () => reply({}, 503));
    for (let i = 0; i < 5; i += 1) await apiFetch('https://api.example.test/x');
    expect(await requests()).toHaveLength(1);
  });
});
const goReported = async () => { await harness.settle(); };

describe('F9: no consent, no section key', () => {
  test.each(['rejected', 'undecided'])('with %s consent a failed request sends nothing', async state => {
    harness.client.halt();
    document.cookie = 'userCookieConsent=; Max-Age=0; Path=/'; document.cookie = 'lunariaAnalyticsPolicy=; Max-Age=0; Path=/';
    if (state === 'rejected') document.cookie = 'userCookieConsent=false; Path=/';
    sessionStorage.clear(); localStorage.clear();
    const fresh = createHarness(); mockTarget = fresh.client;
    await fresh.client.refresh({ actorKey: null, pathname: '/my-charts' });
    global.fetch = jest.fn(async () => reply({}, 503));
    await apiFetch('https://api.example.test/x');
    global.fetch = jest.fn(async () => { throw new TypeError('x'); });
    await apiFetch('https://api.example.test/x').catch(() => {});
    await fresh.settle();
    expect(fresh.transport.mock.calls.filter(([url]) => url.endsWith('/events'))).toEqual([]);
    expect(Object.keys(sessionStorage)).toEqual([]);
    fresh.client.halt();
  });

  test('on a section without a key (/reset-password) nothing is reported; on a keyed one it is', async () => {
    await harness.client.refresh({ actorKey: null, pathname: '/reset-password' });
    global.fetch = jest.fn(async () => reply({}, 503));
    await apiFetch('https://api.example.test/x');
    expect(await requests()).toHaveLength(0);
    await harness.client.refresh({ actorKey: null, pathname: '/pricing' });
    await apiFetch('https://api.example.test/x');
    const events = await requests();
    expect(events.map(value => value.route_key)).toEqual(['pricing']);
  });
});

describe('F10 (guard): apiFetch does not depend on analytics', () => {
  test('with analytics throwing, the answer and the errors are exactly as before', async () => {
    mockTarget = throwingAnalytics();
    const answer = reply({}, 503);
    global.fetch = jest.fn(async () => answer);
    expect(await apiFetch('https://api.example.test/x')).toBe(answer);
    global.fetch = jest.fn(async () => { throw new TypeError('x'); });
    await expect(apiFetch('https://api.example.test/x')).rejects.toThrow(NETWORK_ERROR_TEXT);
    const abort = new DOMException('aborted', 'AbortError');
    global.fetch = jest.fn(async () => { throw abort; });
    await expect(apiFetch('https://api.example.test/x')).rejects.toBe(abort);
  });
});
