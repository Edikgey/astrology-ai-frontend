import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import ProductAnalyticsObserver from './ProductAnalyticsObserver';
import {saveConsent, setExcluded} from '../analytics/consent';
import {productAnalytics} from '../analytics/productAnalytics';

let mockAuth, mockPath, root, container;
jest.mock('../context/AuthContext', () => ({useAuth: () => mockAuth}));
jest.mock('react-router-dom', () => ({useLocation: () => ({pathname: mockPath})}));
jest.mock('../analytics/productAnalytics', () => ({productAnalytics: {
  refresh: jest.fn(), pause: jest.fn(), pageLeave: jest.fn(),
}}));
const render = () => act(async () => root.render(<ProductAnalyticsObserver />));
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  for (const value of document.cookie.split(';')) document.cookie = `${value.split('=')[0].trim()}=; Max-Age=0; Path=/`;
  mockPath = '/my-charts'; mockAuth = {user: null, loading: true};
  jest.clearAllMocks();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {await act(async () => root.unmount()); container.remove();});

test('withdrawal remains connected while account loading is still pending', async () => {
  saveConsent(true); await render();
  expect(productAnalytics.pause).toHaveBeenCalled();
  await act(async () => saveConsent(false));
  expect(productAnalytics.refresh).toHaveBeenLastCalledWith({pathname: '/my-charts'});
});

test('explicit acceptance during account loading is applied after authenticated identity resolves', async () => {
  await render(); await act(async () => saveConsent(true));
  mockAuth = {user: {id: 7, email: 'CANARY_EMAIL'}, loading: false}; await render();
  expect(productAnalytics.refresh).toHaveBeenLastCalledWith({actorKey: 7, pathname: '/my-charts', explicit: true});
  expect(JSON.stringify(productAnalytics.refresh.mock.calls)).not.toContain('CANARY');
});

test('device exclusion and route changes refresh analytics without rendering any UI', async () => {
  saveConsent(true); mockAuth = {user: {id: 7}, loading: false}; await render();
  await act(async () => setExcluded(true));
  expect(productAnalytics.refresh).toHaveBeenLastCalledWith({pathname: '/my-charts'});
  await act(async () => setExcluded(false)); mockPath = '/relationships/91234'; await render();
  expect(productAnalytics.refresh).toHaveBeenLastCalledWith({actorKey: 7, pathname: '/relationships/91234', explicit: false});
  expect(container.innerHTML).toBe('');
});
