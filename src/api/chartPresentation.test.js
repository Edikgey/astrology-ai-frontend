import { chartPresentation, saveChartPresentation } from './chartPresentation';

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
