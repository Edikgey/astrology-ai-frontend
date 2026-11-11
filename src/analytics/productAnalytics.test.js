import {createProductAnalytics, PRODUCT_ANALYTICS_STATE} from './productAnalytics';

let client, win, decision, excluded, transport, tick, sequence;
const config = {enabled: true, production: true, apiUrl: 'https://astrology-ai-backend-production.up.railway.app'};
const reply = (data = {}, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => data});
const calls = path => transport.mock.calls.filter(([url]) => url.endsWith('/analytics/' + path));
const records = () => calls('events').flatMap(([, options]) => JSON.parse(options.body).events);
const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
  decision = 'accepted'; excluded = false; tick = 1000000; sequence = 0;
  win = {location: new URL('https://mylunariaai.com/'), innerWidth: 390,
    dispatchEvent: window.dispatchEvent.bind(window),
    localStorage, sessionStorage, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window)};
  transport = jest.fn(async (url) => reply(url.endsWith('/consent') ? {accepted: true} : {accepted: 20}));
  client = createProductAnalytics({win, config, consent: () => decision, excluded: () => excluded,
    transport, clock: () => tick, randomId: uuid, getToken: () => null});
});
afterEach(() => {client.halt(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();});

test.each(['undecided', 'rejected'])('no event collection, identity storage or requests with %s consent', async state => {
  decision = state;
  expect(await client.refresh()).toBe(false);
  expect(client.emit('page_viewed')).toBe(false);
  expect(transport).not.toHaveBeenCalled();
  expect(localStorage.length + sessionStorage.length).toBe(0);
});

test.each([{enabled: false}, {production: false}, {apiUrl: 'https://attacker.example'},
  {apiUrl: config.apiUrl + '?token=CANARY'}, {apiUrl: config.apiUrl + '#CANARY'},
  {apiUrl: 'http://astrology-ai-backend-production.up.railway.app'},
  {apiUrl: 'https://CANARY@astrology-ai-backend-production.up.railway.app'}])
('fails closed for unsafe or disabled config %p', async override => {
  client = createProductAnalytics({win, config: {...config, ...override}, transport, consent: () => 'accepted'});
  expect(await client.refresh()).toBe(false); expect(transport).not.toHaveBeenCalled();
});

test('only fixed categories/UTM codes leave private SPA routes; no DOM/referrer reads', async () => {
  win.location = new URL('https://mylunariaai.com/relationships/87654?token=CANARY_JWT&utm_source=telegram#CANARY_SECRET');
  jest.spyOn(document, 'referrer', 'get').mockImplementation(() => {throw new Error('Referrer must not be read');});
  document.body.innerHTML = '<input value="CANARY_BIRTH"><div>CANARY_AI</div>';
  expect(await client.refresh()).toBe(true);
  expect(client.emit('ai_question_started', {subject: 'relationship'})).toBe(true);
  expect(await client.flush()).toBe(true);
  const data = calls('events').map(([, options]) => options.body).join('');
  expect(data).not.toMatch(/CANARY|87654|referrer|birth|"question"\s*:/);
  expect(records()).toEqual(expect.arrayContaining([expect.objectContaining({name: 'page_viewed',
    route_key: 'relationship_view', viewport_class: 'small', campaign_source: 'telegram'})]));
  expect(document.querySelector('script[src*="posthog"]')).toBeNull();
  expect(calls('events')[0][1]).toEqual(expect.objectContaining({referrerPolicy: 'no-referrer', credentials: 'omit'}));
});

test('unknown marketing values are reduced to other without storage of raw values', async () => {
  win.location = new URL('https://mylunariaai.com/?utm_source=CANARY_EMAIL');
  await client.refresh(); await client.flush();
  expect(records()[0].campaign_source).toBe('other');
  expect(JSON.stringify([...transport.mock.calls, {...localStorage}, {...sessionStorage}])).not.toContain('CANARY');
});

test('acceptance must be acknowledged by backend before events can start', async () => {
  let complete;
  transport.mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  const waiting = client.refresh({explicit: true});
  expect(client.emit('page_viewed')).toBe(false); expect(client.canTrack()).toBe(false);
  complete(reply({accepted: true})); await waiting;
  expect(client.canTrack()).toBe(true);
});

test('withdrawal aborts queued/in-flight work and late replies cannot resume collection', async () => {
  await client.refresh();
  let complete;
  transport.mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  const pending = client.flush();
  decision = 'rejected'; await client.refresh();
  expect(calls('events')[0][1].signal.aborted).toBe(true);
  complete(reply({accepted: 1})); await pending;
  expect(client.canTrack()).toBe(false); expect(client.status().pending).toBe(0);
  expect(client.emit('page_viewed')).toBe(false);
  expect(JSON.parse(calls('consent').at(-1)[1].body).action).toBe('withdraw');
  expect(localStorage.length + sessionStorage.length).toBe(0);
});

test('withdrawal while acceptance is pending tombstones that same consent lease', async () => {
  let complete;
  transport.mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  const pending = client.refresh({explicit: true});
  const original = JSON.parse(calls('consent')[0][1].body);
  decision = 'rejected'; await client.refresh();
  const withdrawn = JSON.parse(calls('consent')[1][1].body);
  expect(withdrawn.revision).toBe(original.revision); expect(withdrawn.visitor_id).toBe(original.visitor_id);
  complete(reply({accepted: true})); await pending;
  expect(client.canTrack()).toBe(false); expect(calls('events')).toHaveLength(0);
});

test('guest history joins only the next authenticated account after a new backend acknowledgement', async () => {
  await client.refresh({actorKey: null}); await client.flush();
  const guest = JSON.parse(calls('consent')[0][1].body);
  await client.refresh({actorKey: 1});
  expect(calls('consent')).toHaveLength(2);
  const signedIn = JSON.parse(calls('consent')[1][1].body);
  expect(signedIn.visitor_id).toBe(guest.visitor_id);
  expect(signedIn).not.toHaveProperty('user_id'); expect(signedIn).not.toHaveProperty('actor');
});

test('logout and another account use a fresh identity/session and discard prior pending actions', async () => {
  await client.refresh({actorKey: 1});
  const first = JSON.parse(calls('consent')[0][1].body).visitor_id;
  client.emit('ai_question_started', {subject: 'natal'});
  client.reset(); await client.refresh({actorKey: 2}); await client.flush();
  const current = JSON.parse(calls('consent').at(-1)[1].body).visitor_id;
  expect(current).not.toBe(first);
  expect(records().some(value => value.name === 'ai_question_started')).toBe(false);
  expect(calls('consent').map(([, options]) => JSON.parse(options.body).action)).toContain('reset');
});

test('reload keeps consented visitor identity but resets do not restore old sessions', async () => {
  await client.refresh({actorKey: 1}); const before = JSON.parse(calls('consent')[0][1].body);
  client.pause();
  const second = createProductAnalytics({win, config, transport, consent: () => 'accepted', randomId: uuid, getToken: () => null});
  await second.refresh({actorKey: 1});
  expect(JSON.parse(calls('consent').at(-1)[1].body).visitor_id).toBe(before.visitor_id);
  second.halt();
});

test('fixed route views deduplicate refreshes while real navigation and back count', async () => {
  await client.refresh(); await client.refresh();
  await client.refresh({pathname: '/my-charts'}); await client.refresh({pathname: '/'}); await client.flush();
  expect(records().filter(value => value.name === 'page_viewed').map(value => value.route_key)).toEqual(['home', 'my_charts', 'home']);
});

test.each(['/reset-password', '/checkout', '/unknown/CANARY'])('no page or action events on excluded path %s', async pathname => {
  await client.refresh({pathname}); expect(client.emit('page_viewed')).toBe(false); await client.flush();
  expect(calls('events')).toHaveLength(0);
});

test('30 minutes of inactivity starts a new session, not a new visitor', async () => {
  await client.refresh(); await client.flush();
  tick += 1800001;
  client.emit('landing_demo_selected'); await client.flush();
  expect(records()[0].session_id).not.toBe(records()[1].session_id);
  expect(JSON.parse(calls('events')[0][1].body).visitor_id).toBe(JSON.parse(calls('events')[1][1].body).visitor_id);
});

test('backend refusal stops collection instead of treating it as guest consent', async () => {
  await client.refresh();
  transport.mockResolvedValueOnce(reply({}, 403)); await client.flush();
  expect(client.canTrack()).toBe(false); expect(client.status().pending).toBe(0);
});

test('blocked delivery is retried at most three times with the same event identity', async () => {
  await client.refresh(); transport.mockRejectedValue(new TypeError('CANARY_PRIVATE_NETWORK_ERROR'));
  for (let i = 0; i < 5; i += 1) await client.flush();
  expect(calls('events')).toHaveLength(3);
  expect(new Set(records().map(value => value.event_id)).size).toBe(1);
  expect(client.status().pending).toBe(0);
});

test('browser cannot emit a paid conversion or unapproved content via legacy hooks', async () => {
  await client.refresh();
  expect(client.forward('premium_activated', uuid())).toBe(false);
  expect(client.emit('billing_period_paid', {provider: 'stripe'})).toBe(false);
  expect(client.emit('page_viewed', {question: 'CANARY_AI'})).toBe(false);
  client.forward('stripe_selected', uuid()); client.forward('checkout_failed', uuid());
  await client.flush();
  expect(records().map(value => value.name)).toEqual(['page_viewed', 'payment_provider_selected', 'checkout_initiation_failed']);
});

test('a closed/storage-restricted browser fails safely without affecting application state', async () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('blocked');});
  expect(await client.refresh()).toBe(false); expect(transport).not.toHaveBeenCalled();
});

test('device exclusion resets only that browser and can be reversed without accepting cookies again', async () => {
  await client.refresh({actorKey: 1}); excluded = true; await client.refresh({actorKey: 1});
  expect(JSON.parse(calls('consent').at(-1)[1].body).action).toBe('reset');
  expect(client.canTrack()).toBe(false);
  excluded = false; await client.refresh({actorKey: 1}); expect(client.canTrack()).toBe(true);
});

test('a failed explicit acceptance retries the same lease without silently restoring revoked old consent', async () => {
  transport.mockRejectedValueOnce(new TypeError('offline'));
  expect(await client.refresh({explicit: true})).toBe(false);
  const first = JSON.parse(calls('consent')[0][1].body);
  await client.refresh();
  const second = JSON.parse(calls('consent')[1][1].body);
  expect(second.revision).toBe(first.revision); expect(second.action).toBe('accept');
});

test('offline withdrawal persists only a minimal privacy request and retries after reload before collecting again', async () => {
  await client.refresh({actorKey: 1});
  transport.mockRejectedValue(new TypeError('offline'));
  decision = 'rejected'; await client.refresh();
  expect(client.status().pending).toBe(0); expect(client.canTrack()).toBe(false);
  expect(sessionStorage.length).toBe(0);
  const entries = Object.keys(localStorage);
  expect(entries).toEqual(['lunaria.analytics.privacy-pending']);
  const pending = JSON.parse(localStorage.getItem(entries[0]));
  expect(Object.keys(pending[0]).sort()).toEqual(['action', 'revision', 'visitor_id']);
  expect(pending[0].action).toBe('withdraw');
  transport.mockResolvedValue(reply({accepted: false}));
  const reloaded = createProductAnalytics({win, config, transport, consent: () => decision, randomId: uuid, getToken: () => null});
  await reloaded.refresh(); expect(localStorage.length).toBe(0); expect(reloaded.canTrack()).toBe(false);
  expect(JSON.parse(calls('consent').at(-1)[1].body).action).toBe('withdraw');
  reloaded.halt();
});

test('landing observers are notified when asynchronous consent acknowledgement makes collection ready', async () => {
  const states = [];
  const listener = () => states.push(client.canTrack());
  window.addEventListener(PRODUCT_ANALYTICS_STATE, listener);
  try {
    await client.refresh(); expect(states).toContain(true);
    client.pause(); expect(states.at(-1)).toBe(false);
  } finally {window.removeEventListener(PRODUCT_ANALYTICS_STATE, listener);}
});
