// PRICING-BETA-SALE FS-3 (DESIGN §2, §4): the embedded checkout of the year and of the pack, inside and outside the beta.
// Real providers and UsageProvider, mocked network; the notes come from the table of decision 41.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { UsageProvider } from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import { loadStripe } from '@stripe/stripe-js';

let mockAuth;
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }) => children,
  EmbeddedCheckout: () => <div data-testid="stripe-fields">Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false,
  stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const BETA = { free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null, gpt_messages_available: null, gpt_limit_type: 'unlimited' };
const SESSION = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const PREFIX = 'Во время бета-теста карты и AI-вопросы доступны бесплатно без лимита.';
const MONTH_NOTE = `${PREFIX} Покупка Premium необязательна и оформляет платную подписку с ежемесячным продлением.`;
const YEAR_NOTE = `${PREFIX} Покупка Premium на год необязательна и оформляет платную подписку с ежегодным продлением.`;
const PACK_NOTE = `${PREFIX} Покупка пакета необязательна: его вопросы не тратятся до конца бета-теста и не сгорают.`;
const count = (text, part) => text.split(part).length - 1;
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, serverUsage;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem('access_token', 'jwt');
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  serverUsage = { ...FREE };
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
  localStorage.clear(); jest.restoreAllMocks();
});
const flat = el => el.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const click = async el => act(async () => el.click());
// Opens the offers, presses the Stripe button of one option and returns the text of the embedded checkout window.
const checkoutText = async title => {
  await act(async () => root.render(<UsageProvider><UsageSummary /></UsageProvider>));
  await click([...container.querySelectorAll('button')].find(b => b.textContent === 'Перейти на Premium'));
  const option = container.querySelector(`dialog[open] .offer-option[aria-label="${title}"]`);
  if (!option) throw new Error(`The window offers no option "${title}"`);
  await click([...option.querySelectorAll('button')].find(b => /Stripe/.test(b.textContent)));
  return flat(container.querySelector('.stripe-checkout-modal'));
};

describe('FS-3: embedded checkout in the beta', () => {
  beforeEach(() => { serverUsage = { ...FREE, ...BETA }; });

  test('the year names the yearly price, the usual limits outside the beta and its own beta note', async () => {
    const text = await checkoutText('Premium на год');
    expect(text).toContain('$69.99 USD / год · обычные лимиты вне бета-теста: 10 сохранённых карт · 300 AI-вопросов каждый месяц');
    expect(count(text, YEAR_NOTE)).toBe(1);
    expect(text).toContain('Продление раз в год');
    expect(text).not.toContain(MONTH_NOTE);
    expect(text).not.toContain('$9.99');
  });

  test('the pack names the pack, the one-time price and its own beta note: the questions are not spent until the beta ends', async () => {
    const text = await checkoutText('+50 вопросов');
    expect(text).toContain('+50 вопросов');
    expect(text).toContain('$4.99');
    expect(text).toContain('один раз');
    expect(count(text, PACK_NOTE)).toBe(1);
    expect(text).not.toContain(MONTH_NOTE);
    expect(text).not.toContain('обычные лимиты вне бета-теста');
  });

  test('the month keeps its prefix and its own note, once', async () => {
    const text = await checkoutText('Premium на месяц');
    expect(text).toContain('$9.99 USD / месяц · обычные лимиты вне бета-теста: 10 сохранённых карт');
    expect(count(text, MONTH_NOTE)).toBe(1);
  });
});

describe('FS-3: embedded checkout outside the beta', () => {
  test.each([['Premium на год'], ['+50 вопросов'], ['Premium на месяц']])('%s has no beta wording at all', async title => {
    const text = await checkoutText(title);
    expect(text).not.toContain('Во время бета-теста');
    expect(text).not.toContain('вне бета-теста');
  });

  test('the year outside the beta keeps its plain line', async () => {
    const text = await checkoutText('Premium на год');
    expect(text).toContain('$69.99 USD / год · 10 сохранённых карт · 300 AI-вопросов каждый месяц');
  });
});
