// PRICING-1 regression FE-4 and FE-5 (DESIGN §4, §9): payment by product and the pack success rule.
// The browser sends only the product name; success text comes only from the server's /account/usage.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider, useUsage } from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import { loadStripe } from '@stripe/stripe-js';

let mockAuth, mockOptions, limit;
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ options, children }) => { mockOptions = options; return children; },
  EmbeddedCheckout: () => <div data-testid="stripe-fields">Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const FLAGS = { stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false, ...FLAGS };
const PREMIUM = { ...FREE, plan: 'premium', saved_charts_limit: 10, gpt_messages_limit: 300, gpt_messages_used: 300,
  gpt_messages_available: 0, gpt_limit_type: 'billing_period', plan_interval: 'month',
  current_period_start: '2026-11-12T00:00:00', current_period_end: '2026-12-12T00:00:00',
  gpt_messages_reset_at: '2026-12-12T00:00:00', payment_provider: 'stripe', subscription_status: 'active',
  stripe_checkout_available: false, lava_checkout_available: false };
const SESSION = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const INVOICE = { url: 'https://pay.example.test/invoice' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
const fail = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) });
let root, container, originalFetch, serverUsage, tab, checkoutReply;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem('access_token', 'jwt');
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  serverUsage = { ...FREE }; mockOptions = null; checkoutReply = null;
  tab = { opener: {}, close: jest.fn(), location: {} };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return ok(serverUsage);
    if (url.endsWith('/payments/stripe/checkout')) return checkoutReply ? checkoutReply() : ok(SESSION);
    if (url.endsWith('/payments/lava/checkout')) return checkoutReply ? checkoutReply() : ok(INVOICE);
    throw new Error(`Unexpected request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers(); window.history.replaceState({}, '', '/');
});
const Probe = () => { limit = useUsage().handleLimitError; return null; };
const render = async () => act(async () => root.render(
  <UsageProvider><Probe /><UsageSummary /><textarea defaultValue="Pending question" /></UsageProvider>));
const flat = el => el.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const click = async el => act(async () => el.click());
const clickText = async text => click([...container.querySelectorAll('button')].find(b => b.textContent === text));
const optionButton = (scope, title, provider) => {
  const candidates = [...scope.querySelectorAll('section,article,li,div,fieldset')]
    .filter(el => el.textContent.replace(/[  ]/g, ' ').includes(title) && el.querySelector('button'));
  const deepest = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
  for (const el of deepest) {
    const found = [...el.querySelectorAll('button')].find(b => provider.test(b.textContent));
    if (found) return found;
  }
  return undefined;
};
const STRIPE = /Stripe/i;
const need = (scope, title, provider) => {
  const found = optionButton(scope, title, provider);
  if (!found) throw new Error(`The page offers no "${provider}" payment button for the option "${title}"`);
  return found;
};
const LAVA = /RUB|₽|рубл|Lava/i;
const YEAR = 'Premium на год', PACK = '+50 вопросов', MONTH = 'Premium на месяц';
const openOffers = async () => { await render(); await clickText('Перейти на Premium'); };
const openPremiumPackOffer = async () => {
  serverUsage = { ...PREMIUM }; await render();
  await act(async () => limit({ code: 'gpt_limit_reached', detail: { code: 'GPT_LIMIT_REACHED', plan: 'premium', used: 300, limit: 300 } }));
};
const posts = path => global.fetch.mock.calls.filter(([url, options]) => url.endsWith(path) && options?.method === 'POST');
const productOf = call => call[1].body ? JSON.parse(call[1].body).product : 'premium_month';
const stripeDialog = () => container.querySelector('.stripe-checkout-modal');

describe('FE-4: Stripe by product', () => {
  test.each([[YEAR, 'premium_year'], [PACK, 'question_pack'], [MONTH, 'premium_month']])(
    '%s sends only the product name, never a price, and mounts the embedded checkout from the server secret', async (title, product) => {
      await openOffers();
      await click(need(container.querySelector('dialog[open]'), title, STRIPE));
      const calls = posts('/payments/stripe/checkout');
      expect(calls).toHaveLength(1);
      expect(productOf(calls[0])).toBe(product);
      if (calls[0][1].body) expect(Object.keys(JSON.parse(calls[0][1].body))).toEqual(['product']);
      expect(mockOptions.clientSecret).toBe(SESSION.client_secret);
      expect(stripeDialog().open).toBe(true);
      expect(container.querySelector('textarea').value).toBe('Pending question');
    });

  test('the embedded checkout of the annual plan names the annual price and yearly renewal, not the monthly terms', async () => {
    await openOffers();
    await click(need(container.querySelector('dialog[open]'), YEAR, STRIPE));
    const text = flat(stripeDialog());
    expect(text).toContain('$69.99');
    expect(text).toContain('Продление раз в год');
    expect(text).not.toContain('$9.99');
    expect(text).not.toContain('Автоматическое продление каждый месяц');
  });

  test('the embedded checkout of a pack names the pack, the one-time price and no renewal', async () => {
    await openOffers();
    await click(need(container.querySelector('dialog[open]'), PACK, STRIPE));
    const text = flat(stripeDialog());
    expect(text).toContain('+50 вопросов');
    expect(text).toContain('$4.99');
    expect(text).toContain('один раз');
    expect(text).not.toContain('$9.99');
    expect(text).not.toContain('Автоматическое продление каждый месяц');
  });

  test('a double click on one option, or a second option while the first is pending, creates one checkout request', async () => {
    await openOffers();
    let finish; checkoutReply = () => new Promise(resolve => { finish = resolve; });
    const dialog = container.querySelector('dialog[open]');
    const year = need(dialog, YEAR, STRIPE);
    await click(year); await click(year);
    await click(need(dialog, PACK, STRIPE));
    await click(need(dialog, PACK, LAVA));
    expect(posts('/payments/stripe/checkout')).toHaveLength(1);
    expect(posts('/payments/lava/checkout')).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    await act(async () => finish(ok(SESSION)));
    expect(posts('/payments/stripe/checkout')).toHaveLength(1);
  });
});

describe('FE-4: Lava by product', () => {
  test.each([[YEAR, 'premium_year'], [PACK, 'question_pack']])('%s opens one tab at the server URL and sends only the product', async (title, product) => {
    await openOffers();
    await click(need(container.querySelector('dialog[open]'), title, LAVA));
    const calls = posts('/payments/lava/checkout');
    expect(calls).toHaveLength(1);
    expect(productOf(calls[0])).toBe(product);
    if (calls[0][1].body) expect(Object.keys(JSON.parse(calls[0][1].body))).toEqual(['product']);
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(INVOICE.url);
    expect(container.querySelector('textarea').value).toBe('Pending question');
  });

  test('a double click on the annual Lava option opens one checkout and one tab', async () => {
    await openOffers();
    let finish; checkoutReply = () => new Promise(resolve => { finish = resolve; });
    const year = need(container.querySelector('dialog[open]'), YEAR, LAVA);
    await click(year); await click(year);
    expect(posts('/payments/lava/checkout')).toHaveLength(1);
    expect(window.open).toHaveBeenCalledTimes(1);
    await act(async () => finish(ok(INVOICE)));
  });

  test('a refusal of the server is shown in plain Russian on that option; the tab is closed and nothing is granted', async () => {
    await openOffers();
    const text = 'В Lava уже открыта оплата другого тарифа Premium. Завершите её во вкладке Lava или напишите в поддержку: lunariaai.support@gmail.com. Не оплачивайте оба.';
    checkoutReply = () => fail(409, text);
    await click(need(container.querySelector('dialog[open]'), YEAR, LAVA));
    expect(flat(container.querySelector('dialog[open]'))).toContain(text);
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBeUndefined();
    expect(container.textContent).toContain('План: Бесплатно');
  });
});

describe('FE-4: what the modal offers follows the server flags and the beta', () => {
  test('each provider flag shows or hides its own button; an option with no provider is not shown', async () => {
    serverUsage = { ...FREE, stripe_annual_checkout_available: true, lava_annual_checkout_available: false,
      stripe_pack_checkout_available: false, lava_pack_checkout_available: true };
    await openOffers();
    const dialog = container.querySelector('dialog[open]');
    expect(optionButton(dialog, YEAR, STRIPE)).toBeDefined();
    expect(optionButton(dialog, YEAR, LAVA)).toBeUndefined();
    expect(optionButton(dialog, PACK, STRIPE)).toBeUndefined();
    expect(optionButton(dialog, PACK, LAVA)).toBeDefined();
    await act(async () => root.unmount()); root = createRoot(container);
    serverUsage = { ...FREE, stripe_annual_checkout_available: false, lava_annual_checkout_available: false,
      stripe_pack_checkout_available: false, lava_pack_checkout_available: false };
    await openOffers();
    expect(flat(container.querySelector('dialog[open]'))).not.toContain(YEAR);
    expect(flat(container.querySelector('dialog[open]'))).not.toContain(PACK);
  });

  test('guard: an older server without the new flags gives the old modal — month only, two payment cards', async () => {
    const old = { ...FREE };
    for (const key of Object.keys(FLAGS)) delete old[key];
    delete old.pack_questions_remaining; delete old.pack_pending; delete old.plan_interval; delete old.gpt_messages_reset_at;
    serverUsage = old;
    await openOffers();
    const dialog = container.querySelector('dialog[open]');
    expect(dialog.querySelectorAll('.payment-option')).toHaveLength(2);
    expect(flat(dialog)).not.toContain(YEAR);
    expect(flat(dialog)).not.toContain(PACK);
  });

  test('guard: during the beta the modal keeps the old Premium offer and adds neither year nor pack, whatever the flags say', async () => {
    serverUsage = { ...FREE, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
      gpt_messages_available: null, gpt_limit_type: 'unlimited' };
    await openOffers();
    const dialog = container.querySelector('dialog[open]');
    expect(flat(dialog)).toContain('Покупка Premium необязательна');
    expect(dialog.querySelectorAll('.payment-option')).toHaveLength(2);
    expect(flat(dialog)).not.toContain(YEAR);
    expect(flat(dialog)).not.toContain(PACK);
    expect(flat(dialog)).not.toMatch(/пакет/i);
  });
});

describe('FE-5: «Пакет добавлен» only from the server', () => {
  test('completing the payment, a pending pack or a growing balance with a pending flag never show success; only pending cleared and balance up do', async () => {
    jest.useFakeTimers();
    serverUsage = { ...FREE, pack_questions_remaining: 20, pack_pending: false };
    await openOffers();
    await click(need(container.querySelector('dialog[open]'), PACK, STRIPE));
    serverUsage = { ...FREE, pack_questions_remaining: 20, pack_pending: true };
    await act(async () => mockOptions.onComplete());
    expect(container.textContent).not.toContain('Пакет добавлен');
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...FREE, pack_questions_remaining: 70, pack_pending: true };
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...FREE, pack_questions_remaining: 20, pack_pending: false };
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...FREE, pack_questions_remaining: 70, pack_pending: false };
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).toContain('Пакет добавлен: +50 вопросов.');
  });

  test('a Premium buyer is not told «Premium активирован» for a pack: the poll waits for the pack, not for the plan', async () => {
    jest.useFakeTimers();
    await openPremiumPackOffer();
    await click(need(container.querySelector('dialog[open]'), PACK, STRIPE));
    expect(posts('/payments/stripe/checkout')).toHaveLength(1);
    expect(productOf(posts('/payments/stripe/checkout')[0])).toBe('question_pack');
    serverUsage = { ...PREMIUM, pack_pending: true };
    await act(async () => mockOptions.onComplete());
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).not.toMatch(/Premium активирован|Premium подтверждён/);
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...PREMIUM, pack_pending: false, pack_questions_remaining: 50, gpt_messages_available: 0 };
    await act(async () => jest.advanceTimersByTime(3000));
    expect(container.textContent).toContain('Пакет добавлен: +50 вопросов.');
    expect(container.textContent).not.toMatch(/Premium активирован|Premium подтверждён/);
  });

  test('guard: coming back to the site while the server still marks the pack as pending shows no success', async () => {
    jest.useFakeTimers();
    serverUsage = { ...FREE, pack_pending: true };
    window.history.replaceState({}, '', '/my-charts?billing=stripe');
    await render();
    await act(async () => jest.advanceTimersByTime(6000));
    expect(container.textContent).not.toContain('Пакет добавлен');
    expect(container.textContent).toContain('План: Бесплатно');
  });
});
