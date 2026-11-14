// METRICS-2 regression F6, F8, F9 (errors part), F10 (observer + apiFetch part).
// Real analytics client behind the module; assertions are on what would leave the browser.
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import ProductAnalyticsObserver from './ProductAnalyticsObserver';
import {apiFetch} from '../api/apiError';
import {createHarness, reply, ERRORS_KEY} from '../analytics/metrics2Harness';
import {saveConsent, setExcluded} from '../analytics/consent';

let mockAuth, mockPath, mockTarget;
jest.mock('../context/AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('react-router-dom', () => ({useLocation: () => ({pathname: mockPath})}));
jest.mock('../analytics/productAnalytics', () => {
  const real = jest.requireActual('../analytics/productAnalytics');
  const proxy = new Proxy({}, {get: (_, key) => mockTarget[key]});
  return {...real, productAnalytics: proxy, analyticsHeaders: () => ({})};
});

let root, container, harness, clock, originalFetch;
// jest's jsdom turns an unlistened window 'error' event into a test failure; a browser would not.
const browser = () => {};
const OWN = () => `${window.location.origin}/static/js/main.4f2a9c.js`;
const mount = async () => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<ProductAnalyticsObserver />));
};
const unmount = async () => {if (root) await act(async () => root.unmount()); root = null; container?.remove();};
const goto = async path => {mockPath = path; await act(async () => root.render(<ProductAnalyticsObserver />));};
const scriptError = (overrides = {}) => act(async () => {
  window.dispatchEvent(new ErrorEvent('error', {message: 'CANARY_MESSAGE', filename: OWN(), lineno: 3, colno: 9,
    error: Object.assign(new Error('CANARY_MESSAGE'), {stack: 'Error: CANARY_STACK\n    at x (main.js:3:9)'}), ...overrides}));
});
const rejection = reason => act(async () => {
  const event = new Event('unhandledrejection'); event.reason = reason; event.promise = Promise.resolve();
  window.dispatchEvent(event);
});
const abort = () => new DOMException('The user aborted a request.', 'AbortError');
const failedRequest = async () => {
  global.fetch = jest.fn(async () => {throw new TypeError('CANARY_NET');});
  await act(async () => {await apiFetch('https://api.example.test/charts').catch(() => {});});
};
const errors = async () => {await harness.settle(); return harness.named('site_error_occurred');};
const keys = events => events.map(value => value.route_key);

beforeEach(async () => {
  jest.useFakeTimers(); global.IS_REACT_ACT_ENVIRONMENT = true; window.addEventListener('error', browser);
  localStorage.clear(); sessionStorage.clear(); saveConsent(true); setExcluded(false);
  mockAuth = {user: null, loading: false}; mockPath = '/my-charts';
  originalFetch = global.fetch; clock = {now: 1000000};
  harness = createHarness({clock}); mockTarget = harness.client;
  await mount();
  await harness.settle();
  expect(harness.names()).toContain('page_viewed'); // the harness itself delivers events
});
afterEach(async () => {
  await unmount(); harness.client.halt(); global.fetch = originalFetch; window.removeEventListener('error', browser);
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

describe('F6: which browser errors are reported, and what leaves', () => {
  test('an error from our own script is one site_error_occurred kind=script with nothing but the kind', async () => {
    await scriptError({filename: OWN() + '?token=CANARY_TOKEN'});
    const events = await errors();
    expect(events).toHaveLength(1);
    expect(events[0].properties).toEqual({kind: 'script'});
    expect(events[0].route_key).toBe('my_charts');
    expect(harness.wire()).not.toMatch(/CANARY|main\.4f2a9c|static\/js|localhost|lineno|stack|message/i);
  });

  test.each([
    ['silent «Script error.»', ''],
    ['another site', 'https://cdn.example.org/lib.js'],
    ['a look-alike host', `${window.location.protocol}//${window.location.hostname}.evil.example/x.js`],
    ['another port', `${window.location.protocol}//${window.location.hostname}:3999/x.js`],
    ['a Chrome extension', 'chrome-extension://abcdefghijklmnop/content.js'],
    ['a Firefox extension', 'moz-extension://11111111-2222/content.js'],
  ])('%s is not reported', async (_, filename) => {
    await goto('/pricing');
    await scriptError({filename});
    await goto('/my-charts');
    await scriptError(); // our own script, on another section: the only report expected
    const events = await errors();
    expect(keys(events)).toEqual(['my_charts']);
  });

  test('an unhandled rejection is script unless it is an abort', async () => {
    await goto('/pricing'); await rejection(abort());
    await goto('/authorization'); await rejection(Object.assign(new Error('x'), {name: 'AbortError'}));
    await goto('/my-charts'); await rejection(new Error('CANARY_REJECTION'));
    await goto('/support'); await rejection('CANARY_STRING_REASON');
    const events = await errors();
    expect(keys(events)).toEqual(['my_charts', 'support']);
    for (const value of events) expect(value.properties).toEqual({kind: 'script'});
    expect(harness.wire()).not.toMatch(/CANARY/);
  });

  test('the listeners are removed on unmount', async () => {
    await unmount();
    await scriptError(); await rejection(new Error('x'));
    expect(await errors()).toHaveLength(0);
    await mount();
    await scriptError();
    expect(await errors()).toHaveLength(1);
  });

  test('a failed request is a different kind from a script error on the same section', async () => {
    await scriptError();
    await failedRequest();
    const events = await errors();
    expect(events.map(value => value.properties.kind).sort()).toEqual(['request', 'script']);
  });
});

describe('F8: rate limit per session, pair (kind, section), and total', () => {
  test('the same kind on the same section is reported once, however often it repeats', async () => {
    for (let i = 0; i < 4; i += 1) await scriptError();
    await rejection(new Error('again'));
    await failedRequest(); await failedRequest(); await failedRequest();
    const events = await errors();
    expect(events.map(value => value.properties.kind).sort()).toEqual(['request', 'script']);
  });

  test('no more than 5 events per session, whatever the sections', async () => {
    for (const path of ['/', '/pricing', '/authorization', '/my-charts', '/try-free', '/support', '/privacy']) {
      await goto(path); await scriptError(); await scriptError();
    }
    const events = await errors();
    expect(events).toHaveLength(5);
    expect(new Set(keys(events)).size).toBe(5);
  });

  test('the limit survives a page reload (counter lives in sessionStorage)', async () => {
    await scriptError();
    expect(await errors()).toHaveLength(1);
    expect(Object.keys(sessionStorage)).toContain(ERRORS_KEY);
    await unmount();
    const reloaded = createHarness({clock}); mockTarget = reloaded.client;
    await mount(); await act(async () => {await reloaded.client.flush();});
    await scriptError(); // same pair after reload: still once per session
    await goto('/pricing'); await scriptError(); // a new pair is allowed
    await reloaded.settle();
    expect(keys(reloaded.named('site_error_occurred'))).toEqual(['pricing']);
    reloaded.client.halt();
  });

  test('the total of 5 survives a reload as well', async () => {
    for (const path of ['/', '/pricing', '/authorization', '/my-charts', '/try-free']) {await goto(path); await scriptError();}
    expect(await errors()).toHaveLength(5);
    await unmount();
    const reloaded = createHarness({clock}); mockTarget = reloaded.client;
    mockPath = '/support'; await mount(); await scriptError();
    await reloaded.settle();
    expect(reloaded.named('site_error_occurred')).toHaveLength(0);
    reloaded.client.halt();
  });

  test('a new analytics session (30 minutes idle) starts a fresh allowance', async () => {
    await scriptError();
    expect(await errors()).toHaveLength(1);
    clock.now += 1800001;
    await scriptError();
    const events = await errors();
    expect(events).toHaveLength(2);
    expect(events[0].session_id).not.toBe(events[1].session_id);
  });

  test.each(['halt', 'reset', 'consent withdrawn'])('the counter is deleted with the rest of analytics storage: %s', async how => {
    await scriptError();
    expect(Object.keys(sessionStorage)).toContain(ERRORS_KEY);
    if (how === 'halt') harness.client.halt();
    else if (how === 'reset') harness.client.reset();
    else await act(async () => saveConsent(false));
    expect(Object.keys(sessionStorage)).not.toContain(ERRORS_KEY);
    expect(sessionStorage.getItem(ERRORS_KEY)).toBeNull();
  });

  test('if the counter cannot be written, nothing is sent; once it can, reporting works', async () => {
    const setItem = Storage.prototype.setItem;
    const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === ERRORS_KEY) throw new Error('QuotaExceededError');
      return setItem.call(this, key, value);
    });
    await scriptError(); await rejection(new Error('x'));
    expect(await errors()).toHaveLength(0);
    blocked.mockRestore();
    await scriptError();
    expect(await errors()).toHaveLength(1);
  });

  test('the analytics endpoint answering 503 or failing does not create error events (no loop)', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, options) => {
      calls.push([url, options && options.body]);
      if (String(url).endsWith('/analytics/events')) return reply({}, 503);
      return reply({accepted: true});
    });
    const broken = createHarness({clock, transport: (...args) => global.fetch(...args)});
    mockTarget = broken.client; harness.client.halt(); await broken.start('/my-charts');
    broken.client.emit('landing_demo_selected');
    for (let i = 0; i < 4; i += 1) await act(async () => {await broken.client.flush();});
    global.fetch = jest.fn(async () => {throw new TypeError('offline');});
    for (let i = 0; i < 2; i += 1) await act(async () => {await broken.client.flush();});
    expect(calls.some(([, body]) => String(body).includes('site_error_occurred'))).toBe(false);
    // a real failed page request later still produces exactly one report
    global.fetch = jest.fn(async (url) => String(url).endsWith('/analytics/events') ? reply({accepted: 20}) : reply({}, 503));
    await act(async () => {const response = await apiFetch('https://api.example.test/charts'); expect(response.status).toBe(503);});
    await act(async () => {await broken.client.flush();});
    const sent = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/analytics/events'))
      .flatMap(([, options]) => JSON.parse(options.body).events).filter(value => value.name === 'site_error_occurred');
    expect(sent.map(value => value.properties)).toEqual([{kind: 'request'}]);
    broken.client.halt();
  });
});

describe('F9: errors are never reported without consent, on excluded devices or on unkeyed sections', () => {
  test.each(['rejected', 'undecided'])('with %s consent nothing is stored or sent', async state => {
    await unmount(); harness.client.halt(); harness.transport.mockClear();
    document.cookie = 'userCookieConsent=; Max-Age=0; Path=/'; document.cookie = 'lunariaAnalyticsPolicy=; Max-Age=0; Path=/';
    if (state === 'rejected') document.cookie = 'userCookieConsent=false; Path=/';
    sessionStorage.clear(); localStorage.clear();
    const fresh = createHarness({clock}); mockTarget = fresh.client;
    await mount();
    await scriptError(); await rejection(new Error('x')); await failedRequest();
    await fresh.settle();
    expect(fresh.transport.mock.calls.filter(([url]) => url.endsWith('/events'))).toEqual([]);
    expect(fresh.client.status().pending).toBe(0);
    expect(sessionStorage.getItem(ERRORS_KEY)).toBeNull();
    fresh.client.halt();
  });

  test('an excluded device sends and stores nothing', async () => {
    await act(async () => setExcluded(true));
    harness.transport.mockClear();
    await scriptError(); await rejection(new Error('x'));
    expect(await errors()).toHaveLength(0);
    expect(sessionStorage.getItem(ERRORS_KEY)).toBeNull();
  });

  test('outside production nothing is reported', async () => {
    await unmount(); harness.client.halt();
    const dev = createHarness({clock, settings: {production: false}}); mockTarget = dev.client;
    await mount(); await scriptError(); await failedRequest();
    await dev.settle();
    expect(dev.transport).not.toHaveBeenCalled();
  });

  test('on /reset-password (no section key) errors are not reported; on a keyed section they are', async () => {
    await goto('/reset-password');
    await scriptError(); await rejection(new Error('x')); await failedRequest();
    expect(await errors()).toHaveLength(0);
    await goto('/my-charts'); await scriptError();
    const events = await errors();
    expect(events).toHaveLength(1);
    expect(events[0].route_key).toBe('my_charts');
  });
});

describe('F10 (guard): a broken reporter never disturbs the page', () => {
  test('error handlers survive analytics throwing', async () => {
    await unmount();
    const down = new Proxy({refresh: jest.fn(), pause: jest.fn(), pageLeave: jest.fn()}, {
      get: (target, key) => key in target ? target[key] : () => {throw new Error('analytics is down');}});
    mockTarget = down;
    const leaked = [];
    const listener = event => {if (/analytics is down/.test(String(event.message))) leaked.push(event.message);};
    window.addEventListener('error', listener);
    await mount();
    await scriptError(); await rejection(new Error('x'));
    global.fetch = jest.fn(async () => {throw new TypeError('offline');});
    await expect(apiFetch('https://api.example.test/x')).rejects.toThrow('Нет связи с сервером');
    window.removeEventListener('error', listener);
    expect(leaked).toEqual([]);
  });
});
