// PRICING-1 regression FE-6 (component side, DESIGN §4): what leaves the browser when an offer is shown or chosen.
// A real analytics client sits behind the module; assertions are on the records that would be sent.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider, useUsage } from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import AskGptForm from './AskGptForm';
import { loadStripe } from '@stripe/stripe-js';
import { createHarness } from '../analytics/metrics2Harness';
import { saveConsent } from '../analytics/consent';

let mockTarget, mockAuth, limit;
jest.mock('../analytics/productAnalytics', () => {
  const real = jest.requireActual('../analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }) => children,
  EmbeddedCheckout: () => <div>Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const FLAGS = { stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 3, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false, ...FLAGS };
const PREMIUM = { ...FREE, plan: 'premium', saved_charts_limit: 10, gpt_messages_limit: 300, gpt_messages_used: 300,
  gpt_messages_available: 0, gpt_limit_type: 'billing_period', plan_interval: 'month',
  current_period_start: '2026-11-12T00:00:00', current_period_end: '2026-12-12T00:00:00',
  gpt_messages_reset_at: '2026-12-12T00:00:00', payment_provider: 'stripe', subscription_status: 'active',
  stripe_checkout_available: false, lava_checkout_available: false };
const BETA = { ...FREE, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
  gpt_messages_available: null, gpt_limit_type: 'unlimited' };
const SESSION = { session_id: 'cs_live_CANARY_SESSION', client_secret: 'cs_live_CANARY_SESSION_secret_CANARY_SECRET' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, serverUsage, harness, tab;
beforeEach(async () => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  localStorage.setItem('access_token', 'jwt');
  harness = createHarness(); mockTarget = harness.client;
  await harness.start('/natal-chart-result');
  await harness.settle();
  harness.transport.mockClear();
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  serverUsage = { ...FREE };
  tab = { opener: {}, close: jest.fn(), location: {} };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return ok(serverUsage);
    if (url.includes('/gpt-messages')) return ok([{ role: 'gpt', content: 'Saved answer' }]);
    if (url.endsWith('/payments/stripe/checkout')) return ok(SESSION);
    if (url.endsWith('/payments/lava/checkout')) return ok({ url: 'https://pay.example.test/CANARY_INVOICE' });
    throw new Error(`Unexpected request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  harness.client.halt(); jest.restoreAllMocks(); localStorage.clear(); sessionStorage.clear();
});
const Probe = () => { limit = useUsage().handleLimitError; return null; };
const render = async (page = <UsageSummary />) => act(async () => root.render(<UsageProvider><Probe />{page}</UsageProvider>));
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
const pay = async (title, provider) => {
  const found = optionButton(container.querySelector('dialog[open]'), title, provider);
  if (!found) throw new Error(`The page offers no "${provider}" payment button for the option "${title}"`);
  await click(found);
};
const props = async name => { await harness.settle(); return harness.named(name).map(value => value.properties); };
const limitError = (code, plan) => ({ code: code.toLowerCase(), detail: { code, plan, used: 10, limit: 10 } });

describe('offer_option_selected: the chosen product, with the provider event unchanged', () => {
  test.each([
    ['Premium на месяц', /Stripe/i, 'premium_month', 'stripe'],
    ['Premium на год', /Stripe/i, 'premium_year', 'stripe'],
    ['+50 вопросов', /Stripe/i, 'question_pack', 'stripe'],
    ['Premium на год', /RUB|₽|рубл|Lava/i, 'premium_year', 'lava'],
    ['+50 вопросов', /RUB|₽|рубл|Lava/i, 'question_pack', 'lava'],
  ])('%s via %s reports option %s once and payment_provider_selected for %s', async (title, provider, option, providerName) => {
    await render(); await clickText('Перейти на Premium');
    await pay(title, provider);
    expect(await props('offer_option_selected')).toEqual([{ option }]);
    expect(await props('payment_provider_selected')).toEqual([{ provider: providerName }]);
  });
});

describe('offer_moment_shown: once per moment per page show, only when an offer is really shown', () => {
  test('the free question limit: question_limit, and a second refusal on the same page does not repeat it', async () => {
    await render();
    await act(async () => limit(limitError('GPT_LIMIT_REACHED', 'free')));
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'question_limit' }]);
    await clickText('Закрыть');
    await act(async () => limit(limitError('GPT_LIMIT_REACHED', 'free')));
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'question_limit' }]);
  });

  test('the free chart limit: chart_limit', async () => {
    await render();
    await act(async () => limit(limitError('CHART_LIMIT_REACHED', 'free')));
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'chart_limit' }]);
  });

  test('the Premium question limit shows a pack: question_limit; the Premium chart limit shows no offer and reports none', async () => {
    serverUsage = { ...PREMIUM, saved_charts_used: 10 };
    await render();
    await act(async () => limit(limitError('CHART_LIMIT_REACHED', 'premium')));
    expect(await props('offer_moment_shown')).toEqual([]);
    await clickText('Закрыть');
    await act(async () => limit(limitError('GPT_LIMIT_REACHED', 'premium')));
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'question_limit' }]);
  });

  test('the last free question: last_free_question when the line appears, not again on a refresh of the same state', async () => {
    serverUsage = { ...FREE, gpt_messages_used: 8, gpt_messages_available: 2 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    expect(await props('offer_moment_shown')).toEqual([]);
    serverUsage = { ...FREE, gpt_messages_used: 9, gpt_messages_available: 1 };
    global.fetch.mockResolvedValueOnce(ok({ response: 'New answer' }));
    await clickText('Спросить');
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'last_free_question' }]);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(await props('offer_moment_shown')).toEqual([{ moment: 'last_free_question' }]);
  });

  test('beta on: no offer is shown, so no offer event leaves the browser', async () => {
    serverUsage = { ...BETA, gpt_messages_available: 1 };
    await render(<AskGptForm chartId={7} initialQuestion="Q" />);
    await act(async () => limit(limitError('GPT_LIMIT_REACHED', 'free')));
    await act(async () => limit(limitError('CHART_LIMIT_REACHED', 'free')));
    await harness.settle();
    expect(harness.names().filter(name => name.startsWith('offer_'))).toEqual([]);
  });
});

test('nothing about money or sessions leaves the browser: only closed values, no price, id, secret or link', async () => {
  await render(); await clickText('Перейти на Premium');
  await pay('Premium на год', /Stripe/i);
  await harness.settle();
  const offer = harness.records().filter(value => value.name.startsWith('offer_'));
  expect(offer.length).toBeGreaterThanOrEqual(1);
  for (const value of offer) expect(Object.keys(value.properties)).toHaveLength(1);
  expect(harness.wire()).not.toMatch(/CANARY|69\.99|4\s?790|4\.99|\bcs_|price_|pay\.example|jwt/);
});
