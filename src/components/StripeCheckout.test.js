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
const free = { plan: 'free', saved_charts_used: 1, saved_charts_limit: 3,
  gpt_messages_used: 2, gpt_messages_limit: 10, gpt_limit_type: 'lifetime',
  gpt_period_valid: true, stripe_checkout_available: true };
const session = { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' };
const premium = { ...free, plan: 'premium', payment_provider: 'stripe', subscription_status: 'active', can_manage_subscription: true };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, serverUsage;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  localStorage.setItem('access_token', 'jwt'); serverUsage = { ...free }; mockOptions = null;
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith('/account/usage')) return ok(serverUsage);
    if (url.endsWith('/checkout')) return ok(session);
    if (url.endsWith('/portal')) return ok({ url: 'https://billing.stripe.com/p/session/fixture' });
    throw new Error('Unexpected request');
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers(); window.history.replaceState({}, '', '/');
});
const render = async () => act(async () => root.render(<UsageProvider><UsageSummary /><textarea defaultValue="Pending question" /></UsageProvider>));
const click = async text => act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === text).click());
const open = async () => { await render(); await click('Перейти на Premium'); await click('Оплатить через Stripe'); };

test('authenticated embedded checkout uses server secret and preserves draft on close', async () => {
  await open();
  expect(loadStripe).toHaveBeenCalledWith('pk_live_isolated_fixture');
  expect(mockOptions.clientSecret).toBe(session.client_secret);
  expect(global.fetch.mock.calls.find(([u]) => u.endsWith('/checkout'))[1]).toEqual({ method: 'POST', headers: { Authorization: 'Bearer jwt' } });
  expect(container.querySelector('.stripe-checkout-modal').open).toBe(true);
  const modal=container.querySelector('.stripe-checkout-modal');
  expect(modal.querySelector('.purchase-disclosures')).toBeNull();
  expect(modal.querySelector('.supplier-disclosure')).toBeNull();
  expect(modal.querySelector('.policy-links')).toBeNull();
  expect(modal.textContent).not.toContain('Viacheslav Ponomarov');
  expect(modal.textContent).toContain('Автоматическое продление каждый месяц.');
  expect(container.querySelector('[data-testid="stripe-fields"]').previousElementSibling.textContent).toContain('Мои карты');
  expect(container.querySelector('input')).toBeNull();
  await click('Закрыть оплату');
  expect(container.querySelector('.stripe-checkout-modal')).toBeNull();
  expect(container.querySelector('textarea').value).toBe('Pending question');
  expect(container.textContent).toContain('План: Бесплатно');
});
test('completion grants nothing until server confirms Premium', async () => {
  jest.useFakeTimers(); await open();
  await act(async () => mockOptions.onComplete());
  expect(container.textContent).toContain('План: Бесплатно');
  serverUsage = { ...free, plan: 'premium', payment_provider: 'stripe', gpt_messages_limit: 300, saved_charts_limit: 10 };
  await act(async () => jest.advanceTimersByTime(3000));
  expect(container.textContent).toContain('План: Premium');
});
test('logout while request pending cannot open stale checkout', async () => {
  await render(); await click('Перейти на Premium');
  let finish; global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click('Оплатить через Stripe');
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  await act(async () => finish(ok(session)));
  expect(container.querySelector('.stripe-checkout-modal')).toBeNull();
});
test('guest has no checkout and malformed session cannot mount fields', async () => {
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  expect(global.fetch).not.toHaveBeenCalled();
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false }; localStorage.setItem('access_token', 'jwt');
  await render(); await click('Перейти на Premium'); global.fetch.mockResolvedValueOnce(ok({ session_id: 'cs_test_wrong', client_secret: 'bad' }));
  await click('Оплатить через Stripe');
  expect(container.querySelector('.stripe-checkout-modal')).toBeNull();
  expect(container.textContent).toContain('Не удалось подтвердить параметры оплаты');
  expect(container.querySelector('textarea').value).toBe('Pending question');
});
test('authenticated portal uses server URL and rejects foreign destination', async () => {
  const tab = { opener: {}, location: {}, close: jest.fn() }; jest.spyOn(window, 'open').mockReturnValue(tab);
  serverUsage = { ...premium };
  await render(); await click('Управление подпиской');
  expect(global.fetch.mock.calls.find(([u]) => u.endsWith('/portal'))[1]).toEqual({ method: 'POST', headers: { Authorization: 'Bearer jwt' } });
  expect(tab.opener).toBeNull(); expect(tab.location.href).toBe('https://billing.stripe.com/p/session/fixture');
  global.fetch.mockResolvedValueOnce(ok({ url: 'https://evil.example/p/session' }));
  await click('Управление подпиской'); expect(tab.close).toHaveBeenCalled();
});

test('blocked popup does not create a portal session', async () => {
  jest.spyOn(window, 'open').mockReturnValue(null); serverUsage = { ...premium };
  await render(); await click('Управление подпиской');
  expect(global.fetch.mock.calls.some(([u]) => u.endsWith('/portal'))).toBe(false);
  expect(container.textContent).toContain('Разрешите всплывающие окна');
});

test('pending portal request is disabled and logout closes its blank tab', async () => {
  const tab = { location: {}, close: jest.fn() }; jest.spyOn(window, 'open').mockReturnValue(tab);
  serverUsage = { ...premium }; await render();
  let finish; global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click('Управление подпиской');
  expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Управление подпиской').disabled).toBe(true);
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  await act(async () => finish(ok({ url: 'https://billing.stripe.com/p/session/fixture' })));
  expect(tab.close).toHaveBeenCalled(); expect(tab.location.href).toBeUndefined();
});

test('return focus refreshes scheduled cancellation date while retaining Premium and portal', async () => {
  serverUsage = { ...premium }; await render();
  serverUsage = { ...premium, cancel_at_period_end: true, scheduled_cancel_at: '2026-11-06T12:00:00', current_period_end: '2026-11-06T12:00:00' };
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(container.textContent).toContain('Продление отключено. Premium сохраняется до');
  expect(container.textContent).toContain('06.11.2026 (UTC)');
  expect(container.textContent).toContain('Управление подпиской');
  serverUsage = { ...free, payment_provider: 'stripe', subscription_status: 'canceled', cancel_at_period_end: true };
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(container.textContent).toContain('Подписка завершена. Действуют лимиты бесплатного плана.');
  expect(container.querySelector('.subscription-management button')).toBeNull();
});

test.each([
  { ...free },
  { ...premium, payment_provider: 'lava', can_cancel_subscription: true },
  { ...premium, payment_provider: 'paddle' },
  { ...premium, payment_provider: null },
  { ...premium, can_manage_subscription: false },
  { ...premium, subscription_status: 'canceled' },
])('ineligible account never shows Stripe portal: %j', async usage => {
  serverUsage = usage; await render();
  expect([...container.querySelectorAll('button')].some(b => b.textContent === 'Управление подпиской')).toBe(false);
  if (usage.payment_provider === 'lava') {
    expect(container.textContent).toContain('Отключить продление Lava');
    expect(container.textContent).not.toContain('не подтверждена');
  } else if (usage.plan === 'premium') {
    expect(container.textContent).toContain('не подтверждена действующая подписка Stripe');
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull();
  }
});
test('return URL cannot grant access and server rollout flag disables checkout', async () => {
  jest.useFakeTimers(); window.history.replaceState({}, '', '/?billing=stripe&session_id=cs_live_fake');
  serverUsage.stripe_checkout_available = false; await render(); await click('Перейти на Premium');
  expect(container.textContent).toContain('План: Бесплатно');
  expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Оплатить через Stripe').disabled).toBe(true);
});


test('beta keeps the existing authenticated Stripe flow and clearly marks the subscription optional', async () => {
  serverUsage = { ...free, free_beta_enabled: true, saved_charts_limit: null, gpt_messages_limit: null };
  await open();
  expect(container.querySelector('[data-testid="stripe-fields"]')).not.toBeNull();
  expect(container.querySelector('.stripe-checkout-modal').textContent).toContain('Покупка Premium необязательна');
  expect(container.textContent).toContain('$9.99 USD / месяц');
  expect(container.textContent).not.toContain(session.client_secret);
  expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/checkout'))).toHaveLength(1);
});
