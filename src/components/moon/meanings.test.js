// ---- LUNAR-1-fe, LD8 «таблица смыслов» (tasks/LUNAR-1/DESIGN.md §6 «Таблица смыслов», §7 LD8) ----
// Регрессия до кода. Имена экспортов выбраны test-engineer (tasks/LUNAR-1/REGRESSION-fe.md), автор их соблюдает:
//   PHASE_TEXTS    { [код фазы]: { name, advice } } — 8 кодов бэкенда §3;
//   SIGN_ADVICE    массив из 12 строк, порядок SIGNS (0 = Овен … 11 = Рыбы);
//   POINT_MEANINGS { [символ точки]: { genitive, theme } } — ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ AS MC;
//   TONE_ADVICE    { conjunction, soft, hard } — тон по семье аспекта (ASPECT_TYPES[…].family).
// Содержание текстов пишет author-opus, тон проверяет reviewer; тест держит форму: простой русский, строка ≤ 140 знаков,
// без латиницы, без запретных слов (обещания, запреты, здоровье, деньги).

const PHASE_CODES = ["new_moon", "waxing_crescent", "first_quarter", "waxing_gibbous", "full_moon", "waning_gibbous", "last_quarter", "waning_crescent"];
const PHASE_NAMES = ["Новолуние", "Растущий серп", "Первая четверть", "Растущая Луна", "Полнолуние", "Убывающая Луна", "Последняя четверть", "Старая Луна"];
const POINT_SYMBOLS = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♅", "♆", "♇", "AS", "MC"];
const GENITIVES = ["вашего Солнца", "вашей Луны", "вашего Меркурия", "вашей Венеры", "вашего Марса", "вашего Юпитера", "вашего Сатурна",
  "вашего Урана", "вашего Нептуна", "вашего Плутона", "вашего Асцендента", "вашей Середины неба"];
const TONES = ["conjunction", "soft", "hard"];

// На базе файла нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом.
const load = () => {
  try { return require("./meanings"); }
  catch (error) { throw new Error(`src/components/moon/meanings.js не существует (DESIGN §6): ${error.message}`); }
};
const exported = name => {
  const value = load()[name];
  if (value === undefined) throw new Error(`meanings.js не экспортирует ${name} (REGRESSION-fe.md)`);
  return value;
};

const FORBIDDEN = /нельзя|запрещ|не делайте|не стоит|ни в коем|гаранти|непременно|обязательно|точно (будет|случится)|здоров|самочувств|болезн|лечен|лекарств|диет|деньг|денеж|финанс|зарплат|инвест|прибыл|доход/i;
const checkLine = (text, where) => {
  expect(typeof text).toBe("string");
  expect(text.trim()).toBe(text);
  expect(text.length).toBeGreaterThan(0);
  expect(text.length).toBeLessThanOrEqual(140);
  expect(text).toMatch(/[а-яё]/i);
  expect(text).not.toMatch(/[A-Za-z]/);
  expect(text).not.toMatch(FORBIDDEN);
  expect(`${where}: ${text}`).not.toMatch(/undefined|null|NaN|\[object/);
};

describe("LD8: таблица смыслов Луны", () => {
  test("фазы: ровно 8 кодов бэкенда, названия дословно из DESIGN §6, совет у каждой", () => {
    const table = exported("PHASE_TEXTS");
    expect(Object.keys(table).sort()).toEqual([...PHASE_CODES].sort());
    PHASE_CODES.forEach((code, index) => {
      expect(table[code].name).toBe(PHASE_NAMES[index]);
      checkLine(table[code].name, code);
      checkLine(table[code].advice, code);
    });
  });

  test("знаки: 12 советов в порядке Овен … Рыбы, все разные", () => {
    const table = exported("SIGN_ADVICE");
    expect(Array.isArray(table)).toBe(true);
    expect(table).toHaveLength(12);
    table.forEach((text, index) => checkLine(text, `sign ${index}`));
    expect(new Set(table).size).toBe(12);
  });

  test("точки: 12 символов, родительный падеж дословно из DESIGN §6, тема у каждой", () => {
    const table = exported("POINT_MEANINGS");
    expect(Object.keys(table).sort()).toEqual([...POINT_SYMBOLS].sort());
    POINT_SYMBOLS.forEach((symbol, index) => {
      expect(table[symbol].genitive).toBe(GENITIVES[index]);
      checkLine(table[symbol].genitive, symbol);
      checkLine(table[symbol].theme, symbol);
    });
    expect(new Set(POINT_SYMBOLS.map(symbol => table[symbol].theme)).size).toBe(12);
  });

  test("тона: conjunction, soft, hard — три разные строки", () => {
    const table = exported("TONE_ADVICE");
    expect(Object.keys(table).sort()).toEqual([...TONES].sort());
    TONES.forEach(tone => checkLine(table[tone], tone));
    expect(new Set(TONES.map(tone => table[tone])).size).toBe(3);
  });

  test("советы фаз все разные", () => {
    const table = exported("PHASE_TEXTS");
    expect(new Set(PHASE_CODES.map(code => table[code].advice)).size).toBe(8);
  });
});
