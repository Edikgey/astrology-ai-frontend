import { normalizeFollowUps } from './followUpSuggestions';

const valid = [
  { type: 'deepen', text: 'What makes this reaction stronger?' },
  { type: 'personalize', text: 'How can I notice this in my life?' },
  { type: 'explore', text: 'How does this relate to trust?' },
];

test('typed questions retain text and canonical intent order', () => {
  expect(normalizeFollowUps([...valid].reverse())).toEqual(valid);
});

test('legacy strings work during rollout without fabricated semantic types', () => {
  const legacy = valid.map(item => item.text);
  expect(normalizeFollowUps(legacy)).toEqual(legacy.map(text => ({ type: null, text })));
  expect(normalizeFollowUps([...legacy, 'One more old question?'])).toHaveLength(4);
});

test.each([
  undefined, null, 'broken', [], valid.slice(0, 2), [...valid, valid[0]],
  [valid[0], valid[0], valid[2]],
  [valid[0], { type: 'unknown', text: 'Question?' }, valid[2]],
  [valid[0], null, valid[2]],
  [valid[0], 'legacy mixed with objects', valid[2]],
  [valid[0], { type: 'personalize' }, valid[2]],
  [valid[0], { type: 'personalize', text: 42 }, valid[2]],
  [valid[0], { type: 'personalize', text: '  ' }, valid[2]],
  [valid[0], { type: 'personalize', text: 'x'.repeat(101) }, valid[2]],
  [valid[0], { type: 'personalize', text: 'Line\nTwo' }, valid[2]],
  [valid[0], { type: 'personalize', text: valid[0].text.toUpperCase() }, valid[2]],
])('invalid enrichment is dropped safely: %j', candidates => {
  expect(normalizeFollowUps(candidates)).toEqual([]);
});
