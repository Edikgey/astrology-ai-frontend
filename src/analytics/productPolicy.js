// Explicit product analytics contract. No SDK, DOM observers, storage or network.
export const ANALYTICS_POLICY_VERSION = 'posthog-v1';
export const VIEWPORT_CLASSES = ['small', 'medium', 'large', 'unknown'];
export const CAMPAIGN_SOURCES = ['unspecified', 'telegram', 'instagram', 'vk', 'youtube', 'other'];
export const ROUTE_KEYS = new Set(['home', 'pricing', 'authorization', 'chart_creation',
  'chart_view', 'my_charts', 'relationship_creation', 'relationship_view',
  'terms', 'privacy', 'refunds', 'support']);
const STATIC_ROUTES = {'/': 'home', '/pricing': 'pricing', '/authorization': 'authorization',
  '/try-free': 'chart_creation', '/natal-chart-result': 'chart_view', '/my-charts': 'my_charts',
  '/relationships/new': 'relationship_creation',
  '/terms': 'terms', '/privacy': 'privacy', '/refunds': 'refunds', '/support': 'support'};
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const provider = ['stripe', 'lava'];
const error = ['network', 'unavailable', 'access_denied', 'quota', 'invalid_input', 'cancelled', 'unknown'];
const subject = ['natal', 'relationship'];
const latency = ['under_5s', '5_to_15s', '15_to_30s', 'over_30s'];
const empty = {};
const wheelObject = ['point', 'house', 'aspect'];
export const CLIENT_EVENTS = Object.freeze({
  page_viewed: empty,
  page_leave_hint: empty,
  landing_cta_clicked: {target: ['chart', 'relationships', 'pricing', 'login']},
  landing_demo_selected: empty,
  landing_scroll_reached: {milestone: ['25', '50', '75', '90']},
  engagement_milestone: {milestone: ['30s', '60s']},
  registration_started: {method: ['email', 'google']},
  chart_creation_started: empty,
  chart_creation_failed: {reason: error},
  relationship_creation_started: empty,
  relationship_creation_failed: {reason: error},
  ai_question_started: {subject},
  ai_answer_presented: {subject, latency},
  ai_answer_failed: {subject, reason: error},
  ai_followup_selected: {subject},
  premium_offer_viewed: empty,
  payment_provider_selected: {provider},
  checkout_initiation_failed: {provider, reason: error},
  billing_portal_opened: {provider},
  wheel_tooltip_opened: {object: wheelObject},
  wheel_question_selected: {object: wheelObject},
  site_error_occurred: {kind: ['render', 'script', 'request']},
});

// Paid conversions and successful business writes are server-owned facts.
export const SERVER_EVENTS = Object.freeze({
  registration_completed: {method: ['email', 'google']},
  email_verification_completed: empty,
  login_succeeded: {method: ['email', 'google']},
  password_reset_completed: empty,
  chart_creation_completed: {actor: ['guest', 'account']},
  relationship_creation_completed: empty,
  ai_answer_completed: {subject, latency},
  feedback_submitted: {category: ['idea', 'bug', 'feedback']},
  checkout_initiated: {provider},
  subscription_started: {provider},
  billing_period_paid: {provider},
  subscription_cancel_scheduled: {provider},
  subscription_expired: {provider},
  guest_chart_saved: {method: ['email', 'google']},
  payment_failed: {provider, stage: ['checkout', 'first_payment', 'renewal', 'confirmation']},
  free_limit_would_block: {resource: ['chart', 'question']},
});

export function safeRouteKey(pathname) {
  if (typeof pathname !== 'string') return null;
  // Deliberately do not parse URLs, query parameters, fragments or referrers.
  if (Object.prototype.hasOwnProperty.call(STATIC_ROUTES, pathname)) return STATIC_ROUTES[pathname];
  if (/^\/natal-chart-result\/[1-9][0-9]*$/.test(pathname)) return 'chart_view';
  if (/^\/relationships\/[1-9][0-9]*$/.test(pathname)) return 'relationship_view';
  return null;
}

export function safeClientEvent({eventId, sessionId, name, routeKey, properties = {}, viewportClass = 'unknown', campaignSource = 'unspecified'} = {}) {
  if (!UUID4.test(eventId || '') || !UUID4.test(sessionId || '') || !ROUTE_KEYS.has(routeKey) ||
      !Object.prototype.hasOwnProperty.call(CLIENT_EVENTS, name) || !properties ||
      typeof properties !== 'object' || Array.isArray(properties) || !VIEWPORT_CLASSES.includes(viewportClass) ||
      !CAMPAIGN_SOURCES.includes(campaignSource)) return null;
  const schema = CLIENT_EVENTS[name];
  const keys = Object.keys(schema);
  if (Object.keys(properties).length !== keys.length ||
      keys.some(key => !Object.prototype.hasOwnProperty.call(properties, key) ||
        !schema[key].includes(properties[key]))) return null;
  return {event_id: eventId.toLowerCase(), session_id: sessionId.toLowerCase(), name,
    route_key: routeKey, viewport_class: viewportClass, campaign_source: campaignSource,
    properties: Object.fromEntries(keys.map(key => [key, properties[key]]))};
}
