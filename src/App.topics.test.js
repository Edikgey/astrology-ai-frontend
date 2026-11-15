// TOPICS-1-fe, TF3 «маршрут» (tasks/TOPICS-1/DESIGN.md §3.3, §5): настоящий App и настоящий роутер, страницы — заглушки.
// /topics (с ?chart= и ?topic=) показывает страницу TopicsPage; соседние маршруты и неизвестный путь не задеты.
// Страницы TopicsPage на базе нет: заглушка объявлена virtual, поэтому тест красный по одной причине — в App нет маршрута /topics.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

let mockPath;
// Jest 27 cannot load react-router-dom v7; the real routing comes from react-router (as in App.metrics2.test.js).
jest.mock('react-router-dom', () => {
  const React = require('react');
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  const router = require('react-router');
  return { ...router, BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter, { initialEntries: [mockPath] }, children) };
}, { virtual: true });
jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false, authError: false, authChecking: false, signedOutReason: null }),
}));
jest.mock('./context/UsageContext', () => ({ UsageProvider: ({ children }) => children }));
jest.mock('./context/ServiceConfigContext', () => ({ ServiceConfigProvider: ({ children }) => children }));
jest.mock('./components/AnalyticsRouteGuard', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('./components/ProductAnalyticsObserver', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/CookiePreferences', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/PublicBehavior', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/FeedbackWidget', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/FreeBetaNotice', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/Header', () => ({ __esModule: true, default: () => null }));
jest.mock('./components/Footer', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/HomePage', () => ({ __esModule: true, default: () => <section data-testid="home" /> }));
jest.mock('./pages/PricingPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/AuthorizationPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/TryFreePage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/MyCharts', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/MyMonthPage', () => ({ __esModule: true, default: () => <section data-testid="my-month" /> }));
jest.mock('./pages/MoonTodayPage', () => ({ __esModule: true, default: () => <section data-testid="moon" /> }));
jest.mock('./pages/NatalChartResultPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/RelationshipNewPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/RelationshipResultPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/NotFoundPage', () => ({ __esModule: true, default: () => <section data-testid="not-found" /> }));
jest.mock('./pages/PasswordResetPage', () => ({ __esModule: true, default: () => null }));
jest.mock('./pages/LegalPages', () => ({ TermsPage: () => null, PrivacyPage: () => null, RefundPage: () => null, SupportPage: () => null }));
jest.mock('./pages/TopicsPage', () => ({ __esModule: true, default: () => <section data-testid="topics" /> }), { virtual: true });

let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const shown = async path => {
  mockPath = path;
  await act(async () => root.render(<App />));
  return [...container.querySelectorAll('[data-testid]')].map(el => el.dataset.testid);
};

test.each(['/topics', '/topics?chart=7', '/topics?chart=7&topic=money', '/topics/'])('TF3: %s shows the topics page, not «не найдено»', async path => {
  expect(await shown(path)).toEqual(['topics']);
});

test('TF3 guard (зелёный на базе): соседние маршруты и неизвестный путь не задеты', async () => {
  expect(await shown('/my-month')).toEqual(['my-month']);
  await act(async () => root.unmount());
  root = createRoot(container);
  expect(await shown('/moon')).toEqual(['moon']);
  await act(async () => root.unmount());
  root = createRoot(container);
  expect(await shown('/topics/extra')).toEqual(['not-found']);
});
