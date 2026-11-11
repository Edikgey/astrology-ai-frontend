import {safeClientEvent, safeRouteKey, CLIENT_EVENTS, SERVER_EVENTS} from './productPolicy';

const eventId = '3c3d19c9-6cc6-48c6-840d-962bda4fde25';
const sessionId = '88e92b7f-1699-4646-b2c1-0f793148f183';
const event = (overrides = {}) => safeClientEvent({eventId, sessionId, name: 'page_viewed',
  routeKey: 'home', ...overrides});

test.each([
  ['/', 'home'], ['/pricing', 'pricing'], ['/authorization', 'authorization'],
  ['/try-free', 'chart_creation'], ['/my-charts', 'my_charts'],
  ['/natal-chart-result/91234', 'chart_view'], ['/relationships/new', 'relationship_creation'],
  ['/relationships/87654', 'relationship_view'], ['/privacy', 'privacy'], ['/support', 'support'],
])('reduces %s to a fixed page category', (path, expected) => {
  expect(safeRouteKey(path)).toBe(expected);
});

test.each([
  '/reset-password', '/reset-password?token=CANARY', '/checkout', '/payments/stripe/checkout',
  '/?email=CANARY', '/pricing#CANARY', 'https://mylunariaai.com/my-charts',
  '/relationships/CANARY', '/relationships/1?token=CANARY', '/natal-chart-result/%31',
  '/unknown/CANARY', null, {}, '__proto__', 'constructor',
])('rejects unknown and unsanitized route input %p', path => {
  expect(safeRouteKey(path)).toBeNull();
});

test('serialized client envelope contains no account, URL, form or billing data', () => {
  const record = event({routeKey: safeRouteKey('/relationships/87654')});
  expect(record).toEqual({event_id: eventId, session_id: sessionId, name: 'page_viewed',
    route_key: 'relationship_view', viewport_class: 'unknown', campaign_source: 'unspecified', properties: {}});
  expect(JSON.stringify(record)).not.toMatch(/87654|email|token|referrer|current_url|customer|birth/);
});

test.each(['email', 'birth_date', 'question', 'answer', 'token', '$current_url', '$referrer',
  'user_id', 'customer_id', 'subscription_id', 'client_secret', '__proto__'])
('rejects an entire event if forbidden field %s is supplied', key => {
  const properties = JSON.parse(JSON.stringify({[key]: 'CANARY_PRIVATE'}));
  expect(event({properties})).toBeNull();
});

test.each(Object.keys(SERVER_EVENTS))('browser cannot forge the server fact %s', name => {
  expect(event({name})).toBeNull();
});

test.each(Object.entries(CLIENT_EVENTS))('all approved client events have a bounded schema: %s', (name, schema) => {
  const properties = Object.fromEntries(Object.entries(schema).map(([key, values]) => [key, values[0]]));
  expect(event({name, properties})).not.toBeNull();
  expect(event({name, properties: {...properties, message: 'CANARY_CONVERSATION'}})).toBeNull();
});

test.each([
  {eventId: 'CANARY_TOKEN'}, {sessionId: 'cs_live_CANARY'}, {routeKey: '/my-charts'},
  {name: '$snapshot'}, {name: 'toString'}, {properties: []}, {properties: null},
  {name: 'payment_provider_selected', properties: {provider: 'paddle'}},
  {name: 'ai_answer_failed', properties: {subject: 'natal', reason: 'CANARY_ERROR'}},
  {name: 'ai_answer_failed', properties: {subject: 'natal'}},
])('fails closed for malformed envelope %p', overrides => {
  expect(event(overrides)).toBeNull();
});
