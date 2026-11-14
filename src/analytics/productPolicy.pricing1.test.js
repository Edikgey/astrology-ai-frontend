// PRICING-1 regression FE-6 (policy side, DESIGN §4): closed lists for the new events.
// The backend list is changed first (a foreign name or value makes the backend answer 422 for the whole batch).
import { safeClientEvent, CLIENT_EVENTS, SERVER_EVENTS } from './productPolicy';

const eventId = '3c3d19c9-6cc6-48c6-840d-962bda4fde25';
const sessionId = '88e92b7f-1699-4646-b2c1-0f793148f183';
const event = (overrides = {}) => safeClientEvent({ eventId, sessionId, name: 'page_viewed', routeKey: 'pricing', ...overrides });
const sorted = value => [...value].sort();
const PRODUCTS = ['premium_month', 'premium_year', 'question_pack'];
const MOMENTS = ['chart_limit', 'last_free_question', 'question_limit'];

describe('new client events carry one closed value and nothing else', () => {
  test.each([
    ['offer_moment_shown', 'moment', MOMENTS],
    ['offer_option_selected', 'option', PRODUCTS],
  ])('%s allows only %s from the closed list', (name, key, values) => {
    expect(Object.keys(CLIENT_EVENTS[name] || {})).toEqual([key]);
    expect(sorted(CLIENT_EVENTS[name][key])).toEqual(values);
    for (const value of values) expect(event({ name, properties: { [key]: value } })).not.toBeNull();
  });

  test.each([
    ['offer_moment_shown', 'moment', 'question_limit'],
    ['offer_option_selected', 'option', 'premium_year'],
  ])('%s rejects prices, ids, text, extra and missing keys', (name, key, good) => {
    expect(event({ name, properties: { [key]: good } })).not.toBeNull();
    for (const value of ['69.99', '$69.99', '4790', 'price_CANARY', 'cs_live_CANARY', 'Premium на год', '+50 вопросов', 'user@example.test', '']) {
      expect(event({ name, properties: { [key]: value } })).toBeNull();
    }
    expect(event({ name, properties: { [key]: good, amount: 6999 } })).toBeNull();
    expect(event({ name, properties: { [key]: good, price_id: 'price_CANARY' } })).toBeNull();
    expect(event({ name, properties: { [key]: good, provider: 'stripe' } })).toBeNull();
    expect(event({ name, properties: {} })).toBeNull();
  });

  test('the moment and option lists do not leak into each other', () => {
    expect(event({ name: 'offer_moment_shown', properties: { moment: 'premium_year' } })).toBeNull();
    expect(event({ name: 'offer_option_selected', properties: { option: 'question_limit' } })).toBeNull();
  });
});

describe('new server facts are mirrored as the backend contract and the browser cannot forge them', () => {
  test('question_pack_purchased and annual_plan_started carry only the provider', () => {
    for (const name of ['question_pack_purchased', 'annual_plan_started']) {
      expect(SERVER_EVENTS[name]).toBeDefined();
      expect(Object.keys(SERVER_EVENTS[name])).toEqual(['provider']);
      expect(sorted(SERVER_EVENTS[name].provider)).toEqual(['lava', 'stripe']);
    }
  });

  test('checkout_initiated gains exactly one closed property: the product', () => {
    expect(Object.keys(SERVER_EVENTS.checkout_initiated)).toEqual(['provider', 'product']);
    expect(sorted(SERVER_EVENTS.checkout_initiated.provider)).toEqual(['lava', 'stripe']);
    expect(sorted(SERVER_EVENTS.checkout_initiated.product)).toEqual(PRODUCTS);
  });

  test.each(['question_pack_purchased', 'annual_plan_started', 'checkout_initiated'])('the browser cannot forge %s', name => {
    expect(event({ name, properties: { provider: 'stripe' } })).toBeNull();
    expect(event({ name, properties: { provider: 'stripe', product: 'question_pack' } })).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(CLIENT_EVENTS, name)).toBe(false);
  });
});

test('guard: the existing offer events keep their exact shape', () => {
  expect(CLIENT_EVENTS.premium_offer_viewed).toEqual({});
  expect(Object.keys(CLIENT_EVENTS.payment_provider_selected)).toEqual(['provider']);
  expect(sorted(CLIENT_EVENTS.payment_provider_selected.provider)).toEqual(['lava', 'stripe']);
  expect(event({ name: 'premium_offer_viewed', properties: {} })).not.toBeNull();
  expect(event({ name: 'payment_provider_selected', properties: { provider: 'lava' } })).not.toBeNull();
});
