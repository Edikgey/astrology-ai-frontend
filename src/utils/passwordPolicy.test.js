import { validNewPassword, PASSWORD_SPECIALS } from './passwordPolicy';

test.each(['Abcdef1!', 'Ab1!'+'x'.repeat(60), 'Correct-Horse9!', ...[...PASSWORD_SPECIALS].map(c=>'Abcdef1'+c)])('accepts valid ASCII password %#', password => {
  expect(validNewPassword(password)).toBe(true);
});
test.each(['Abcde1!', 'Ab1!'+'x'.repeat(61), 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef12',
  'Abcdef1!я','Abcdef1!é','Abcdef1!中','Abcdef1!🙂','Abcd 12!', 'Abcdef1!\n','Abcdef1!\t','Abcdef1!\u00a0','Abcdef1!\x00',''])('rejects invalid password %#', password => {
  expect(validNewPassword(password)).toBe(false);
});
