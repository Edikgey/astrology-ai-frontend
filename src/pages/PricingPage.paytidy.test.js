// FE-PAY-TIDY: a Stripe publishable key is missing — the notice names the way and stands only in the Stripe block.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';
import { UsageProvider } from '../context/UsageContext';
import { ServiceConfigProvider } from '../context/ServiceConfigContext';
import { FREE, OFFERS, TITLES, STRIPE_METHOD, LAVA_METHOD, flat, cardButton, openDialog, methodBlock, methodButton } from './payChoiceTestKit';

let mockAuth;
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('../api/stripe', () => {
  delete process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  return jest.requireActual('../api/stripe');
});

const NOTICE = 'Оплата картой любой страны пока не настроена.';
const ok = data => ({ ok: true, status: 200, json: async () => data });
let root, container, originalFetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem('access_token', 'jwt');
  mockAuth = { user: { id: 1 }, token: 'jwt', loading: false };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.includes('/public-config')) return ok({ free_beta_enabled: false, offers: OFFERS });
    if (url.endsWith('/account/usage')) return ok({ ...FREE });
    throw new Error(`Unexpected test request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch; localStorage.clear(); jest.restoreAllMocks();
});

test('no Stripe key: the notice is in the Stripe block only, its button is off, Lava is not blocked, no request', async () => {
  await act(async () => root.render(<ServiceConfigProvider><UsageProvider><PricingPage /></UsageProvider></ServiceConfigProvider>));
  await act(async () => cardButton(container, TITLES.premium_month).click());
  const dialog = openDialog(container);
  expect(flat(methodBlock(dialog, STRIPE_METHOD))).toContain(NOTICE);
  expect(flat(methodBlock(dialog, LAVA_METHOD))).not.toContain('не настроена');
  expect(flat(dialog).split(NOTICE).length - 1).toBe(1);
  expect(flat(dialog)).not.toContain('Оплата пока не настроена.');
  expect(methodButton(dialog, STRIPE_METHOD).disabled).toBe(true);
  expect(methodButton(dialog, LAVA_METHOD).disabled).toBe(false);
  expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});
