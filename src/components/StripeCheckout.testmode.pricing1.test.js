// PRICING-1 slice 0 (DESIGN §10), frontend side: with a pk_test_ key the checkout opens only for a cs_test_ session
// of the same mode. A session of the other mode is refused before any Stripe field is mounted.
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
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const free = { plan: 'free', saved_charts_used: 1, saved_charts_limit: 3, gpt_messages_used: 2, gpt_messages_limit: 10,
  gpt_limit_type: 'lifetime', gpt_period_valid: true, stripe_checkout_available: true };
const TEST_SESSION = { session_id: 'cs_test_fixture', client_secret: 'cs_test_fixture_secret_fixture' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, reply;
beforeEach(() => {
  loadStripe.mockResolvedValue({ isolated: true }); mockOptions = null; reply = TEST_SESSION;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false }; localStorage.setItem('access_token', 'jwt');
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => ok(url.endsWith('/account/usage') ? free : reply));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks();
});
const click = async text => act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === text).click());
const start = async () => {
  await act(async () => root.render(<UsageProvider><UsageSummary /><textarea defaultValue="Pending question" /></UsageProvider>));
  await click('Перейти на Premium'); await click('Оплатить через Stripe');
};

test('pk_test_ key and a cs_test_ session open the embedded checkout with that very key and secret', async () => {
  await start();
  expect(loadStripe).toHaveBeenCalledWith('pk_test_isolated_fixture');
  expect(mockOptions.clientSecret).toBe(TEST_SESSION.client_secret);
  expect(container.querySelector('.stripe-checkout-modal').open).toBe(true);
});

test.each([
  ['a live session', { session_id: 'cs_live_fixture', client_secret: 'cs_live_fixture_secret_fixture' }],
  ['a test secret that belongs to another session', { session_id: 'cs_test_fixture', client_secret: 'cs_test_other_secret_fixture' }],
  ['a session without a mode', { session_id: 'cs_fixture', client_secret: 'cs_fixture_secret_fixture' }],
])('pk_test_ key refuses %s: no Stripe fields, a Russian message, the draft kept', async (_, session) => {
  reply = session;
  await start();
  expect(container.querySelector('.stripe-checkout-modal')).toBeNull();
  expect(mockOptions).toBeNull();
  expect(container.textContent).toContain('Не удалось подтвердить параметры оплаты');
  expect(container.querySelector('textarea').value).toBe('Pending question');
});
