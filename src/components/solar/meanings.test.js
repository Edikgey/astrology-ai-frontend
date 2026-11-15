// ---- SOLAR-1-fe, SR8 «таблица смыслов» (tasks/SOLAR-1/DESIGN.md §6 «Таблица смыслов», §7 SR8) ----
// Регрессия до кода. Имена экспортов выбраны test-engineer (tasks/SOLAR-1/REGRESSION-fe.md), автор их соблюдает:
//   ASCENDANT_TONES    массив из 12 строк, индекс = ascendant_sign (0 = Овен … 11 = Рыбы) — тон асцендента года;
//   SUN_HOUSE_PHRASES  массив из 12 строк, индекс = дом Солнца − 1 — фраза дома Солнца для обзора;
//   MOON_SIGN_PHRASES  массив из 12 строк, индекс = moon_sign (0 = Овен … 11 = Рыбы) — фраза знака Луны для обзора;
//   HOUSE_SPHERES      массив из 12 строк, индекс = дом − 1 — «сфера» дома: «Солнце года — в 10-м доме: <сфера>»;
//   POINT_GENITIVES    { [символ точки]: родительный падеж } — ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ AS MC, без «вашего»: «Оппозиция Меркурия и Марса»;
//   ASPECT_TONES       { conjunction, soft, hard } — тон семьи первого аспекта (ASPECT_TYPES[…].family).
// Содержание текстов пишет author-opus, тон проверяет reviewer; тест держит форму: простой русский, строка ≤ 140 знаков,
// без латиницы, без запретных слов (обещания, запреты, здоровье, деньги).

const POINT_SYMBOLS = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♅", "♆", "♇", "AS", "MC"];
const GENITIVES = ["Солнца", "Луны", "Меркурия", "Венеры", "Марса", "Юпитера", "Сатурна", "Урана", "Нептуна", "Плутона", "Асцендента", "Середины неба"];
const TONES = ["conjunction", "soft", "hard"];
const ARRAYS = ["ASCENDANT_TONES", "SUN_HOUSE_PHRASES", "MOON_SIGN_PHRASES", "HOUSE_SPHERES"];

// На базе файла нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом.
const load = () => {
  try { return require("./meanings"); }
  catch (error) { throw new Error(`src/components/solar/meanings.js не существует (DESIGN §6): ${error.message}`); }
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

describe("SR8: таблица смыслов «Мой год»", () => {
  test.each(ARRAYS)("%s: 12 строк, все разные, каждая — простой русский ≤ 140 знаков без латиницы и запретных слов", name => {
    const table = exported(name);
    expect(Array.isArray(table)).toBe(true);
    expect(table).toHaveLength(12);
    table.forEach((text, index) => checkLine(text, `${name}[${index}]`));
    expect(new Set(table).size).toBe(12);
  });

  test("точки: ровно 12 символов, родительный падеж дословно из DESIGN §6 (без «вашего»), все разные", () => {
    const table = exported("POINT_GENITIVES");
    expect(Object.keys(table).sort()).toEqual([...POINT_SYMBOLS].sort());
    POINT_SYMBOLS.forEach((symbol, index) => {
      expect(table[symbol]).toBe(GENITIVES[index]);
      checkLine(table[symbol], symbol);
    });
    expect(new Set(POINT_SYMBOLS.map(symbol => table[symbol])).size).toBe(12);
  });

  test("тона аспектов: conjunction, soft, hard — три разные строки, ни одна не содержится в другой", () => {
    const table = exported("ASPECT_TONES");
    expect(Object.keys(table).sort()).toEqual([...TONES].sort());
    TONES.forEach(tone => checkLine(table[tone], tone));
    expect(new Set(TONES.map(tone => table[tone])).size).toBe(3);
    TONES.forEach(one => TONES.filter(other => other !== one).forEach(other => expect(table[one]).not.toContain(table[other])));
  });

  test("в таблицах нет общих строк между тонами асцендента, фразами дома Солнца и фразами знака Луны (обзор не повторяется)", () => {
    const all = [...exported("ASCENDANT_TONES"), ...exported("SUN_HOUSE_PHRASES"), ...exported("MOON_SIGN_PHRASES")];
    expect(new Set(all).size).toBe(36);
  });
});
