// FE-PAY-TIDY: a lost connection at the start of a payment says "do not pay twice"; any other request keeps the old text.
import { billingRequest } from './stripe';
import { lavaRequest } from './lava';
import { CHECKOUT_NETWORK_TEXT, NETWORK_ERROR_TEXT } from './apiError';

let originalFetch;
beforeEach(() => { originalFetch = global.fetch; localStorage.setItem('access_token', 'jwt'); });
afterEach(() => { global.fetch = originalFetch; localStorage.clear(); jest.restoreAllMocks(); });

test.each([
  ['stripe checkout', () => billingRequest('checkout', 'jwt', 'premium_year'), CHECKOUT_NETWORK_TEXT],
  ['lava checkout', () => lavaRequest('checkout', 'jwt', 'premium_year'), CHECKOUT_NETWORK_TEXT],
  ['stripe portal', () => billingRequest('portal', 'jwt'), NETWORK_ERROR_TEXT],
  ['lava cancel', () => lavaRequest('cancel', 'jwt'), NETWORK_ERROR_TEXT],
])('%s: the connection breaks — one request, the right text', async (_name, call, text) => {
  global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
  await expect(call()).rejects.toThrow(text);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([
  ['stripe', () => billingRequest('checkout', 'jwt', 'premium_year')],
  ['lava', () => lavaRequest('checkout', 'jwt', 'premium_year')],
])('%s checkout: an abort stays an abort, not "no connection"', async (_name, call) => {
  const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  global.fetch = jest.fn(async () => { throw abort; });
  await expect(call()).rejects.toBe(abort);
});
