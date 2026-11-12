import { timezoneLabel } from './timezoneLabel';

test('shows only the offset valid on the birth date, never a zone name', () => {
  expect(timezoneLabel('Europe/Moscow', new Date('1990-05-15T12:00:00Z'))).toBe('UTC+4'); // summer time then
  expect(timezoneLabel('Europe/Moscow', new Date('2020-01-01T12:00:00Z'))).toBe('UTC+3');
  expect(timezoneLabel('Asia/Kolkata', new Date('2020-01-01T12:00:00Z'))).toBe('UTC+5:30');
  expect(timezoneLabel('Europe/London', new Date('2020-01-01T12:00:00Z'))).toBe('UTC');
});

test('places that lived on Moscow time are not called Moscow', () => {
  const kyiv = timezoneLabel('Europe/Kyiv', new Date('1985-06-01T12:00:00Z'));
  const minsk = timezoneLabel('Europe/Minsk', new Date('2015-06-01T12:00:00Z'));
  expect(kyiv).toBe('UTC+4');
  expect(minsk).toBe('UTC+3');
  for (const label of [kyiv, minsk]) expect(label).not.toMatch(/Москва|[А-Яа-я]/);
});

test('without a usable date, or for an unknown zone, there is nothing to show', () => {
  expect(timezoneLabel('Europe/Moscow')).toBe('');
  expect(timezoneLabel('Europe/Moscow', new Date('nope'))).toBe('');
  expect(timezoneLabel('Invalid/Zone', new Date('2020-01-01T12:00:00Z'))).toBe('');
  expect(timezoneLabel('', new Date())).toBe('');
  expect(timezoneLabel(null)).toBe('');
});
