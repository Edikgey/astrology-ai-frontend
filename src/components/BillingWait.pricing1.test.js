// PRICING-1 round 2 regression (review P2-1, DESIGN §12 last bullets): the screen waits for the product the person
// started paying for in THIS tab (kept in memory only). A stale pack_pending from an old abandoned pack
// (a Lava invoice never paid) must neither replace the Premium wait nor block the pack confirmation.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider } from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import { loadStripe } from '@stripe/stripe-js';

let mockAuth, mockOptions;
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

const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 20, pack_pending: false,
  stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
// The same account once Stripe has confirmed a monthly Premium.
const PREMIUM = { ...FREE, plan: 'premium', payment_provider: 'stripe', subscription_status: 'active', plan_interval: 'month',
  saved_charts_limit: 10, gpt_messages_limit: 300, gpt_limit_type: 'billing_period', gpt_messages_available: 298,
  current_period_start: '2026-11-14T00:00:00', current_period_end: '2026-12-14T00:00:00' };
const SESSION = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
const MONEY_MOVED = /Premium активирован|Premium подтверждён|Пакет добавлен/;
let root, container, originalFetch, serverUsage;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  localStorage.clear(); localStorage.setItem('access_token', 'jwt');
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  mockOptions = null;
  // An old Lava pack invoice was opened and never paid: the server still says pack_pending.
  serverUsage = { ...FREE, pack_pending: true };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return ok(serverUsage);
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
  localStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers(); window.history.replaceState({}, '', '/');
});
const render = async () => act(async () => root.render(<UsageProvider><UsageSummary /></UsageProvider>));
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
const startStripe = async title => {
  await render(); await clickText('Перейти на Premium');
  const found = optionButton(container.querySelector('dialog[open]'), title, /Stripe/i);
  if (!found) throw new Error(`The page offers no Stripe payment button for the option "${title}"`);
  await click(found);
  await act(async () => mockOptions.onComplete());
};
const tick = async (times = 1) => { for (let i = 0; i < times; i += 1) await act(async () => jest.advanceTimersByTime(3000)); };
const usageRequests = () => global.fetch.mock.calls.filter(([url]) => url.endsWith('/account/usage')).length;

describe('a Premium checkout started in this tab is confirmed by Premium, whatever pack_pending says', () => {
  test.each(['Premium на месяц', 'Premium на год'])('%s: stale pack_pending true, then active Premium → «Premium активирован.»', async title => {
    await startStripe(title);
    await tick(2);
    expect(container.textContent).not.toMatch(MONEY_MOVED);
    serverUsage = { ...PREMIUM, pack_pending: true };
    await tick();
    expect(container.textContent).toContain('Premium активирован.');
    expect(container.textContent).not.toContain('Подтверждение оплаты ещё обрабатывается');
    expect(container.textContent).not.toContain('Пакет добавлен');
  });

  test('a stale pack_pending alone never replaces the Premium wait: while the plan is free no pack success is claimed, even if the balance changes', async () => {
    await startStripe('Premium на месяц');
    serverUsage = { ...FREE, pack_pending: true, pack_questions_remaining: 70 };
    await tick(2);
    expect(container.textContent).not.toMatch(MONEY_MOVED);
    serverUsage = { ...FREE, pack_pending: false, pack_questions_remaining: 70 };
    await tick();
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...PREMIUM, pack_pending: true, pack_questions_remaining: 70 };
    await tick();
    expect(container.textContent).toContain('Premium активирован.');
  });

  test('coming back from Stripe (?billing=stripe) with a stale pack_pending still ends with «Premium активирован.»', async () => {
    window.history.replaceState({}, '', '/my-charts?billing=stripe');
    await render();
    expect(container.textContent).not.toMatch(MONEY_MOVED);
    serverUsage = { ...PREMIUM, pack_pending: true };
    await tick();
    expect(container.textContent).toContain('Premium активирован.');
  });
});

describe('a pack checkout started in this tab is confirmed by the balance growth, not by pack_pending or by the plan', () => {
  test('balance grew from 20 to 70 while an old pack still shows pending → «Пакет добавлен: +50 вопросов.»', async () => {
    await startStripe('+50 вопросов');
    await tick();
    expect(container.textContent).not.toContain('Пакет добавлен');
    serverUsage = { ...FREE, pack_pending: true, pack_questions_remaining: 70 };
    await tick();
    expect(container.textContent).toContain('Пакет добавлен: +50 вопросов.');
  });

  test('an unchanged balance is never success, with the pending flag on or off', async () => {
    await startStripe('+50 вопросов');
    await tick();
    serverUsage = { ...FREE, pack_pending: false, pack_questions_remaining: 20 };
    await tick(2);
    expect(container.textContent).not.toMatch(MONEY_MOVED);
  });

  test('Premium appearing meanwhile does not confirm a pack: no «Premium активирован», no «Пакет добавлен» until the balance grows', async () => {
    await startStripe('+50 вопросов');
    serverUsage = { ...PREMIUM, pack_pending: false, pack_questions_remaining: 20 };
    await tick(2);
    expect(container.textContent).not.toMatch(MONEY_MOVED);
    serverUsage = { ...PREMIUM, pack_pending: false, pack_questions_remaining: 70 };
    await tick();
    expect(container.textContent).toContain('Пакет добавлен: +50 вопросов.');
    expect(container.textContent).not.toMatch(/Premium активирован|Premium подтверждён/);
  });
});

describe('the wait is finite and the product is remembered in memory only', () => {
  test.each([['Premium на месяц'], ['+50 вопросов']])('%s: nothing confirms for 60 s → the "still processing" text and the polling stops', async title => {
    await startStripe(title);
    await tick(21);
    expect(container.textContent).toContain('Подтверждение оплаты ещё обрабатывается');
    expect(container.textContent).not.toMatch(MONEY_MOVED);
    const requests = usageRequests();
    await tick(5);
    expect(usageRequests()).toBe(requests);
  });

  test('starting a checkout writes no product marker to localStorage; a reload forgets it', async () => {
    const before = JSON.stringify(Object.entries(localStorage).sort());
    await startStripe('+50 вопросов');
    expect(JSON.stringify(Object.entries(localStorage).sort())).toBe(before);
    await act(async () => root.unmount()); root = createRoot(container);
    serverUsage = { ...FREE, pack_pending: false, pack_questions_remaining: 70 };
    await render();
    await tick(2);
    expect(container.textContent).not.toMatch(MONEY_MOVED);
  });
});
