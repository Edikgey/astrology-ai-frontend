import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import TryFreePage from './TryFreePage';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock('../context/UsageContext', () => ({ useUsage: () => ({ refreshUsage: jest.fn(), handleLimitError: () => false }) }));
jest.mock('../components/UsageSummary', () => () => null);
let root, container, originalFetch;
const ok = value => ({ ok: true, json: async () => value });
const change = async (name, value) => act(async () => Simulate.change(container.querySelector(`[name="${name}"]`), { target: { name, value } }));
const submit = async () => act(async () => Simulate.submit(container.querySelector('form')));
const selectCity = async () => {
  global.fetch.mockResolvedValueOnce(ok({ results: [{ formatted: 'Selected city', geometry: { lat: 0, lng: 0 },
    components: { country: 'Test country' }, annotations: { timezone: { name: 'Europe/Berlin', offset_sec: 7200 } } }] }));
  await change('birthPlace', 'City');
  await act(async () => container.querySelector('.suggestions-list li').click());
};
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem('access_token', 'test-jwt');
  originalFetch = global.fetch; global.fetch = jest.fn(); mockNavigate.mockReset();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<TryFreePage />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch; });

test('selected HH:MM and IANA zone reach API; zero coordinates survive; no browser Julian date', async () => {
  await selectCity(); await change('hour', '12'); await change('minute', '37');
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 }));
  await submit();
  const [, options] = global.fetch.mock.calls.find(([url]) => url.endsWith('/natal-chart'));
  const payload = JSON.parse(options.body);
  expect(payload).toMatchObject({ year: 2000, month: 1, day: 1, hour: 12, minute: 37, timezone: 'Europe/Berlin', lat: 0, lon: 0 });
  expect(payload).not.toHaveProperty('julian_date'); expect(payload).not.toHaveProperty('offset_sec');
  expect(JSON.parse(localStorage.getItem('tempUserData')).birthTime).toBe('12:37');
  expect(mockNavigate).toHaveBeenCalledWith('/natal-chart-result/42');
});

test('editing birthplace invalidates coordinates and timezone from the previous selection', async () => {
  await selectCity(); await change('birthPlace', 'AB');
  expect(container.textContent).not.toContain('Europe/Berlin');
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 })); await submit();
  const payload = JSON.parse(global.fetch.mock.calls.find(([url]) => url.endsWith('/natal-chart'))[1].body);
  expect(payload).toMatchObject({ timezone: null, lat: null, lon: null });
});

test('ambiguous birth time requires an explicit fold choice and preserves minutes', async () => {
  await selectCity(); await change('hour', '02'); await change('minute', '30');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: {
      code: 'AMBIGUOUS_BIRTH_TIME', message: 'Выберите вариант времени', options: [{ fold: 0, offset: '+0200' }, { fold: 1, offset: '+0100' }],
    } }) });
    await submit(); expect(mockNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('[name="timeFold"]').value).toBe('');
    await change('timeFold', '1'); global.fetch.mockResolvedValueOnce(ok({ chart_id: 43 })); await submit();
    const posts = global.fetch.mock.calls.filter(([url]) => url.endsWith('/natal-chart'));
    expect(JSON.parse(posts[1][1].body)).toMatchObject({ hour: 2, minute: 30, time_fold: 1 });
    await change('day', '2'); expect(container.querySelector('[name="timeFold"]')).toBeNull();
  } finally { log.mockRestore(); }
});

test('late city lookup cannot replace suggestions for a newer birthplace', async () => {
  let old;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { old = resolve; }));
  await change('birthPlace', 'Old city');
  global.fetch.mockResolvedValueOnce(ok({ results: [{ formatted: 'New city', geometry: { lat: 1, lng: 2 }, components: {}, annotations: { timezone: { name: 'UTC' } } }] }));
  await change('birthPlace', 'New city');
  await act(async () => old(ok({ results: [{ formatted: 'Old city', geometry: { lat: 3, lng: 4 }, components: {}, annotations: { timezone: { name: 'Asia/Tokyo' } } }] })));
  expect(container.querySelector('.suggestions-list').textContent).toBe('New city');
});
