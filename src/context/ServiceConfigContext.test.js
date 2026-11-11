import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ServiceConfigProvider, useServiceConfig } from './ServiceConfigContext';
let root, container, originalFetch;
const ok = data => ({ ok: true, json: async () => data });
function Probe() { const { freeBetaEnabled } = useServiceConfig(); return <p>{freeBetaEnabled ? 'beta on' : 'beta off'}</p>; }
const render = async () => act(async () => root.render(<ServiceConfigProvider><Probe /></ServiceConfigProvider>));
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  originalFetch = global.fetch; global.fetch = jest.fn(async () => ok({free_beta_enabled:true}));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount());container.remove();global.fetch=originalFetch;localStorage.clear(); });
test('safe public configuration comes from the server without account data', async () => {
  await render(); expect(container.textContent).toBe('beta on');
  const [url, options] = global.fetch.mock.calls[0];
  expect(url.endsWith('/public-config')).toBe(true); expect(options.headers).toBeUndefined();
  expect(options.cache).toBe('no-store');
});
test('truthy strings and local settings cannot enable beta', async () => {
  localStorage.setItem('free_beta_enabled','true'); global.fetch.mockResolvedValue(ok({free_beta_enabled:'true'}));
  await render();expect(container.textContent).toBe('beta off');
});
test('configuration failure never grants a client-side beta', async () => {
  global.fetch.mockRejectedValue(new Error('Unavailable'));await render();expect(container.textContent).toBe('beta off');
});
test('focus refresh reflects server disable without a frontend rebuild', async () => {
  await render();expect(container.textContent).toBe('beta on');global.fetch.mockResolvedValue(ok({free_beta_enabled:false}));
  await act(async () => window.dispatchEvent(new Event('focus')));expect(container.textContent).toBe('beta off');
});
test('late response after unmount is aborted', async () => {
  let finish;global.fetch.mockImplementation(() => new Promise(resolve => {finish=resolve;}));await render();
  const signal=global.fetch.mock.calls[0][1].signal;
  await act(async () => root.render(null));expect(signal.aborted).toBe(true);
  await act(async () => finish(ok({free_beta_enabled:true})));expect(container.textContent).toBe('');
});
