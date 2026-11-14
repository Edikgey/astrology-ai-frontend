// PRICING-1 regression FE-1 (DESIGN §4, §9): the pricing page outside the beta.
// Real providers, mocked network: the page may show only what /public-config and /account/usage say.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';
import { UsageProvider } from '../context/UsageContext';
import { ServiceConfigProvider } from '../context/ServiceConfigContext';

let mockAuth;
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const OFFERS = { premium_year: true, question_pack: true, pack_size: 50 };
const FREE = { plan: 'free', free_beta_enabled: false, saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_messages_reserved: 0, gpt_messages_available: 8,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true, lava_checkout_available: true,
  plan_interval: null, gpt_messages_reset_at: null, pack_questions_remaining: 0, pack_pending: false,
  stripe_annual_checkout_available: true, lava_annual_checkout_available: true,
  stripe_pack_checkout_available: true, lava_pack_checkout_available: true };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, publicConfig, serverUsage;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mockAuth = { user: null, token: null, loading: false };
  publicConfig = { free_beta_enabled: false, offers: OFFERS };
  serverUsage = { ...FREE };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.includes('/public-config')) return ok(publicConfig);
    if (url.endsWith('/account/usage')) return ok(serverUsage);
    throw new Error(`Unexpected test request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks(); mockNavigate.mockReset();
});
const signIn = () => { mockAuth = { user: { id: 1 }, token: 'jwt', loading: false }; localStorage.setItem('access_token', 'jwt'); };
const render = async () => act(async () => root.render(
  <ServiceConfigProvider><UsageProvider><PricingPage /></UsageProvider></ServiceConfigProvider>));
const page = () => container.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

describe.each([['guest', false], ['signed-in free account', true]])('FE-1 pricing page outside the beta, %s', (_, signedIn) => {
  beforeEach(() => { if (signedIn) signIn(); });

  test('shows the annual plan with both prices, the monthly equivalent, the saving and what the buyer gets', async () => {
    await render();
    const text = page();
    expect(text).toContain('Premium на год');
    expect(text).toContain('$69.99');
    expect(text).toContain('4 790 ₽');
    expect(text).toContain('$5.83');
    expect(text).toMatch(/выгоднее на \d+ ?%/);
    expect(text).toContain('Те же 300 вопросов каждый месяц');
    expect(text).toContain('Продление раз в год, отмена в любой момент');
  });

  test('shows the one-time question pack: price once, no subscription, never expires', async () => {
    await render();
    const text = page();
    expect(text).toContain('+50 вопросов');
    expect(text).toContain('$4.99');
    expect(text).toContain('399 ₽');
    expect(text).toContain('один раз, без подписки');
    expect(text).toContain('Вопросы не сгорают');
  });

  test('keeps the unchanged monthly plan and promises no trial', async () => {
    await render();
    const text = page();
    expect(text).toContain('$9.99');
    expect(text).toContain('799 ₽');
    expect(text).toContain('Без пробного периода');
    expect(text.replace('Без пробного периода', '')).not.toMatch(/пробн|trial/i);
  });

  test('an option the server does not offer is hidden, not shown as a dead card', async () => {
    publicConfig = { free_beta_enabled: false, offers: { ...OFFERS, premium_year: false } };
    await render();
    expect(page()).not.toContain('Premium на год');
    expect(page()).not.toContain('$69.99');
    expect(page()).toContain('+50 вопросов');
    await act(async () => root.unmount()); root = createRoot(container);
    publicConfig = { free_beta_enabled: false, offers: { ...OFFERS, question_pack: false } };
    await render();
    expect(page()).not.toContain('+50 вопросов');
    expect(page()).not.toContain('$4.99');
    expect(page()).toContain('Premium на год');
  });

  test('an older server without offers shows the page exactly as before: month only', async () => {
    publicConfig = { free_beta_enabled: false };
    await render();
    const text = page();
    expect(text).not.toContain('Premium на год');
    expect(text).not.toContain('+50 вопросов');
    expect(text).toContain('$9.99');
    expect(text).toContain('10 AI-вопросов за всё время аккаунта');
  });

  test('during the free beta the page is the old one and sells nothing new, whatever the offers say', async () => {
    publicConfig = { free_beta_enabled: true, offers: OFFERS };
    serverUsage = { ...FREE, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
      gpt_messages_available: null, gpt_limit_type: 'unlimited' };
    await render();
    const text = page();
    expect(text).toContain('Исследуйте Lunaria без лимитов.');
    expect(text).toContain('Покупка Premium необязательна');
    expect(text).not.toContain('Premium на год');
    expect(text).not.toContain('+50 вопросов');
    expect(text).not.toContain('$69.99');
    expect(text).not.toContain('$4.99');
    expect(text).not.toMatch(/пакет/i);
  });
});

test('FE-1 guard: the account state wins over a stale public config that still lists offers', async () => {
  signIn();
  publicConfig = { free_beta_enabled: false, offers: OFFERS };
  serverUsage = { ...FREE, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null,
    gpt_messages_available: null, gpt_limit_type: 'unlimited' };
  await render();
  expect(page()).toContain('Исследуйте Lunaria без лимитов.');
  expect(page()).not.toContain('Premium на год');
  expect(page()).not.toContain('+50 вопросов');
});
