import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import TryFreePage, { calculateNatalChart } from './TryFreePage';

const mockNavigate = jest.fn();
let mockLocation;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => mockLocation }), { virtual: true });
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
  mockLocation = { pathname: '/try-free', state: null };
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

test('optional name is attached to the created chart locally without changing the API contract', async () => {
  await selectCity(); await change('name', 'Моя карта');
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 }));
  await submit();
  expect(JSON.parse(localStorage.getItem('chart-presentation:42'))).toEqual({ name: 'Моя карта' });
  const [, options] = global.fetch.mock.calls.find(([url]) => url.endsWith('/natal-chart'));
  expect(JSON.parse(options.body)).not.toHaveProperty('name');
});

test('authenticated second-person creation returns only to the allowlisted relationship route', async () => {
  mockLocation = { pathname: '/try-free', state: { returnTo: '/relationships/new',
    relationshipDraft: { chartAId: 7, labelA: 'Анна' } } };
  await act(async () => root.unmount()); root = createRoot(container);
  await act(async () => root.render(<TryFreePage />));
  await selectCity(); global.fetch.mockResolvedValueOnce(ok({ chart_id: 8 })); await submit();
  expect(mockNavigate).toHaveBeenCalledWith('/relationships/new', { replace: true, state: {
    relationshipDraft: { chartAId: 7, labelA: 'Анна' }, createdChartId: 8,
  } });
});

test('editing birthplace invalidates coordinates and timezone from the previous selection', async () => {
  await selectCity(); await change('birthPlace', 'AB');
  expect(container.textContent).not.toContain('Europe/Berlin');
  await submit();
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/natal-chart'))).toBe(false);
  expect(container.querySelector('[role="alert"]').textContent).toContain('выбирает место');
});

const result = (city, region, country, lat, lng, timezone) => ({ formatted: city,
  geometry: { lat, lng }, components: { town: city, state: region, country },
  annotations: { timezone: { name: timezone } } });
const lookup = async (query, results) => {
  global.fetch.mockResolvedValueOnce(ok({ results }));
  await change('birthPlace', query);
};

test.each([
  ['Svatove', 'Сватове', 'Луганська область', 'Україна', 49.41, 38.15, 'Europe/Kyiv'],
  ['Сватове', 'Сватове', 'Луганська область', 'Україна', 49.41, 38.15, 'Europe/Kyiv'],
  ['Сватово', 'Сватово', 'Луганская область', 'Украина', 49.41, 38.15, 'Europe/Kyiv'],
  ['Kyiv', 'Київ', 'Київ', 'Україна', 50.45, 30.52, 'Europe/Kyiv'],
  ['Warsaw', 'Warszawa', 'Mazowieckie', 'Polska', 52.23, 21.01, 'Europe/Warsaw'],
  ['Toronto', 'Toronto', 'Ontario', 'Canada', 43.65, -79.38, 'America/Toronto'],
])('explicit %s selection submits one consistent provider snapshot', async (query, city, region, country, lat, lon, timezone) => {
  await lookup(query, [result(city, region, country, lat, lon, timezone)]);
  expect(container.querySelector('[name="birthPlace"]').value).toBe(query);
  await submit(); // Even a single search result is never silently selected.
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => container.querySelector('.suggestions-list li').click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain(timezone);
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 })); await submit();
  const payload=JSON.parse(global.fetch.mock.calls.find(([url]) => url.endsWith('/natal-chart'))[1].body);
  expect(payload).toMatchObject({ lat, lon, timezone, region, country });
  expect(payload.city).toContain(city); expect(payload.city).toContain(region); expect(payload.city).toContain(country);
  expect(payload.selected_location).toEqual({ city: payload.city, lat, lon, timezone, region, country });
  expect(mockNavigate).toHaveBeenCalledWith('/natal-chart-result/42');
});

test('ambiguous results retain provider order and require deliberate keyboard selection', async () => {
  await lookup('Сватово', [
    result('Сватово, Одинцовский городской округ', 'Московская область', 'Россия', 55.7, 36.9, 'Europe/Moscow'),
    result('Сватово', 'Луганская область', 'Украина', 49.41, 38.15, 'Europe/Kyiv'),
  ]);
  const input=container.querySelector('[name="birthPlace"]');
  await act(async () => Simulate.keyDown(input, { key: 'Enter', preventDefault: jest.fn() }));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(input.value).toBe('Сватово');
  const options=container.querySelectorAll('.suggestions-list li');
  expect(options[0].textContent).toContain('Московская область');
  expect(options[1].textContent).toContain('Луганская область');
  await act(async () => Simulate.keyDown(input, { key: 'ArrowDown', preventDefault: jest.fn() }));
  expect(document.activeElement).toBe(options[0]);
  await act(async () => Simulate.keyDown(options[0], { key: 'ArrowDown', preventDefault: jest.fn() }));
  expect(document.activeElement).toBe(options[1]);
  await act(async () => Simulate.keyDown(options[1], { key: 'Enter', preventDefault: jest.fn() }));
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 })); await submit();
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toMatchObject({ timezone: 'Europe/Kyiv', lat: 49.41, lon: 38.15, country: 'Украина' });
});

test('editing then selecting a different place replaces all metadata and clears previous validation error', async () => {
  await selectCity(); await change('birthPlace', 'AB'); await submit();
  await lookup('Toronto', [result('Toronto', 'Ontario', 'Canada', 43.65, -79.38, 'America/Toronto')]);
  await act(async () => container.querySelector('.suggestions-list li').click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  global.fetch.mockResolvedValueOnce(ok({ chart_id: 44 })); await submit();
  expect(JSON.parse(global.fetch.mock.calls.find(([url]) => url.endsWith('/natal-chart'))[1].body)).toMatchObject({
    city: 'Toronto, Ontario, Canada', region: 'Ontario', country: 'Canada', lat: 43.65, lon: -79.38, timezone: 'America/Toronto',
  });
});

test.each(['', 'Invalid/Zone'])('missing or unusable provider timezone %s cannot create a chart', async timezone => {
  await lookup('City', [result('City', 'Region', 'Country', 1, 2, timezone)]);
  expect(container.querySelector('.suggestions-list li').textContent).toContain('нет пригодного');
  await act(async () => container.querySelector('.suggestions-list li').click());
  expect(container.querySelector('[role="alert"]').textContent).toContain('IANA timezone');
  await submit(); expect(global.fetch).toHaveBeenCalledTimes(1); expect(mockNavigate).not.toHaveBeenCalled();
});

test('legacy profile text and coordinates are not restored as a verified suggestion', async () => {
  localStorage.setItem('userData', JSON.stringify({ birthPlace: 'Old profile city', latitude: 1, longitude: 2 }));
  await act(async () => root.unmount()); root=createRoot(container);
  await act(async () => root.render(<TryFreePage />));
  expect(container.querySelector('[name="birthPlace"]').value).toBe('Old profile city');
  await submit(); expect(global.fetch).not.toHaveBeenCalled();
  await selectCity(); global.fetch.mockResolvedValueOnce(ok({ chart_id: 42 })); await submit();
  expect(mockNavigate).toHaveBeenCalledWith('/natal-chart-result/42');
});

test('API helper refuses a mismatched selection snapshot before sending any request', async () => {
  const selectedLocation={city:'Warsaw',region:'Mazowieckie',country:'Poland',lat:52.23,lon:21.01,timezone:'Europe/Warsaw'};
  await expect(calculateNatalChart({ birthPlace:'Toronto',latitude:52.23,longitude:21.01,timezone:'Europe/Warsaw',
    region:'Mazowieckie',country:'Poland',selectedLocation })).rejects.toThrow('выбирает место');
  expect(global.fetch).not.toHaveBeenCalled();
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
