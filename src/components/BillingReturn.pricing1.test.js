// PRICING-1 round 3 regression (review P2-3, DESIGN §13): the return tab (?billing=lava|stripe) learns the product from the
// single closed `product` parameter the server adds to every return URL. FE-R3-1 … FE-R3-9 as listed in §13.
// The parameter only chooses which confirmation to wait for; access and numbers come only from /account/usage.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider } from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import { loadStripe } from '@stripe/stripe-js';
import { createHarness } from '../analytics/metrics2Harness';
import { saveConsent } from '../analytics/consent';

let mockTarget, mockAuth, mockOptions;
jest.mock('../analytics/productAnalytics', () => {
  const real = jest.requireActual('../analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ options, children }) => { mockOptions = options; return children; },
  EmbeddedCheckout: () => <div>Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 20, pack_pending: false, pack_recently_paid: false,
  stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const premium = provider => ({ ...FREE, plan: 'premium', payment_provider: provider, subscription_status: 'active',
  plan_interval: 'month', saved_charts_limit: 10, gpt_messages_limit: 300, gpt_limit_type: 'billing_period',
  gpt_messages_available: 298, current_period_start: '2026-11-14T00:00:00', current_period_end: '2026-12-14T00:00:00' });
const SESSION = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const ok = data => ({ ok: true, status: 200, json: async () => data });

const PACK_WAIT = 'Проверяем оплату пакета. Не оплачивайте повторно — обновите страницу через минуту.';
const PACK_ADDED = 'Пакет добавлен: +50 вопросов.';
const PACK_STILL_CHECKING = 'Оплата пакета ещё проверяется. Не оплачивайте повторно — обновите страницу через минуту.';
const packCount = n => `Вопросов из пакетов на аккаунте: ${n}. Если оплаченный пакет не появился через несколько минут, напишите в поддержку: lunariaai.support@gmail.com.`;
const PREMIUM_WAIT = { stripe: 'Ожидаем подтверждение Premium от сервера…', lava: 'Ожидаем подтверждение оплаты от сервера…' };
const PREMIUM_DONE = { stripe: 'Premium активирован.', lava: 'Premium подтверждён сервером. Проверьте выбранный способ оплаты в аккаунте.' };
const PREMIUM_TIMEOUT = 'Подтверждение оплаты ещё обрабатывается. Обновите лимиты чуть позже.';
const NO_PREMIUM_TEXT = /Premium активирован|Premium подтверждён|подтверждение Premium|Ожидаем подтверждение|ещё обрабатывается/;

let root, container, originalFetch, serverUsage, harness;
beforeEach(async () => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  localStorage.setItem('access_token', 'jwt');
  harness = createHarness(); mockTarget = harness.client;
  await harness.start('/my-charts'); await harness.settle(); harness.transport.mockClear();
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  mockOptions = null; serverUsage = { ...FREE };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return typeof serverUsage === 'function' ? serverUsage() : ok(serverUsage);
    if (url.endsWith('/payments/stripe/checkout')) return ok(SESSION);
    throw new Error(`Unexpected request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  harness.client.halt(); localStorage.clear(); sessionStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers();
  window.history.replaceState({}, '', '/');
});
const visit = query => window.history.replaceState({}, '', `/my-charts${query}`);
const render = async () => act(async () => root.render(<UsageProvider><UsageSummary /></UsageProvider>));
const flat = () => container.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const tick = async (times = 1) => { for (let i = 0; i < times; i += 1) await act(async () => jest.advanceTimersByTime(3000)); };
const usageRequests = () => global.fetch.mock.calls.filter(([url]) => url.endsWith('/account/usage')).length;
const stops = async () => { const before = usageRequests(); await tick(6); expect(usageRequests()).toBe(before); };

describe('pack mode: product=question_pack in the return address', () => {
  test('FE-R3-1 Lava, Premium account: «Проверяем…» while pending, then «Пакет добавлен» when recently paid; never a Premium text', async () => {
    visit('?billing=lava&status=success&product=question_pack');
    serverUsage = { ...premium('lava'), pack_pending: true, pack_recently_paid: false };
    await render();
    expect(flat()).toContain(PACK_WAIT);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    await tick(2);
    expect(flat()).toContain(PACK_WAIT);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    serverUsage = { ...premium('lava'), pack_pending: false, pack_recently_paid: true, pack_questions_remaining: 70 };
    await tick();
    expect(flat()).toContain(PACK_ADDED);
    expect(flat()).not.toContain(PACK_WAIT);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    await stops();
  });

  test('FE-R3-2 free account, webhook before the return: the first answer already says «Пакет добавлен», no «ещё обрабатывается»', async () => {
    visit('?billing=lava&status=success&product=question_pack');
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: true, pack_questions_remaining: 70 };
    await render();
    await tick();
    expect(flat()).toContain(PACK_ADDED);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    await stops();
  });

  test('FE-R3-3 pending=false and recently_paid=false: the server count and the support line, and no new requests', async () => {
    visit('?billing=lava&status=success&product=question_pack');
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: false, pack_questions_remaining: 33 };
    await render();
    await tick();
    expect(flat()).toContain(packCount(33));
    expect(flat()).not.toContain('Пакет добавлен');
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    await stops();
  });

  test.each([
    ['pending stays true for 21 polls', () => ok({ ...FREE, pack_pending: true, pack_recently_paid: false })],
    ['no answer at all for 21 polls', () => ({ ok: false, status: 500, json: async () => ({ detail: 'Сбой' }) })],
  ])('FE-R3-4 %s: «Оплата пакета ещё проверяется…» and the polling stops', async (_, reply) => {
    visit('?billing=lava&status=success&product=question_pack');
    serverUsage = reply;
    await render();
    await tick(21);
    expect(flat()).toContain(PACK_STILL_CHECKING);
    expect(flat()).not.toContain('Пакет добавлен');
    expect(flat()).not.toMatch(/Premium активирован|Premium подтверждён|подтверждение Premium|Подтверждение оплаты ещё обрабатывается/);
    await stops();
  });

  test('FE-R3-5 Stripe return (redirect, reload) with session_id: pack mode, never «Ожидаем подтверждение Premium»', async () => {
    visit('?billing=stripe&session_id=cs_live_fixture&product=question_pack');
    serverUsage = { ...FREE, pack_pending: true, pack_recently_paid: false };
    await render();
    expect(flat()).toContain(PACK_WAIT);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: true, pack_questions_remaining: 70 };
    await tick();
    expect(flat()).toContain(PACK_ADDED);
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
  });

  test.each([
    ['no recent pack, balance unchanged', { pack_pending: false, pack_recently_paid: false, pack_questions_remaining: 20 }],
    ['no recent pack, balance higher than anything seen', { pack_pending: false, pack_recently_paid: false, pack_questions_remaining: 70 }],
    ['an older server without pack_recently_paid', { pack_pending: false, pack_questions_remaining: 70, pack_recently_paid: undefined }],
  ])('FE-R3-6 a forged product=question_pack with %s: never «Пакет добавлен», limits as the server says', async (_, patch) => {
    visit('?billing=lava&status=success&product=question_pack');
    serverUsage = { ...FREE, ...patch };
    await render();
    await tick(3);
    expect(flat()).not.toContain('Пакет добавлен');
    expect(flat()).not.toMatch(NO_PREMIUM_TEXT);
    expect(flat()).toContain('План: Бесплатно');
    expect(flat()).toContain('AI-вопросы: 2 / 10');
    expect(flat()).toContain('Сохранено карт: 1 / 3');
  });
});

describe('Premium mode: guards — unchanged texts, whatever the pack flags are', () => {
  const returns = [
    ['lava', 'premium_month'], ['lava', 'premium_year'], ['lava', null],
    ['stripe', 'premium_month'], ['stripe', 'premium_year'], ['stripe', null],
  ];
  const query = (provider, product) => `?billing=${provider}${provider === 'lava' ? '&status=success' : '&session_id=cs_live_fixture'}${product ? `&product=${product}` : ''}`;

  test.each(returns)('FE-R3-7 %s return, product %s: waits for Premium and confirms only with plan=premium', async (provider, product) => {
    visit(query(provider, product));
    serverUsage = { ...FREE, pack_pending: true, pack_recently_paid: true };
    await render();
    expect(flat()).toContain(PREMIUM_WAIT[provider]);
    await tick(2);
    expect(flat()).not.toContain('Пакет добавлен');
    expect(flat()).not.toContain('Проверяем оплату пакета');
    serverUsage = { ...premium(provider), pack_pending: true, pack_recently_paid: true };
    await tick();
    expect(flat()).toContain(PREMIUM_DONE[provider]);
    expect(flat()).not.toContain('Пакет добавлен');
  });

  test.each(returns)('FE-R3-7 %s return, product %s: 21 polls without Premium end with the old text and stop', async (provider, product) => {
    visit(query(provider, product));
    await render();
    await tick(21);
    expect(flat()).toContain(PREMIUM_TIMEOUT);
    await stops();
  });

  test.each([
    ['product=foo'], ['product=Question_Pack'], ['product=QUESTION_PACK'], ['product=question_pack&product=question_pack'],
    ['product=question_pack&product=premium_month'], ['product='],
  ])('FE-R3-8 %s behaves as no parameter; the value is neither shown nor sent to analytics', async raw => {
    visit(`?billing=stripe&session_id=cs_live_fixture&${raw}`);
    await render();
    expect(flat()).toContain(PREMIUM_WAIT.stripe);
    expect(flat()).not.toContain('Проверяем оплату пакета');
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: true, pack_questions_remaining: 70 };
    await tick(2);
    expect(flat()).not.toContain('Пакет добавлен');
    serverUsage = premium('stripe');
    await tick();
    expect(flat()).toContain(PREMIUM_DONE.stripe);
    for (const value of raw.split('&').map(part => part.split('=')[1]).filter(Boolean)) {
      if (value === 'question_pack') continue;
      expect(flat()).not.toContain(value);
    }
    await harness.settle();
    expect(harness.wire()).not.toMatch(/foo|Question_Pack|QUESTION_PACK|question_pack/);
  });

  test('FE-R3-8 an unknown value on a Lava return gives the Lava Premium wait', async () => {
    visit('?billing=lava&status=success&product=foo');
    await render();
    expect(flat()).toContain(PREMIUM_WAIT.lava);
    expect(flat()).not.toContain('foo');
  });
});

describe('FE-R3-9 guards: memory beats the address; Lava failed/cancelled stays without a wait', () => {
  test.each(['question_pack', 'premium_month'])('Lava status=failed with product=%s: the old text, one refresh, no polling', async product => {
    visit(`?billing=lava&status=failed&product=${product}`);
    await render();
    expect(flat()).toContain('Оплата не завершена. Можно снова открыть Lava; доступность другого способа проверит сервер.');
    expect(flat()).not.toMatch(/Пакет добавлен|Проверяем оплату пакета|Premium активирован|Premium подтверждён/);
    await stops();
  });

  test('Lava status=cancelled with product=question_pack: the same, and nothing is granted', async () => {
    visit('?billing=lava&status=cancelled&product=question_pack');
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: true, pack_questions_remaining: 70 };
    await render();
    await tick(3);
    expect(flat()).toContain('Оплата не завершена.');
    expect(flat()).not.toContain('Пакет добавлен');
  });

  test('a Premium checkout started in a tab that returned with product=question_pack waits for Premium (the tab memory wins)', async () => {
    visit('?billing=stripe&session_id=cs_live_fixture&product=question_pack');
    serverUsage = { ...FREE, pack_pending: false, pack_recently_paid: false };
    await render();
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Перейти на Premium').click());
    const dialog = container.querySelector('dialog[open]');
    const candidates = [...dialog.querySelectorAll('section,article,li,div,fieldset')].filter(el => el.textContent.includes('Premium на месяц') && el.querySelector('button'));
    const card = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)))[0];
    const start = [...card.querySelectorAll('button')].find(b => /Stripe/i.test(b.textContent));
    await act(async () => start.click());
    await act(async () => mockOptions.onComplete());
    serverUsage = { ...premium('stripe'), pack_recently_paid: true };
    await tick();
    expect(flat()).toContain('Premium активирован.');
    expect(flat()).not.toContain('Пакет добавлен');
  });
});
