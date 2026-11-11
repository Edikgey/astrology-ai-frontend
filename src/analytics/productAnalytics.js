import {API_URL} from '../config/api';
import {readConsent, isExcluded} from './consent';
import {ANALYTICS_POLICY_VERSION, safeClientEvent, safeRouteKey, CAMPAIGN_SOURCES} from './productPolicy';

const IDENTITY_KEY = 'lunaria.product-analytics.identity';
const SESSION_KEY = 'lunaria.product-analytics.session';
// Essential privacy-control delivery only; never use this queue for analytics.
const PRIVACY_KEY = 'lunaria.analytics.privacy-pending';
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTS = ['mylunariaai.com', 'www.mylunariaai.com'];
const API_HOST = 'astrology-ai-backend-production.up.railway.app';
export const PRODUCT_ANALYTICS_STATE = 'lunaria:product-analytics-state';

export function createProductAnalytics({win = window, config, consent = readConsent,
  excluded = isExcluded, transport = (...args) => fetch(...args), clock = () => Date.now(),
  randomId = () => win.crypto.randomUUID(), getToken = () => win.localStorage.getItem('access_token')} = {}) {
  const options = config || {enabled: process.env.REACT_APP_POSTHOG_ENABLED === 'true',
    production: process.env.NODE_ENV === 'production', apiUrl: API_URL};
  let ready = false, identity = null, actor = null, page = null, lastPage = null;
  let queue = [], seen = new Set(), timer = null, generation = 0, control = null, busy = false;
  const flights = new Set();
  let provider = null;
  let privacyPending = null, privacyFlight = null;
  const read = (storage, key) => {try {return JSON.parse(storage.getItem(key) || 'null');} catch {return null;}};
  const store = (storage, key, value) => {try {storage.setItem(key, JSON.stringify(value)); return true;} catch {return false;}};
  const remove = (storage, key) => {try {storage.removeItem(key);} catch { /* Optional storage. */ }};
  const validIdentity = value => value && UUID4.test(value.visitor_id) && UUID4.test(value.revision) &&
    (value.actor === null || typeof value.actor === 'string');
  function endpoint(path) {
    try {
      const url = new URL(options.apiUrl);
      const local = options.testTransport && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if ((!local && (url.protocol !== 'https:' || url.hostname !== API_HOST)) ||
          url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return null;
      return url.origin + '/analytics/' + path;
    } catch {return null;}
  }
  const eligible = () => options.enabled && options.production &&
    (HOSTS.includes(win.location.hostname) || (options.testTransport && ['localhost', '127.0.0.1'].includes(win.location.hostname))) &&
    consent() === 'accepted' && !excluded() && Boolean(endpoint('events'));
  const canTrack = () => eligible() && ready && validIdentity(identity) && identity.actor === actor;
  const notifyState = () => win.dispatchEvent?.(new Event(PRODUCT_ANALYTICS_STATE));
  const viewport = () => !Number.isFinite(win.innerWidth) ? 'unknown' : win.innerWidth < 640 ? 'small' : win.innerWidth < 1024 ? 'medium' : 'large';
  const campaign = () => {
    const value = new URLSearchParams(win.location.search).get('utm_source');
    return !value ? 'unspecified' : CAMPAIGN_SOURCES.includes(value.toLowerCase()) ? value.toLowerCase() : 'other';
  };
  function session() {
    let value = read(win.sessionStorage, SESSION_KEY);
    const at = clock();
    if (!value || !UUID4.test(value.id) || !Number.isFinite(value.at) || at < value.at || at - value.at >= 1800000) {
      value = {id: randomId(), at, source: campaign()};
    }
    value.at = at;
    if (!UUID4.test(value.id) || !store(win.sessionStorage, SESSION_KEY, value)) return null;
    return value.id;
  }
  function abortEvents() {
    generation += 1;
    ready = false; busy = false; queue = []; seen.clear(); provider = null; lastPage = null;
    if (timer) win.clearTimeout(timer);
    timer = null;
    for (const controller of flights) controller.abort();
    flights.clear();
    control?.abort(); control = null;
    notifyState();
  }
  async function request(path, payload, {signal, revision, keepalive = false} = {}) {
    const url = endpoint(path);
    if (!url) return null;
    const token = getToken();
    return transport(url, {method: 'POST', credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', keepalive, signal,
      headers: {'Content-Type': 'application/json',
        ...(token && token !== 'null' ? {Authorization: `Bearer ${token}`} : {}),
        ...(revision ? {'X-Lunaria-Analytics-Revision': revision} : {})},
      body: JSON.stringify(payload)});
  }
  function pendingControls() {
    if (!privacyPending) {
      const saved = read(win.localStorage, PRIVACY_KEY);
      privacyPending = Array.isArray(saved) ? saved.filter(value => value && UUID4.test(value.visitor_id) &&
        UUID4.test(value.revision) && ['withdraw', 'reset'].includes(value.action)).slice(0, 10) : [];
    }
    return privacyPending;
  }
  function saveControls() {
    if (privacyPending.length) store(win.localStorage, PRIVACY_KEY, privacyPending);
    else remove(win.localStorage, PRIVACY_KEY);
  }
  async function flushControls() {
    if (!options.enabled || !pendingControls().length) return true;
    if (privacyFlight) return privacyFlight;
    privacyFlight = (async () => {
      while (pendingControls().length) {
        const item = {...privacyPending[0]};
        const controller = new AbortController();
        const timeout = win.setTimeout(() => controller.abort(), 5000);
        try {
          const result = await request('consent', {policy_version: ANALYTICS_POLICY_VERSION, ...item},
            {signal: controller.signal, keepalive: true});
          if (!result?.ok) return false;
          privacyPending = privacyPending.filter(value => value.visitor_id !== item.visitor_id ||
            value.revision !== item.revision || value.action !== item.action);
          saveControls();
        } catch {return false;}
        finally {win.clearTimeout(timeout);}
      }
      return true;
    })();
    try {return await privacyFlight;} finally {privacyFlight = null;}
  }
  function revoke(previous, action) {
    if (!validIdentity(previous) || !options.enabled) return;
    const existing = pendingControls().find(value => value.visitor_id === previous.visitor_id && value.revision === previous.revision);
    if (existing) {if (action === 'withdraw') existing.action = action;}
    else if (privacyPending.length < 10) privacyPending.push({visitor_id: previous.visitor_id, revision: previous.revision, action});
    saveControls();
    flushControls().catch(() => {});
  }
  function halt({withdraw = false, resetBrowser = false} = {}) {
    const previous = identity || read(win.localStorage, IDENTITY_KEY);
    abortEvents();
    if (withdraw || resetBrowser) revoke(previous, withdraw ? 'withdraw' : 'reset');
    identity = null;
    remove(win.localStorage, IDENTITY_KEY); remove(win.sessionStorage, SESSION_KEY);
  }
  function pause() {abortEvents();}
  function reset() {
    const previous = identity || read(win.localStorage, IDENTITY_KEY);
    abortEvents(); revoke(previous, 'reset'); identity = null; actor = null;
    remove(win.localStorage, IDENTITY_KEY); remove(win.sessionStorage, SESSION_KEY);
  }
  async function refresh({actorKey = actor, pathname = win.location.pathname, explicit = false} = {}) {
    page = safeRouteKey(pathname);
    if (!eligible()) {
      halt({withdraw: consent() === 'rejected', resetBrowser: excluded() || consent() === 'undecided'});
      await flushControls(); return false;
    }
    if (pendingControls().length && !await flushControls()) return false;
    const nextActor = actorKey === null || actorKey === undefined ? null : String(actorKey);
    if (actor !== null && actor !== nextActor && identity) reset();
    else if (actor !== nextActor) abortEvents();
    actor = nextActor;
    let stored = identity || read(win.localStorage, IDENTITY_KEY);
    if (validIdentity(stored) && stored.actor !== actor) {
      if (stored.actor === null && actor !== null) stored = {...stored, actor};
      else {revoke(stored, 'reset'); stored = null;}
    }
    if (!validIdentity(stored)) stored = {visitor_id: randomId(), revision: randomId(), actor};
    if (explicit) {abortEvents(); stored = {...stored, revision: randomId(), pendingAccept: true};}
    identity = stored;
    if (!validIdentity(stored) || !store(win.localStorage, IDENTITY_KEY, stored)) {halt(); return false;}
    if (canTrack() && !explicit) {pageView(); return true;}
    if (control) return false;
    const epoch = generation, snapshot = identity;
    control = new AbortController();
    const currentControl = control;
    const timeout = win.setTimeout(() => currentControl.abort(), 5000);
    try {
      const result = await request('consent', {policy_version: ANALYTICS_POLICY_VERSION,
        visitor_id: snapshot.visitor_id, revision: snapshot.revision, action: snapshot.pendingAccept ? 'accept' : 'resume'},
        {signal: currentControl.signal});
      const value = result?.ok ? await result.json() : null;
      if (epoch !== generation || !eligible()) return false;
      if (value?.reset_identity) {reset(); return false;}
      ready = value?.accepted === true;
      if (ready) {identity = {...identity, pendingAccept: false}; store(win.localStorage, IDENTITY_KEY, identity); pageView();}
      notifyState();
      return ready;
    } catch {return false;}
    finally {win.clearTimeout(timeout); if (control === currentControl) control = null;}
  }
  function emit(name, properties = {}, flow = null) {
    if (!canTrack() || !page) return false;
    const dedupe = flow && `${name}:${flow}`;
    if (dedupe && seen.has(dedupe)) return false;
    const sessionId = session();
    const record = safeClientEvent({name, properties, routeKey: page, eventId: randomId(), sessionId,
      viewportClass: viewport(), campaignSource: read(win.sessionStorage, SESSION_KEY)?.source || 'unspecified'});
    if (!record) return false;
    if (dedupe) {seen.add(dedupe); if (seen.size > 1000) seen.delete(seen.values().next().value);}
    if (queue.length >= 100) queue.shift();
    queue.push({record, at: clock(), attempts: 0});
    schedule(500);
    return true;
  }
  function pageView() {
    if (page && page !== lastPage && emit('page_viewed')) lastPage = page;
    if (!page) lastPage = null;
  }
  function schedule(delay) {
    if (!timer) timer = win.setTimeout(() => {timer = null; flush();}, delay);
  }
  async function flush({keepalive = false} = {}) {
    if (!canTrack() || busy) return false;
    queue = queue.filter(value => clock() - value.at < 300000 && value.at <= clock() && value.attempts < 3);
    if (!queue.length) return false;
    const batch = queue.slice(0, 20);
    const epoch = generation, snapshot = identity;
    batch.forEach(value => {value.attempts += 1;});
    const controller = new AbortController(); flights.add(controller); busy = true;
    const timeout = win.setTimeout(() => controller.abort(), 5000);
    try {
      const result = await request('events', {policy_version: ANALYTICS_POLICY_VERSION,
        visitor_id: snapshot.visitor_id, events: batch.map(value => value.record)},
        {signal: controller.signal, revision: snapshot.revision, keepalive});
      if (epoch !== generation || !eligible()) return false;
      if ([401, 403, 404].includes(result?.status)) {pause(); return false;}
      if (result?.ok) {const ids = new Set(batch.map(value => value.record.event_id)); queue = queue.filter(value => !ids.has(value.record.event_id));}
      else if (result?.status >= 400 && result.status < 500 && result.status !== 429) {
        const ids = new Set(batch.map(value => value.record.event_id)); queue = queue.filter(value => !ids.has(value.record.event_id));
      }
      return Boolean(result?.ok);
    } catch {return false;}
    finally {
      win.clearTimeout(timeout); flights.delete(controller);
      if (epoch === generation) {busy = false; if (queue.length && canTrack()) schedule(batch.some(value => value.attempts > 1) ? 10000 : 2000);}
    }
  }
  function headers() {
    if (!canTrack()) return {};
    const sessionId = session();
    return sessionId ? {'X-Lunaria-Analytics-Visitor': identity.visitor_id,
      'X-Lunaria-Analytics-Revision': identity.revision, 'X-Lunaria-Analytics-Session': sessionId,
      'X-Lunaria-Analytics-Viewport': viewport(),
      ...(page ? {'X-Lunaria-Analytics-Page': page} : {})} : {};
  }
  function forward(name, flow) {
    // Registration starts at the real code-request action, not just a form view.
    if (name === 'registration_started') return false;
    if (name === 'chart_creation_started') return emit(name, {}, flow);
    if (name === 'premium_modal_opened') return emit('premium_offer_viewed', {}, flow);
    if (['stripe_selected', 'lava_selected'].includes(name)) {provider = name.split('_')[0]; return emit('payment_provider_selected', {provider}, flow);}
    if (name === 'checkout_failed' && provider) return emit('checkout_initiation_failed', {provider, reason: 'unknown'}, flow);
    if (/^landing_cta_(chart|relationships|pricing|login)$/.test(name)) return emit('landing_cta_clicked', {target: name.slice(12)}, flow);
    if (name === 'landing_demo_selected') return emit(name, {}, flow);
    if (/^landing_scroll_(25|50|75|90)$/.test(name)) return emit('landing_scroll_reached', {milestone: name.slice(15)}, flow);
    if (/^landing_engaged_(30s|60s)$/.test(name)) return emit('engagement_milestone', {milestone: name.slice(16)}, flow);
    return false;
  }
  const safe = fn => (...args) => {try {const value = fn(...args); return value?.catch ? value.catch(() => false) : value;} catch {return false;}};
  return {refresh: safe(refresh), emit: safe(emit), forward: safe(forward), flush: safe(flush),
    halt: safe(halt), pause: safe(pause), reset: safe(reset), headers: safe(headers), canTrack: safe(canTrack),
    pageLeave: safe(() => {if (emit('page_leave_hint')) flush({keepalive: true});}),
    status: () => ({configured: options.enabled, ready, pending: queue.length, page})};
}

export const productAnalytics = createProductAnalytics();
export const analyticsHeaders = () => productAnalytics.headers() || {};
