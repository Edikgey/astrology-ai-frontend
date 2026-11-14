// Test support for METRICS-2 (not product code, not a test file).
// A real product-analytics client with an injected transport and fake clock: the
// tests below assert on what would leave the browser, not on private call shapes.
import {createProductAnalytics} from './productAnalytics';

export const API = 'https://astrology-ai-backend-production.up.railway.app';
export const ERRORS_KEY = 'lunaria.product-analytics.errors';
const config = {enabled: true, production: true, apiUrl: API};
let sequence = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
export const reply = (data = {}, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => data});

export function createHarness({clock = {now: 1000000}, search = '', transport, settings = {}} = {}) {
  const send = transport || jest.fn(async (url) => reply(url.endsWith('/consent') ? {accepted: true} : {accepted: 20}));
  const win = {location: new URL('https://mylunariaai.com/' + search), innerWidth: 1200,
    dispatchEvent: window.dispatchEvent.bind(window), localStorage, sessionStorage,
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window)};
  const client = createProductAnalytics({win, config: {...config, ...settings}, transport: send, clock: () => clock.now,
    randomId: uuid, getToken: () => null});
  const calls = path => send.mock.calls.filter(([url]) => url.endsWith('/analytics/' + path));
  const records = () => calls('events').flatMap(([, options]) => JSON.parse(options.body).events);
  return {client, transport: send, clock, calls, records,
    names: () => records().map(value => value.name),
    named: name => records().filter(value => value.name === name),
    wire: () => calls('events').map(([, options]) => options.body).join(''),
    start: async (pathname = '/my-charts') => {await client.refresh({actorKey: null, pathname}); return client;},
    settle: async () => {for (let i = 0; i < 3; i += 1) await client.flush();}};
}

// Every call into analytics throws: product code must keep working (guard F10).
export const throwingAnalytics = () => new Proxy({}, {get: () => () => {throw new Error('analytics is down');}});
