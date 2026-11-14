// METRICS-2 regression F1 (policy side): closed lists for the new events.
// F2 (forum campaign sources) was removed by the owner on 2026-11-14: CAMPAIGN_SOURCES stays as on base.
import {safeClientEvent, CLIENT_EVENTS, SERVER_EVENTS} from './productPolicy';

const eventId = '3c3d19c9-6cc6-48c6-840d-962bda4fde25';
const sessionId = '88e92b7f-1699-4646-b2c1-0f793148f183';
const event = (overrides = {}) => safeClientEvent({eventId, sessionId, name: 'page_viewed', routeKey: 'chart_view', ...overrides});
const OBJECTS = ['point', 'house', 'aspect'];
const sorted = value => [...value].sort();

describe('F1: new client events', () => {
  test('wheel_tooltip_opened and wheel_question_selected allow only the kind of object', () => {
    for (const name of ['wheel_tooltip_opened', 'wheel_question_selected']) {
      expect(Object.keys(CLIENT_EVENTS[name] || {})).toEqual(['object']);
      expect(sorted(CLIENT_EVENTS[name].object)).toEqual(sorted(OBJECTS));
      for (const object of OBJECTS) expect(event({name, properties: {object}})).not.toBeNull();
    }
  });

  test('site_error_occurred allows only the kind of error', () => {
    expect(Object.keys(CLIENT_EVENTS.site_error_occurred || {})).toEqual(['kind']);
    expect(sorted(CLIENT_EVENTS.site_error_occurred.kind)).toEqual(['render', 'request', 'script']);
    for (const kind of ['render', 'script', 'request']) {
      expect(event({name: 'site_error_occurred', properties: {kind}})).not.toBeNull();
    }
  });

  test.each([
    ['wheel_tooltip_opened', {object: 'point'}],
    ['wheel_question_selected', {object: 'house'}],
    ['site_error_occurred', {kind: 'script'}],
  ])('%s rejects text, planet or sign names, extra and missing keys', (name, ok) => {
    expect(event({name, properties: ok})).not.toBeNull();
    const key = Object.keys(ok)[0];
    for (const value of ['Солнце', 'Лев', '7', 'Cannot read properties of undefined', 'https://mylunariaai.com/my-charts', '']) {
      expect(event({name, properties: {[key]: value}})).toBeNull();
    }
    expect(event({name, properties: {...ok, message: 'CANARY_ERROR_TEXT'}})).toBeNull();
    expect(event({name, properties: {...ok, planet: 'Venus'}})).toBeNull();
    expect(event({name, properties: {...ok, stack: 'at x (main.js:1)'}})).toBeNull();
    expect(event({name, properties: {}})).toBeNull();
  });
});

describe('F1: new server facts are mirrored and the browser cannot forge them', () => {
  test('SERVER_EVENTS carries the three new facts exactly as the backend contract', () => {
    expect(SERVER_EVENTS.guest_chart_saved).toBeDefined();
    expect(Object.keys(SERVER_EVENTS.guest_chart_saved)).toEqual(['method']);
    expect(sorted(SERVER_EVENTS.guest_chart_saved.method)).toEqual(['email', 'google']);
    expect(SERVER_EVENTS.payment_failed).toBeDefined();
    expect(sorted(Object.keys(SERVER_EVENTS.payment_failed))).toEqual(['provider', 'stage']);
    expect(sorted(SERVER_EVENTS.payment_failed.provider)).toEqual(['lava', 'stripe']);
    expect(sorted(SERVER_EVENTS.payment_failed.stage)).toEqual(['checkout', 'confirmation', 'first_payment', 'renewal']);
    expect(SERVER_EVENTS.free_limit_would_block).toBeDefined();
    expect(Object.keys(SERVER_EVENTS.free_limit_would_block)).toEqual(['resource']);
    expect(sorted(SERVER_EVENTS.free_limit_would_block.resource)).toEqual(['chart', 'question']);
  });

  test.each([
    ['guest_chart_saved', {method: 'email'}],
    ['payment_failed', {provider: 'stripe', stage: 'renewal'}],
    ['free_limit_would_block', {resource: 'chart'}],
  ])('browser cannot send the server fact %s', (name, properties) => {
    expect(event({name, properties})).toBeNull();
    expect(CLIENT_EVENTS[name]).toBeUndefined();
  });
});

test('guard: the campaign source list is unchanged by METRICS-2', () => {
  const {CAMPAIGN_SOURCES} = require('./productPolicy');
  expect(CAMPAIGN_SOURCES).toEqual(['unspecified', 'telegram', 'instagram', 'vk', 'youtube', 'other']);
});
