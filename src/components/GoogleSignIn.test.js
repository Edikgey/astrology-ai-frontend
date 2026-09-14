import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import GoogleSignIn from './GoogleSignIn';
import { loadGoogleIdentity } from '../api/googleIdentity';
jest.mock('../api/googleIdentity');
let root, container, config, signIn, gis;
const originalCrypto = global.crypto;
beforeEach(() => {
  global.crypto = require('crypto').webcrypto;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  signIn = jest.fn().mockResolvedValue({});
  gis = { initialize: jest.fn(value => { config = value; }), renderButton: jest.fn() };
  loadGoogleIdentity.mockResolvedValue(gis);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); global.crypto = originalCrypto; jest.clearAllMocks(); });
const render = async (clientId = 'test.apps.googleusercontent.com') => act(async () => root.render(<GoogleSignIn clientId={clientId} onSignIn={signIn} />));

test('no misleading button when Google configuration is missing', async () => {
  await render(''); expect(container.textContent).toBe(''); expect(loadGoogleIdentity).not.toHaveBeenCalled();
});
test('official popup button sends credential with fresh nonce, never stores Google token', async () => {
  await render();
  expect(config.ux_mode).toBe('popup'); expect(config.nonce).toMatch(/^[a-f0-9]{64}$/);
  expect(gis.renderButton).toHaveBeenCalled();
  await act(async () => config.callback({ credential: 'google-test-credential' }));
  expect(signIn).toHaveBeenCalledWith('google-test-credential', config.nonce, undefined);
  expect(JSON.stringify(localStorage)).not.toContain('google-test-credential');
});
test('missing credential and loader failure produce recoverable errors', async () => {
  await render(); await act(async () => config.callback({}));
  expect(container.querySelector('[role="alert"]').textContent).toContain('не подтвердил');
  expect(signIn).not.toHaveBeenCalled();
});
test('third-party linking asks for password and can be cancelled without another login', async () => {
  signIn.mockRejectedValueOnce(Object.assign(new Error('Подтвердите пароль'), { code: 'google_link_confirmation_required' }));
  await render(); await act(async () => config.callback({ credential: 'google-token' }));
  const input = container.querySelector('input[type="password"]'); expect(input).not.toBeNull();
  await act(async () => Simulate.change(input, { target: { value: 'existing-password' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(signIn).toHaveBeenLastCalledWith('google-token', config.nonce, 'existing-password');
  expect(container.querySelector('form')).toBeNull();
});
test('loader failure offers retry and never triggers authentication', async () => {
  loadGoogleIdentity.mockRejectedValueOnce(new Error('Google не загрузился'));
  await render(); expect(container.textContent).toContain('Повторить загрузку Google');
  await act(async () => container.querySelector('button').click());
  expect(gis.renderButton).toHaveBeenCalled(); expect(signIn).not.toHaveBeenCalled();
});
test('closing Google popup leaves ordinary auth available and callback after unmount is ignored', async () => {
  await render();
  const options = gis.renderButton.mock.calls[0][1];
  await act(async () => options.click_listener());
  expect(container.textContent).toContain('закрыли'); expect(signIn).not.toHaveBeenCalled();
  await act(async () => root.render(<div />));
  await act(async () => config.callback({ credential: 'stale' }));
  expect(signIn).not.toHaveBeenCalled();
});
