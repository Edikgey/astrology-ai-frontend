import { timezoneLabel } from './timezoneLabel';

test('shows a city or region and the offset valid on the given date, in plain Russian', () => {
  expect(timezoneLabel('Europe/Moscow', new Date('2020-01-01T12:00:00Z'))).toBe('Москва, UTC+3');
  // Moscow kept summer time in 1992: the offset is the historical one, not today's.
  expect(timezoneLabel('Europe/Moscow', new Date('1992-09-03T12:00:00Z'))).toBe('Москва, UTC+4');
  expect(timezoneLabel('Asia/Kolkata', new Date('2020-01-01T12:00:00Z'))).toBe('Индия, UTC+5:30');
});

test('without a usable date only the name is shown; an unknown zone gives nothing', () => {
  expect(timezoneLabel('Europe/Moscow')).toBe('Москва');
  expect(timezoneLabel('Europe/Moscow', new Date('nope'))).toBe('Москва');
  expect(timezoneLabel('Invalid/Zone', new Date('2020-01-01T12:00:00Z'))).toBe('');
  expect(timezoneLabel('', new Date())).toBe('');
  expect(timezoneLabel(null)).toBe('');
});
