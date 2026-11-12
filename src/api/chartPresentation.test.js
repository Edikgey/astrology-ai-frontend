import { chartPresentation, saveChartPresentation, chartLabels, chartLabel } from './chartPresentation';

beforeEach(() => localStorage.clear());
test('labels stay attached to their chart, and optional display storage contains no birth or auth data', () => {
  saveChartPresentation(7, { name: '  Моя карта  ', birthDate: '2000-01-01', sessionToken: 'fixture' });
  saveChartPresentation(8, { name: 'Другая карта' });
  expect(chartPresentation(7)).toEqual({ name: 'Моя карта' });
  expect(chartPresentation(8)).toEqual({ name: 'Другая карта' });
  expect(chartPresentation(9)).toEqual({});
});
test('malformed optional labels do not crash chart rendering', () => {
  localStorage.setItem('chart-presentation:7', '{bad json');
  expect(chartPresentation(7)).toEqual({});
});

const dated = [{ chart_id: 7, day: 3, month: 9, year: 1992 }, { chart_id: 8, day: 14, month: 1, year: 2001 }, { chart_id: 10, day: 5, month: 5, year: 1980 }];
test('one name for an unnamed chart: device label first, else «Карта без названия», with the birth date when several are unnamed', () => {
  saveChartPresentation(10, { name: 'Мама' });
  expect(chartLabels(dated)).toEqual({ 7: 'Карта без названия · 03.09.1992', 8: 'Карта без названия · 14.01.2001', 10: 'Мама' });
  expect(chartLabels([dated[0], dated[2]])).toEqual({ 7: 'Карта без названия', 10: 'Мама' });
  expect(chartLabels([{ chart_id: 7 }, { chart_id: 8 }])).toEqual({ 7: 'Карта без названия', 8: 'Карта без названия' });
  expect(Object.values(chartLabels(dated)).join('')).not.toContain('№');
});
test('chartLabel names a single chart without knowing the others; storage is read once per chart', () => {
  expect(chartLabel({ chart_id: 9 })).toBe('Карта без названия');
  saveChartPresentation(9, { name: 'Я' });
  expect(chartLabel({ chart_id: 9 })).toBe('Я');
  const read = jest.spyOn(Storage.prototype, 'getItem');
  chartLabels(dated);
  expect(read).toHaveBeenCalledTimes(dated.length);
  read.mockRestore();
});
