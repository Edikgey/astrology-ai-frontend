import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../context/AuthContext';
import { UsageProvider } from '../context/UsageContext';
import NatalChartResultPage from './NatalChartResultPage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/natal-chart-result/7', state: null }),
  useParams: () => ({ chartId: '7' }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock('../components/NatalChart', () => props => <div>{props.children}</div>);
jest.mock('../components/AskGptForm', () => () => null);

const bodies = {
  '☉': { symbol: '☉', label: 'Солнце', sign: 'Козерог', degree: 281.4 },
  '☽': { symbol: '☽', label: 'Луна', sign: 'Скорпион', degree: 235.5 },
  AS: { symbol: 'AS', label: 'Асцендент', sign: 'Рыбы', degree: 350.2 },
};
let container, root, originalFetch;
const chart = extra => ({ chart_id: 7, houses: [{ symbol: 'I', degree: 10 }], timezone: 'Europe/Moscow', birth_utc: '1992-09-02T20:00:00',
  time_provenance: 'local_iana', bodies_for_circle: bodies, ...extra });
const render = async data => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => data });
  await act(async () => root.render(<AuthProvider><UsageProvider><NatalChartResultPage /></UsageProvider></AuthProvider>));
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  global.Path2D = class {};
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get: (target, key) => key === 'measureText' ? text => ({ width: String(text).length * 10 })
      : String(key).startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  delete global.Path2D;
});

test('the chart page has the share button and it opens the preview with the chart signs', async () => {
  await render(chart());
  const button = container.querySelector('.share-card-open');
  expect(button.textContent).toBe('Поделиться картой');
  await act(async () => { button.click(); });
  expect(container.querySelector('dialog canvas').getAttribute('aria-label')).toContain('Солнце — Козерог, Луна — Скорпион, Асцендент — Рыбы');
});

test('an old chart without a verified time offers the card with two positions', async () => {
  await render(chart({ time_provenance: 'legacy_unverified' }));
  await act(async () => { container.querySelector('.share-card-open').click(); });
  expect(container.querySelector('dialog canvas').getAttribute('aria-label')).not.toContain('Асцендент');
});

test('a chart without readable signs has no share button', async () => {
  await render(chart({ bodies_for_circle: {} }));
  expect(container.querySelector('.share-card-open')).toBeNull();
});
