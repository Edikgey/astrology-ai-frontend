import { SIGN_TEXTS } from './signTexts';
import { SIGNS } from '../natal/model';
import { bigThree, drawShareCard, CARD_WIDTH, CARD_HEIGHT } from './cardImage';

const bodies = {
  '☉': { symbol: '☉', label: 'Солнце', sign: 'Козерог', degree: 281.4 },
  '☽': { symbol: '☽', label: 'Луна', sign: 'Скорпион', degree: 235.5 },
  AS: { symbol: 'AS', label: 'Асцендент', sign: 'Рыбы', degree: 350.2 },
};

// Minimal canvas stub: records the text that would be painted.
function stubCanvas() {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'measureText') return text => ({ width: String(text).length * 10 });
      if (key === 'fillText') return text => texts.push(text);
      if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
      return key in target ? target[key] : () => {};
    },
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, texts };
}

beforeEach(() => { global.Path2D = class {}; });
afterEach(() => { delete global.Path2D; });

test('every sign has one short plain line for the Sun, the Moon and the Ascendant', () => {
  for (const position of ['sun', 'moon', 'asc']) {
    expect(SIGN_TEXTS[position]).toHaveLength(SIGNS.length);
    for (const line of SIGN_TEXTS[position]) {
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(10);
      expect(line.length).toBeLessThanOrEqual(56);
      expect(line).not.toMatch(/\d/);
    }
  }
});

test('the big three come from the chart bodies: sign, label and the line for that sign', () => {
  const three = bigThree(bodies, 'local_iana');
  expect(three.items.map(item => [item.id, item.sign])).toEqual([['sun', 'Козерог'], ['moon', 'Скорпион'], ['asc', 'Рыбы']]);
  expect(three.items[0].text).toBe(SIGN_TEXTS.sun[SIGNS.indexOf('Козерог')]);
  expect(three.ascNote).toBeNull();
});

test('a chart without a verified birth time shows two positions and an honest note, the Ascendant is not guessed', () => {
  for (const provenance of ['legacy_unverified', undefined]) {
    const three = bigThree(bodies, provenance);
    expect(three.items.map(item => item.id)).toEqual(['sun', 'moon']);
    expect(three.ascNote).toMatch(/Асцендент не показан/);
  }
});

test('a chart without the Ascendant point shows two positions', () => {
  const { AS, ...rest } = bodies;
  expect(bigThree(rest, 'local_iana').items.map(item => item.id)).toEqual(['sun', 'moon']);
});

test('without a readable Sun or Moon sign there is nothing to share', () => {
  expect(bigThree({ '☽': bodies['☽'] }, 'local_iana')).toBeNull();
  expect(bigThree({ ...bodies, '☽': { ...bodies['☽'], sign: 'Неизвестно' } }, 'local_iana')).toBeNull();
  expect(bigThree(undefined, 'local_iana')).toBeNull();
});

test('the card is 1080x1920 and paints the three signs, the site address and nothing personal', () => {
  const { canvas, texts } = stubCanvas();
  drawShareCard(canvas, bigThree(bodies, 'local_iana'));
  expect(canvas.width).toBe(1080);
  expect(canvas.height).toBe(1920);
  expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1080, 1920]);
  for (const sign of ['Козерог', 'Скорпион', 'Рыбы']) expect(texts).toContain(sign);
  expect(texts).toContain('mylunariaai.com');
  expect(texts.join(' ')).not.toMatch(/\d/);
});

test('without the Ascendant the card paints the honest note instead of a third sign', () => {
  const { canvas, texts } = stubCanvas();
  drawShareCard(canvas, bigThree(bodies, 'legacy_unverified'));
  expect(texts).not.toContain('Рыбы');
  expect(texts.join(' ')).toMatch(/Асцендент не показан/);
});
