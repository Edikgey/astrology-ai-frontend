// FE-PAY-CHOICE regression (decision 50, DESIGN §5, test 7): the one-product window sends the same closed events as the list did.
// A real analytics client sits behind the module; assertions are on the records that would be sent.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';
import { UsageProvider } from '../context/UsageContext';
import { ServiceConfigProvider } from '../context/ServiceConfigContext';
import { loadStripe } from '@stripe/stripe-js';
import { createHarness } from '../analytics/metrics2Harness';
import { saveConsent } from '../analytics/consent';
import { FREE, OFFERS, TITLES, STRIPE_METHOD, LAVA_METHOD, cardButton, openDialog, methodButton } from './payChoiceTestKit';

let mockTarget, mockAuth;
jest.mock('../analytics/productAnalytics', () => {
  const real = jest.requireActual('../analytics/productAnalytics');
  const proxy = new Proxy({}, { get: (_, key) => mockTarget[key] });
  return { ...real, productAnalytics: proxy, analyticsHeaders: () => ({}) };
});
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(async () => ({ isolated: true })) }));
jest.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }) => children,
  EmbeddedCheckout: () => <div>Stripe hosted fields</div>,
}));
jest.mock('../api/stripe', () => {
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_live_isolated_fixture';
  return jest.requireActual('../api/stripe');
});

const SESSION = { session_id: 'cs_live_CANARY_SESSION', client_secret: 'cs_live_CANARY_SESSION_secret_CANARY_SECRET' };
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch, harness, tab;
beforeEach(async () => {
  loadStripe.mockResolvedValue({ isolated: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); saveConsent(true);
  localStorage.setItem('access_token', 'jwt');
  harness = createHarness(); mockTarget = harness.client;
  await harness.start('/pricing');
  await harness.settle();
  harness.transport.mockClear();
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  tab = { opener: {}, close: jest.fn(), location: {} };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.includes('/public-config')) return ok({ free_beta_enabled: false, offers: OFFERS });
    if (url.endsWith('/account/usage')) return ok({ ...FREE });
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
const render = async () => act(async () => root.render(
  <ServiceConfigProvider><UsageProvider><PricingPage /></UsageProvider></ServiceConfigProvider>));
const click = async el => act(async () => el.click());
const pay = async (product, method) => {
  await render();
  await click(cardButton(container, TITLES[product]));
  await click(methodButton(openDialog(container), method));
};
const props = async name => { await harness.settle(); return harness.named(name).map(value => value.properties); };

test('Stripe in the window of the year: the chosen product and the provider, once, and no offer moment', async () => {
  await pay('premium_year', STRIPE_METHOD);
  expect(await props('offer_option_selected')).toEqual([{ option: 'premium_year' }]);
  expect(await props('payment_provider_selected')).toEqual([{ provider: 'stripe' }]);
  expect(await props('offer_moment_shown')).toEqual([]);
});

test('Lava in the window of the pack: the chosen product and the provider, once, and no offer moment', async () => {
  await pay('question_pack', LAVA_METHOD);
  expect(await props('offer_option_selected')).toEqual([{ option: 'question_pack' }]);
  expect(await props('payment_provider_selected')).toEqual([{ provider: 'lava' }]);
  expect(await props('offer_moment_shown')).toEqual([]);
});

test('nothing about money or sessions leaves the browser: only closed values, no price, id, secret or link', async () => {
  await pay('premium_year', STRIPE_METHOD);
  await harness.settle();
  const offer = harness.records().filter(value => value.name.startsWith('offer_'));
  expect(offer.length).toBeGreaterThanOrEqual(1);
  for (const value of offer) expect(Object.keys(value.properties)).toHaveLength(1);
  expect(harness.wire()).not.toMatch(/CANARY|69\.99|4\s?790|4\.99|\bcs_|price_|pay\.example|jwt/);
});
