// METRICS-2 regression F5 (+ F9, F10 for the error boundary): a page that crashes while rendering.
// The real App, router and product-analytics observer; pages, header and footer are small stand-ins.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createHarness } from './analytics/metrics2Harness';
import { saveConsent } from './analytics/consent';

let mockTarget, mockBoom, mockThrow;
// Jest 27 cannot load react-router-dom v7; the real routing comes from react-router (as in NotFoundPage.test.js).
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  return { ...router, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter, { initialEntries: ['/'] }, children) };
}, { virtual: true });
jest.mock('./analytics/productAnalytics', () => {
  const real = jest.requireActual('./analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});
jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false, authError: false, authChecking: false, signedOutReason: null }),
}));
jest.mock('./context/UsageContext', () => ({ UsageProvider: ({ children }) => children }));
jest.mock('./context/ServiceConfigContext', () => ({ ServiceConfigProvider: ({ children }) => children }));
jest.mock('./components/AnalyticsRouteGuard', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('./components/CookiePreferences', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/PublicBehavior', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/FeedbackWidget', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/FreeBetaNotice', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/Header', () => {
  const { Link } = require('react-router-dom');
  return { __esModule: true, default: () => <header data-testid="site-header">Шапка сайта <Link to="/pricing">Тарифы</Link></header> };
});
jest.mock('./components/Footer', () => ({ __esModule: true, default: () => <footer data-testid="site-footer">Подвал сайта</footer> }));
jest.mock('./pages/HomePage', () => ({ __esModule: true, default: () => {
  if (mockThrow) throw mockBoom;
  return <section data-testid="home">Главная страница</section>;
} }));
jest.mock('./pages/PricingPage', () => ({ __esModule: true, default: () => <section data-testid="pricing">Тарифы</section> }));
jest.mock('./pages/AuthorizationPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/TryFreePage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/MyCharts', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/NatalChartResultPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/RelationshipNewPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/RelationshipResultPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/NotFoundPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/PasswordResetPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/LegalPages', () => ({ TermsPage: () => null, PrivacyPage: () => null, RefundPage: () => null, SupportPage: () => null }));

let root, container, harness, clock;
// A jsdom window without any error listener makes jest fail the test; a real browser does not.
const browser = () => {};
const mount = async () => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); try { await act(async () => root.render(<App />)); } catch { /* without a boundary React rethrows; the assertions below then show the blank page */ } };
const goToPricing = async () => act(async () => { [...container.querySelectorAll('header a')].find(a => a.textContent === 'Тарифы').click(); });
const alert = () => container.querySelector('[role="alert"]');
const reports = async () => { await harness.settle(); return harness.named('site_error_occurred'); };

beforeEach(async () => {
  jest.useFakeTimers(); global.IS_REACT_ACT_ENVIRONMENT = true; window.addEventListener('error', browser);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  window.scrollTo = jest.fn();
  mockBoom = Object.assign(new Error('CANARY_RENDER_FAILURE'), { stack: 'Error: CANARY_RENDER_FAILURE\n    at Home (Home.js:1:1)' });
  mockThrow = true; clock = { now: 1000000 };
  harness = createHarness({ clock }); mockTarget = harness.client;
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  harness.client.halt(); window.removeEventListener('error', browser);
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

describe('F5: a page that crashes while rendering', () => {
  test('the user sees a Russian explanation with a next step; header and footer stay', async () => {
    await mount();
    expect(alert()).not.toBeNull();
    expect(alert().textContent).toContain('Не удалось показать страницу');
    expect(alert().textContent).toContain('Обновите');
    expect(alert().textContent).toContain('в поддержку');
    expect(alert().textContent).not.toMatch(/CANARY|Error|undefined|at Home/);
    expect(container.querySelector('[data-testid="site-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="site-footer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="home"]')).toBeNull();
    expect(container.querySelector('main#main-content')).not.toBeNull();
  });

  test('exactly one site_error_occurred kind=render reaches the wire, without the message or stack', async () => {
    await mount();
    const events = await reports();
    expect(events.map(value => value.properties)).toEqual([{ kind: 'render' }]);
    expect(events[0].route_key).toBe('home');
    expect(harness.wire()).not.toMatch(/CANARY|Home\.js|stack|message/i);
  });

  test('the same error arriving at window «error» later is not counted a second time', async () => {
    await mount();
    await act(async () => { window.dispatchEvent(new ErrorEvent('error', { message: mockBoom.message,
      filename: `${window.location.origin}/static/js/main.js`, error: mockBoom })); });
    const events = await reports();
    expect(events.map(value => value.properties.kind)).toEqual(['render']);
  });

  test('going to another address clears the message; the new page shows, header and footer unchanged', async () => {
    await mount();
    expect(alert()).not.toBeNull();
    await goToPricing();
    expect(alert()).toBeNull();
    expect(container.querySelector('[data-testid="pricing"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="site-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="site-footer"]')).not.toBeNull();
    const events = await reports();
    expect(events.map(value => value.properties.kind)).toEqual(['render']);
  });

  test('a healthy page shows no message and reports no error', async () => {
    mockThrow = false;
    await mount();
    expect(alert()).toBeNull();
    expect(container.querySelector('[data-testid="home"]')).not.toBeNull();
    expect(await reports()).toHaveLength(0);
    expect(harness.names()).toContain('page_viewed');
  });
});

describe('F9: the message is for everyone, the report only with consent', () => {
  test.each(['rejected', 'undecided'])('with %s consent the fallback shows and nothing is sent', async state => {
    document.cookie = 'userCookieConsent=; Max-Age=0; Path=/'; document.cookie = 'lunariaAnalyticsPolicy=; Max-Age=0; Path=/';
    if (state === 'rejected') document.cookie = 'userCookieConsent=false; Path=/';
    sessionStorage.clear(); localStorage.clear();
    await mount();
    expect(alert()).not.toBeNull();
    expect(alert().textContent).toContain('Не удалось показать страницу');
    await harness.settle();
    expect(harness.transport.mock.calls.filter(([url]) => url.endsWith('/events'))).toEqual([]);
    expect(sessionStorage.getItem('lunaria.product-analytics.errors')).toBeNull();
  });
});

describe('F10 (guard): the boundary does not depend on analytics', () => {
  test('with analytics throwing, the fallback is still shown and the shell stays', async () => {
    mockTarget = new Proxy({ refresh: jest.fn(), pause: jest.fn(), pageLeave: jest.fn() }, {
      get: (target, key) => key in target ? target[key] : () => { throw new Error('analytics is down'); } });
    await mount();
    expect(alert()).not.toBeNull();
    expect(alert().textContent).toContain('Не удалось показать страницу');
    expect(container.querySelector('[data-testid="site-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="site-footer"]')).not.toBeNull();
  });
});
