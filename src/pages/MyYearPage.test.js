import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { chartRequest } from "../api/chartsApi";
import { ASPECT_TYPES, SIGNS, SIGNS_IN } from "../components/natal/model";

// ---- SOLAR-1-fe, SR7 (tasks/SOLAR-1/DESIGN.md §3 «Контракт», §4 «Отказы», §6 «Страница», §7 SR7) ----
// Регрессия до кода. Тексты — литералы из DESIGN §3–§6, тесты сравнивают дословно.
// Страница `src/pages/MyYearPage.js` — копия каркаса MoonTodayPage: вход, список карт, выбор карты, ?chart=. Чата нет:
// запрос `GET /natal-chart/{id}/solar-return?tz=` идёт через chartRequest (подменён, как в MoonTodayPage.test.js), текст на экране
// собирает фронтенд из таблицы смыслов `src/components/solar/meanings.js` (имена экспортов — meanings.test.js и REGRESSION-fe.md).
// Допущения, которых DESIGN прямо не фиксирует (автору учесть или вернуть вопрос координатору):
//  1. Загрузка списка карт, ошибка списка и «Повторить загрузку» — как в MoonTodayPage (DESIGN §6: «каркас — копия MoonTodayPage.js»).
//  2. «Главные темы» и «Обзор года» — отдельные блоки: `<section>` с заголовком h2/h3 с этим текстом. В «Главных темах» — строки
//     «Асцендент года — Рак» + ASCENDANT_TONES[знак], «Солнце года — в 10-м доме: <HOUSE_SPHERES>», «Луна года — в Овне, в 10-м доме:
//     <HOUSE_SPHERES>» и подзаголовок «Сильные аспекты» (h2–h4) со строками аспектов; в «Обзоре года» — ровно слова таблицы смыслов
//     подряд: ASCENDANT_TONES → SUN_HOUSE_PHRASES → MOON_SIGN_PHRASES → ASPECT_TONES (тон семьи первого аспекта; без аспектов —
//     без тона). Семья: ☌ conjunction, ⚹ △ soft, □ ☍ hard (ASPECT_TYPES[…].family).
//  3. «Повторить» — только у 503 и сетевой ошибки; у 404/403/422 повтор ничего не изменит, кнопки нет.
//  4. Аспекты — в порядке ответа сервера (он уже по силе, DESIGN §3), в виде «Оппозиция Меркурия и Марса» (POINT_GENITIVES, без «вашего»).
//  5. Дата — «10 марта 2027 в 11:30» из строки YYYY-MM-DD без `new Date(строка)` (DESIGN §6); день без нуля, месяц в родительном падеже.

let mockAuth;
let mockSearch = "";
let mockParamsCache = { search: null, params: null };
const mockParams = () => {
  if (mockParamsCache.search !== mockSearch) mockParamsCache = { search: mockSearch, params: new URLSearchParams(mockSearch) };
  return mockParamsCache.params;
};
const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockParams(), mockSetSearchParams],
  useLocation: () => ({ pathname: "/my-year", search: mockSearch, state: null }),
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));

const chart7 = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };
const chart8 = { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "Other city" };
const chart9 = { chart_id: 9, year: 1988, month: 5, day: 30, hour: 20, city: "Third city" };
const listOf = (...charts) => ({ charts, count: charts.length, limit: 10 });

const TITLE = "Мой год";
const SUBTITLE = "Карта года от вашего дня рождения: когда начался год и какие темы в нём главные.";
const GUEST_TITLE = "Войдите, чтобы увидеть свой год";
const GUEST_TEXT = "Карта года строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.";
const NO_CHARTS_TITLE = "Сначала создайте карту";
const NO_CHARTS_TEXT = "Карта года строится по вашей натальной карте — это займёт минуту.";
const LIST_ERROR = "Не удалось загрузить карты. Попробуйте ещё раз.";
const LOADING = "Строим карту года...";
const LEGACY = "Карту года для этой карты не построить: она создана в старой версии Lunaria, где часовой пояс рождения не проверялся. Постройте карту заново, выбрав место рождения из подсказок, и откройте «Мой год» для новой карты.";
const UNAVAILABLE = "Сейчас не получилось рассчитать карту года. Попробуйте ещё раз через несколько минут.";
const MISSING = "Не удалось найти сохранённые положения планет этой карты.";
const NOT_FOUND = "Карта не найдена или недоступна.";
const NETWORK = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
const FOOT_DEVICE = "Время — по часовому поясу вашего устройства.";
const FOOT_BIRTH = "Время — по часовому поясу места рождения.";
const FOOT_PLACE = "Карта года построена для места рождения.";
const FOOT_ANGLES = "Асцендент, дома и аспекты к Асценденту и Середине неба зависят от точного времени рождения.";
const FOOT_SUN = "Год начинается, когда Солнце возвращается туда, где было при вашем рождении, — на день раньше или позже дня рождения это нормально.";
const NO_ASPECTS = "В этом году тесных аспектов нет.";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const GENITIVES = { "☉": "Солнца", "☽": "Луны", "☿": "Меркурия", "♀": "Венеры", "♂": "Марса", "♃": "Юпитера", "♄": "Сатурна", "♅": "Урана", "♆": "Нептуна", "♇": "Плутона", AS: "Асцендента", MC: "Середины неба" };

// Случай S1 из DESIGN §3/§5: Киев, год с 10 марта 2027 11:30 по 9 марта 2028 17:19, Асцендент — Рак (3), Солнце — 10-й дом,
// Луна — Овен (0), 10-й дом; три аспекта по силе.
const yearS1 = {
  timezone: "Europe/Kyiv",
  start: { date: "2027-03-10", time: "11:30" }, next: { date: "2028-03-09", time: "17:19" },
  ascendant_sign: 3, sun_house: 10, moon_sign: 0, moon_house: 10,
  aspects: [{ a: "☿", aspect: "☍", b: "♂" }, { a: "☽", aspect: "☌", b: "♄" }, { a: "☽", aspect: "□", b: "AS" }],
};
const year = (patch = {}) => ({ ...yearS1, ...patch });
const SHOWN = ["Оппозиция Меркурия и Марса", "Соединение Луны и Сатурна", "Квадрат Луны и Асцендента"];

// Страницы на базе нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом файла.
const loadPage = () => {
  try { return require("./MyYearPage").default; }
  catch (error) { throw new Error(`src/pages/MyYearPage.js не существует (DESIGN §6): ${error.message}`); }
};
const meanings = () => {
  try { return require("../components/solar/meanings"); }
  catch (error) { throw new Error(`src/components/solar/meanings.js не существует (DESIGN §6): ${error.message}`); }
};

let container, root, zoneSpy;
const setZone = zone => {
  if (zoneSpy) zoneSpy.mockRestore();
  zoneSpy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => ({ resolvedOptions: () => ({ timeZone: zone }) }));
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  jest.clearAllMocks();
  chartRequest.mockReset();
  mockSearch = "";
  mockAuth = { user: null, loading: false, authError: null };
  setZone("Europe/Kyiv");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  zoneSpy.mockRestore();
  zoneSpy = null;
});

const signIn = () => { mockAuth = { user: { id: 1 }, loading: false, authError: null }; localStorage.setItem("access_token", "jwt"); };
const render = async () => { const Page = loadPage(); await act(async () => root.render(<Page />)); };
const rerender = async () => { const Page = loadPage(); await act(async () => root.render(<Page />)); };
const remount = async () => {
  await act(async () => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
};
const text = () => container.textContent.replace(/ /g, " ");
const control = label => [...container.querySelectorAll("a, button")].find(el => el.textContent.trim() === label);
const alertText = () => container.querySelector("[role=alert]")?.textContent;
const yearCalls = () => chartRequest.mock.calls.filter(([path]) => String(path).includes("/solar-return"));
const yearPaths = () => yearCalls().map(([path]) => path);
const destination = async el => {
  mockNavigate.mockClear();
  el.addEventListener("click", event => event.preventDefault(), { once: true });
  await act(async () => el.click());
  if (el.tagName === "A") return { to: el.getAttribute("href"), state: el.dataset.state ? JSON.parse(el.dataset.state) : undefined };
  const [to, options] = mockNavigate.mock.calls[0] || [];
  return { to, state: options?.state };
};
const sectionOf = title => {
  const heading = [...container.querySelectorAll("h2, h3, h4")].find(el => el.textContent.trim() === title);
  return heading && (heading.closest("section") || heading.parentElement);
};
const themesBlock = () => sectionOf("Главные темы");
const overviewBlock = () => sectionOf("Обзор года");
const blockText = block => block.textContent.replace(/ /g, " ");
// Сервер отвечает на список карт и на год по пути запроса; solar — значение, функция или отказ.
const serve = ({ charts = [chart7], solar = year() } = {}) => chartRequest.mockImplementation(async path => {
  if (path === "/natal-charts") return listOf(...charts);
  if (String(path).includes("/solar-return")) {
    const value = typeof solar === "function" ? solar(path) : solar;
    if (value instanceof Error) throw value;
    return value;
  }
  throw new Error(`неожиданный запрос ${path}`);
});
const refusal = (message, status) => Object.assign(new Error(message), { status });
const stamp = (date, time) => ({ date, time });
const noPost = () => expect(chartRequest.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);

describe("SR7: гость, вход и 401 — раздел входа, без запросов", () => {
  test("гость: заголовок, объяснение, «Войти» с returnTo /my-year и «Создать карту» → /try-free; ни карт, ни года", async () => {
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(text()).toContain(SUBTITLE);
    expect(text()).toContain(GUEST_TITLE);
    expect(text()).toContain(GUEST_TEXT);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/my-year" } });
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chartRequest).not.toHaveBeenCalled();
    expect(container.querySelector("select")).toBeNull();
    expect(themesBlock()).toBeFalsy();
    expect(overviewBlock()).toBeFalsy();
  });

  test("нет user, но в localStorage остался токен: запросов нет (права решает сервер, не токен)", async () => {
    localStorage.setItem("access_token", "stale-jwt");
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(chartRequest).not.toHaveBeenCalled();
  });

  test("список карт ответил 401 — тот же раздел входа, года нет", async () => {
    signIn();
    chartRequest.mockRejectedValue(refusal("Сессия истекла. Войдите снова.", 401));
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/my-year" } });
    expect(yearCalls()).toHaveLength(0);
    expect(text()).not.toContain(LIST_ERROR);
  });

  test("год ответил 401 — раздел входа с returnTo /my-year, без текста ошибки и без «Повторить»", async () => {
    signIn();
    serve({ solar: refusal("Сессия истекла. Войдите снова.", 401) });
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/my-year" } });
    expect(control("Повторить")).toBeUndefined();
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  test("проверка аккаунта идёт — «Проверка аккаунта...», без раздела входа и без запросов", async () => {
    mockAuth = { user: null, loading: true, authError: null };
    await render();
    expect(text()).toContain("Проверка аккаунта...");
    expect(text()).not.toContain(GUEST_TITLE);
    expect(chartRequest).not.toHaveBeenCalled();
  });

  test("не удалось проверить вход (authError) — страница молчит: раздела входа и запросов нет", async () => {
    mockAuth = { user: null, loading: false, authError: new Error("offline") };
    await render();
    expect(text()).not.toContain(GUEST_TITLE);
    expect(text()).not.toContain("Проверка аккаунта...");
    expect(chartRequest).not.toHaveBeenCalled();
  });
});

describe("SR7: список карт и выбор карты — запрос несёт tz и chart только из своего списка", () => {
  test("карт 0: «Сначала создайте карту» и «Создать карту» → /try-free, запроса года нет", async () => {
    signIn();
    serve({ charts: [] });
    await render();
    expect(chartRequest.mock.calls[0][0]).toBe("/natal-charts");
    expect(text()).toContain(NO_CHARTS_TITLE);
    expect(text()).toContain(NO_CHARTS_TEXT);
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(yearCalls()).toHaveLength(0);
    expect(container.querySelector("select")).toBeNull();
  });

  test("список ещё грузится: «Загрузка карт...», года нет", async () => {
    signIn();
    chartRequest.mockReturnValue(new Promise(() => {}));
    await render();
    expect(text()).toContain("Загрузка карт...");
    expect(yearCalls()).toHaveLength(0);
  });

  test("ошибка списка (не 401): текст и «Повторить загрузку»; повтор — новый запрос списка, затем год", async () => {
    signIn();
    let listCalls = 0;
    chartRequest.mockImplementation(async path => {
      if (path === "/natal-charts") { listCalls += 1; if (listCalls === 1) throw refusal("boom", 500); return listOf(chart7); }
      return year();
    });
    await render();
    expect(alertText()).toContain(LIST_ERROR);
    expect(text()).not.toContain(GUEST_TITLE);
    expect(yearCalls()).toHaveLength(0);
    expect(listCalls).toBe(1); // автоповтора нет
    await act(async () => control("Повторить загрузку").click());
    expect(listCalls).toBe(2);
    expect(yearPaths()).toEqual(["/natal-chart/7/solar-return?tz=Europe%2FKyiv"]);
    expect(text()).not.toContain(LIST_ERROR);
  });

  test("карт 1: «Карта: <имя>», без выбора; запрос года несёт tz, authenticated и сигнал отмены", async () => {
    signIn();
    serve();
    await render();
    expect(text()).toContain("Карта: Карта без названия");
    expect(container.querySelector("select")).toBeNull();
    expect(yearCalls()).toHaveLength(1);
    const [path, options] = yearCalls()[0];
    expect(path).toBe("/natal-chart/7/solar-return?tz=Europe%2FKyiv");
    expect(options.authenticated).toBe(true);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    expect(options.method === undefined || options.method === "GET").toBe(true);
  });

  test("tz берётся у устройства и кодируется: America/Argentina/Buenos_Aires", async () => {
    signIn();
    serve();
    setZone("America/Argentina/Buenos_Aires");
    await render();
    expect(yearPaths()).toEqual(["/natal-chart/7/solar-return?tz=America%2FArgentina%2FBuenos_Aires"]);
  });

  test("браузер не дал пояс (resolvedOptions без timeZone) — запрос без tz вовсе", async () => {
    signIn();
    serve();
    zoneSpy.mockRestore();
    zoneSpy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => ({ resolvedOptions: () => ({}) }));
    await render();
    expect(yearPaths()).toEqual(["/natal-chart/7/solar-return"]);
  });

  test("карт 3: <label>Карта <select> в порядке создания, по умолчанию первая сохранённая; год запрашивается для 7", async () => {
    signIn();
    serve({ charts: [chart9, chart8, chart7] }); // сервер: новые сверху
    await render();
    const select = container.querySelector("select");
    expect(select.labels[0].textContent).toContain("Карта");
    expect([...select.options].map(option => option.value)).toEqual(["7", "8", "9"]);
    expect(select.value).toBe("7");
    expect(yearPaths()).toEqual(["/natal-chart/7/solar-return?tz=Europe%2FKyiv"]);
  });

  test("?chart=8 — своя карта выбрана, год запрашивается для 8", async () => {
    signIn();
    mockSearch = "?chart=8";
    serve({ charts: [chart9, chart8, chart7] });
    await render();
    expect(container.querySelector("select").value).toBe("8");
    expect(yearPaths()).toEqual(["/natal-chart/8/solar-return?tz=Europe%2FKyiv"]);
  });

  test.each([["чужой id", "?chart=99"], ["кривой id", "?chart=abc"], ["пустой", "?chart="], ["дробный", "?chart=8.5"], ["пара-инъекция", "?chart=8%2F../9"]])(
    "?chart — %s: не уходит на сервер, выбрана первая сохранённая (7)", async (_name, search) => {
      signIn();
      mockSearch = search;
      serve({ charts: [chart9, chart8, chart7] });
      await render();
      expect(container.querySelector("select").value).toBe("7");
      expect(yearPaths()).toEqual(["/natal-chart/7/solar-return?tz=Europe%2FKyiv"]);
    });

  test("смена карты → setSearchParams({ chart }, { replace: true }); карты не создаются и не удаляются", async () => {
    signIn();
    serve({ charts: [chart9, chart8, chart7] });
    await render();
    await act(async () => Simulate.change(container.querySelector("select"), { target: { value: "9" } }));
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const [params, options] = mockSetSearchParams.mock.calls[0];
    expect(String(params.chart)).toBe("9");
    expect(options).toEqual({ replace: true });
    noPost();
  });

  test("в адресе сменилась карта: год запрашивается заново для новой, прежний запрос отменён, пока ждём — «Строим карту года...»", async () => {
    signIn();
    let release;
    chartRequest.mockImplementation(async (path, options) => {
      if (path === "/natal-charts") return listOf(chart9, chart8, chart7);
      if (path.includes("/natal-chart/7/")) return year();
      return new Promise(resolve => { release = () => resolve(year({ ascendant_sign: 5 })); options.signal.addEventListener("abort", () => {}); });
    });
    await render();
    const firstSignal = yearCalls()[0][1].signal;
    expect(text()).toContain("Асцендент года — Рак");
    mockSearch = "?chart=9";
    await rerender();
    expect(yearPaths()).toEqual(["/natal-chart/7/solar-return?tz=Europe%2FKyiv", "/natal-chart/9/solar-return?tz=Europe%2FKyiv"]);
    expect(firstSignal.aborted).toBe(true);
    expect(text()).toContain(LOADING);
    expect(text()).not.toContain("Асцендент года — Рак"); // год прежней карты на новой не показываем
    await act(async () => release());
    expect(text()).toContain("Асцендент года — Дева");
  });
});

describe("SR7: год — что видит человек (ответ DESIGN §3, случай S1)", () => {
  beforeEach(() => signIn());

  test("год S1: заголовок, оба момента, асцендент, дом Солнца, Луна, аспекты по порядку, обзор не пустой", async () => {
    const m = meanings();
    serve();
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(text()).toContain("Ваш год начался 10 марта 2027 в 11:30. Следующий начнётся 9 марта 2028 в 17:19.");
    expect(text()).toContain("10 марта 2027 в 11:30");
    expect(text()).toContain("9 марта 2028 в 17:19");
    const themes = blockText(themesBlock());
    expect(themes).toContain("Асцендент года — Рак");
    expect(themes).toContain(m.ASCENDANT_TONES[3]);
    expect(themes).toContain("Солнце года — в 10-м доме");
    expect(themes).toContain(`Солнце года — в 10-м доме: ${m.HOUSE_SPHERES[9]}`);
    expect(themes).toContain("Луна года — в Овне, в 10-м доме");
    expect(themes).toContain(`Луна года — в Овне, в 10-м доме: ${m.HOUSE_SPHERES[9]}`);
    expect(text()).toContain("Сильные аспекты");
    const positions = SHOWN.map(line => { expect(text()).toContain(line); return text().indexOf(line); });
    expect([...positions].sort((a, b) => a - b)).toEqual(positions); // порядок ответа сервера
    expect(overviewBlock()).toBeTruthy();
    expect(blockText(overviewBlock()).replace("Обзор года", "").trim().length).toBeGreaterThan(40);
    expect(text()).not.toContain(LOADING);
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  test("запрос года ровно один, чтение: без POST; повторный показ той же карты не создаёт записей", async () => {
    serve();
    await render();
    expect(yearCalls()).toHaveLength(1);
    noPost();
  });

  test("сноски: пояс устройства; место рождения; «зависят от точного времени рождения»; объяснение дня возвращения Солнца", async () => {
    serve();
    await render();
    expect(text()).toContain(FOOT_DEVICE);
    expect(text()).not.toContain(FOOT_BIRTH);
    expect(text()).toContain(FOOT_PLACE);
    expect(text()).toContain(FOOT_ANGLES);
    expect(text()).toContain(FOOT_SUN);
  });

  test("сноска пояса: ответ в другом поясе (отправили Europe/Kyiv, сервер считал по поясу карты) — «места рождения»", async () => {
    serve({ solar: year({ timezone: "Asia/Kathmandu" }) });
    await render();
    expect(text()).toContain(FOOT_BIRTH);
    expect(text()).not.toContain(FOOT_DEVICE);
    expect(text()).toContain(FOOT_PLACE);
    expect(text()).toContain(FOOT_ANGLES);
    expect(text()).toContain(FOOT_SUN);
  });

  test("без пояса устройства (запрос без tz) — «по часовому поясу места рождения», не «вашего устройства»", async () => {
    zoneSpy.mockRestore();
    zoneSpy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => ({ resolvedOptions: () => ({}) }));
    serve();
    await render();
    expect(text()).toContain(FOOT_BIRTH);
    expect(text()).not.toContain(FOOT_DEVICE);
  });

  test("на странице нет латиницы, символов планет и аспектов, сырых кодов; числа и даты без «NaN», «undefined»", async () => {
    serve();
    await render();
    expect(text()).not.toMatch(/[A-Za-z]/);
    expect(text()).not.toMatch(/[☉☽☿♀♂♃♄♅♆♇☌⚹□△☍]/);
    expect(text()).not.toMatch(/ascendant_sign|sun_house|moon_sign|moon_house|aspects|timezone|solar/);
    expect(text()).not.toMatch(/undefined|NaN|null|\[object/);
  });
});

describe("SR7: даты и время — «10 марта 2027 в 11:30»", () => {
  beforeEach(() => signIn());

  test.each(MONTHS.map((month, index) => [month, index + 1]))("месяц в родительном падеже: %s", async (month, number) => {
    const mm = String(number).padStart(2, "0");
    serve({ solar: year({ start: stamp(`2027-${mm}-05`, "09:07"), next: stamp(`2028-${mm}-28`, "00:05") }) });
    await render();
    expect(text()).toContain(`Ваш год начался 5 ${month} 2027 в 09:07. Следующий начнётся 28 ${month} 2028 в 00:05.`);
    expect(text()).not.toMatch(/\b0\d (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/); // день без нуля
  });

  test("через Новый год (S5): начался 1 января 2027 в 01:00 — следующий 1 января 2028 в 06:43, без сдвига дня и года", async () => {
    serve({ solar: year({ start: stamp("2027-01-01", "01:00"), next: stamp("2028-01-01", "06:43") }) });
    await render();
    expect(text()).toContain("Ваш год начался 1 января 2027 в 01:00. Следующий начнётся 1 января 2028 в 06:43.");
  });

  test("день и месяц собираются из строки, а не через new Date(строка): ни одного new Date с текстом, пока страница строится", async () => {
    serve({ solar: year({ start: stamp("2026-12-31", "23:00"), next: stamp("2027-12-31", "22:59") }) });
    const RealDate = global.Date;
    const calls = [];
    // Строка в конструкторе Date разбирается в UTC, а показывается в поясе браузера: в часовом поясе западнее UTC день уезжает назад.
    global.Date = class extends RealDate {
      constructor(...args) { if (typeof args[0] === "string") calls.push(args[0]); super(...args); }
    };
    try { await render(); } finally { global.Date = RealDate; }
    expect(calls).toEqual([]);
    expect(text()).toContain("Ваш год начался 31 декабря 2026 в 23:00. Следующий начнётся 31 декабря 2027 в 22:59.");
  });

  test("время показывается как пришло: «HH:MM» без секунд и без «:00» сзади", async () => {
    serve({ solar: year({ start: stamp("2027-05-21", "00:35"), next: stamp("2028-05-20", "06:27") }) });
    await render();
    expect(text()).toContain("21 мая 2027 в 00:35");
    expect(text()).toContain("20 мая 2028 в 06:27");
    expect(text()).not.toMatch(/\d\d:\d\d:\d\d/);
  });
});

describe("SR7: «Главные темы» и «Обзор года» собираются из таблицы смыслов", () => {
  beforeEach(() => signIn());
  const view = async patch => { serve({ solar: year(patch) }); await remount(); await render(); };

  test("асцендент года: все 12 знаков — «Асцендент года — <знак>» и тон этого знака, тонов соседних знаков в блоке нет", async () => {
    const { ASCENDANT_TONES } = meanings();
    for (let sign = 0; sign < 12; sign += 1) {
      await view({ ascendant_sign: sign });
      const themes = blockText(themesBlock());
      expect(themes).toContain(`Асцендент года — ${SIGNS[sign]}`);
      expect(themes).toContain(ASCENDANT_TONES[sign]);
      ASCENDANT_TONES.filter((_, other) => other !== sign).forEach(other => expect(themes).not.toContain(other));
    }
  });

  test("дом Солнца: все 12 домов — «Солнце года — в N-м доме: <сфера дома>»", async () => {
    const { HOUSE_SPHERES } = meanings();
    for (let house = 1; house <= 12; house += 1) {
      await view({ sun_house: house, moon_house: 1 });
      expect(blockText(themesBlock())).toContain(`Солнце года — в ${house}-м доме: ${HOUSE_SPHERES[house - 1]}`);
    }
  });

  test("знак и дом Луны: все 12 знаков — «Луна года — в <знак в предложном падеже>, в N-м доме: <сфера>»", async () => {
    const { HOUSE_SPHERES } = meanings();
    for (let sign = 0; sign < 12; sign += 1) {
      const house = sign + 1;
      await view({ moon_sign: sign, moon_house: house, sun_house: 1 });
      expect(blockText(themesBlock())).toContain(`Луна года — в ${SIGNS_IN[sign]}, в ${house}-м доме: ${HOUSE_SPHERES[house - 1]}`);
    }
  });

  test("аспекты: все 12 точек в родительном падеже и все 5 мажорных аспектов — «Оппозиция Меркурия и Марса» … «Трин Асцендента и Середины неба»", async () => {
    const names = Object.fromEntries(Object.entries(ASPECT_TYPES).map(([symbol, item]) => [symbol, item.name]));
    const points = Object.keys(GENITIVES);
    const aspectSymbols = ["☌", "⚹", "□", "△", "☍"];
    const triples = points.map((a, index) => ({ a, aspect: aspectSymbols[index % 5], b: points[(index + 5) % 12] }));
    for (let from = 0; from < triples.length; from += 3) {
      const batch = triples.slice(from, from + 3);
      await view({ aspects: batch });
      const lines = batch.map(item => `${names[item.aspect]} ${GENITIVES[item.a]} и ${GENITIVES[item.b]}`);
      const positions = lines.map(line => { expect(text()).toContain(line); return text().indexOf(line); });
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  test("аспектов 0: «В этом году тесных аспектов нет.», ни одного названия аспекта; обзор и темы на месте", async () => {
    await view({ aspects: [] });
    expect(text()).toContain(NO_ASPECTS);
    expect(text()).not.toMatch(/Соединение|Секстиль|Квадрат|Трин|Оппозиция/);
    expect(themesBlock()).toBeTruthy();
    expect(overviewBlock()).toBeTruthy();
    expect(text()).not.toMatch(/undefined|NaN|null|\[object/);
  });

  test("аспектов с ответом нет: фраза «тесных аспектов нет» не показывается, когда аспекты есть", async () => {
    serve();
    await render();
    expect(text()).not.toContain(NO_ASPECTS);
  });

  test("аспектов 1 и 2: показываются все, что пришли (не добиваются до трёх)", async () => {
    await view({ aspects: [{ a: "☉", aspect: "△", b: "♃" }] });
    expect(text()).toContain("Трин Солнца и Юпитера");
    await view({ aspects: [{ a: "☉", aspect: "△", b: "♃" }, { a: "♀", aspect: "⚹", b: "MC" }] });
    expect(text()).toContain("Трин Солнца и Юпитера");
    expect(text()).toContain("Секстиль Венеры и Середины неба");
  });

  test("обзор S1: слова таблицы подряд — тон асцендента → фраза дома Солнца → фраза знака Луны → тон первого аспекта (☿☍♂ — hard)", async () => {
    const { ASCENDANT_TONES, SUN_HOUSE_PHRASES, MOON_SIGN_PHRASES, ASPECT_TONES } = meanings();
    serve();
    await render();
    const overview = blockText(overviewBlock());
    const parts = [ASCENDANT_TONES[3], SUN_HOUSE_PHRASES[9], MOON_SIGN_PHRASES[0], ASPECT_TONES.hard];
    const positions = parts.map(part => { expect(overview).toContain(part); return overview.indexOf(part); });
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(overview).not.toContain(ASPECT_TONES.soft);
    expect(overview).not.toContain(ASPECT_TONES.conjunction);
  });

  test("обзор: фраза дома Солнца и фраза знака Луны — все 12 по индексу дома и знака; чужих фраз в обзоре нет", async () => {
    const { SUN_HOUSE_PHRASES, MOON_SIGN_PHRASES } = meanings();
    for (let index = 0; index < 12; index += 1) {
      await view({ sun_house: index + 1, moon_sign: (index + 5) % 12 });
      const overview = blockText(overviewBlock());
      expect(overview).toContain(SUN_HOUSE_PHRASES[index]);
      expect(overview).toContain(MOON_SIGN_PHRASES[(index + 5) % 12]);
      SUN_HOUSE_PHRASES.filter((_, other) => other !== index).forEach(other => expect(overview).not.toContain(other));
      MOON_SIGN_PHRASES.filter((_, other) => other !== (index + 5) % 12).forEach(other => expect(overview).not.toContain(other));
    }
  });

  test.each([
    ["соединение ☌", "☌", "conjunction"], ["секстиль ⚹", "⚹", "soft"], ["трин △", "△", "soft"],
    ["квадрат □", "□", "hard"], ["оппозиция ☍", "☍", "hard"],
  ])("тон обзора идёт от первого аспекта: %s → %s", async (_name, symbol, family) => {
    const { ASPECT_TONES } = meanings();
    // первый аспект задаёт тон, второй и третий — других семей, чтобы чужой тон в обзоре сразу был виден
    const others = ["☌", "⚹", "□"].filter(item => ASPECT_TYPES[item].family !== family).slice(0, 2);
    await view({ aspects: [{ a: "☉", aspect: symbol, b: "♃" }, ...others.map(aspect => ({ a: "♀", aspect, b: "♇" }))] });
    const overview = blockText(overviewBlock());
    expect(overview).toContain(ASPECT_TONES[family]);
    Object.keys(ASPECT_TONES).filter(other => other !== family).forEach(other => expect(overview).not.toContain(ASPECT_TONES[other]));
  });

  test("обзор без аспектов: три предложения — тон асцендента, дом Солнца, знак Луны; тона аспекта нет", async () => {
    const { ASCENDANT_TONES, SUN_HOUSE_PHRASES, MOON_SIGN_PHRASES, ASPECT_TONES } = meanings();
    await view({ aspects: [] });
    const overview = blockText(overviewBlock());
    expect(overview).toContain(ASCENDANT_TONES[3]);
    expect(overview).toContain(SUN_HOUSE_PHRASES[9]);
    expect(overview).toContain(MOON_SIGN_PHRASES[0]);
    Object.values(ASPECT_TONES).forEach(tone => expect(overview).not.toContain(tone));
  });

  test("тон асцендента показывается и в «Главных темах», и в обзоре (DESIGN §6: «Асцендент года — Рак» и тон; обзор начинается с тона)", async () => {
    const { ASCENDANT_TONES } = meanings();
    serve();
    await render();
    expect(blockText(themesBlock())).toContain(ASCENDANT_TONES[3]);
    expect(blockText(overviewBlock())).toContain(ASCENDANT_TONES[3]);
  });
});

describe("SR7: отказы и ошибки — текст сервера как есть, действие понятно", () => {
  beforeEach(() => signIn());

  test.each([
    ["422 старая карта", refusal(LEGACY, 422)],
    ["404 нет положений", refusal(MISSING, 404)],
    ["404 карта не найдена", refusal(NOT_FOUND, 404)],
    ["403 чужая карта", refusal("Эта карта вам недоступна.", 403)],
  ])("%s: текст в role=alert дословно, года нет, без «Повторить», без кодов и номеров", async (_name, error) => {
    serve({ solar: error });
    await render();
    expect(alertText()).toContain(error.message);
    expect(alertText()).not.toMatch(/SOLAR_|CHART_|\b(403|404|422|503)\b|undefined/);
    expect(themesBlock()).toBeFalsy();
    expect(overviewBlock()).toBeFalsy();
    expect(text()).not.toContain("Ваш год начался");
    expect(control("Повторить")).toBeUndefined();
    expect(text()).not.toContain(LOADING);
    expect(yearCalls()).toHaveLength(1); // автоповтора нет
  });

  test("422 старая карта: сообщение говорит, что делать — построить карту заново; кнопки «Повторить» нет", async () => {
    serve({ solar: refusal(LEGACY, 422) });
    await render();
    expect(alertText()).toContain("Постройте карту заново");
    expect(control("Повторить")).toBeUndefined();
  });

  test("503: текст сервера и «Повторить»; нажатие — второй запрос того же года, затем год и без ошибки", async () => {
    let attempts = 0;
    serve({ solar: () => { attempts += 1; return attempts === 1 ? refusal(UNAVAILABLE, 503) : year(); } });
    await render();
    expect(alertText()).toContain(UNAVAILABLE);
    expect(yearCalls()).toHaveLength(1);
    await act(async () => control("Повторить").click());
    expect(yearPaths()).toEqual(Array(2).fill("/natal-chart/7/solar-return?tz=Europe%2FKyiv"));
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(text()).toContain("Ваш год начался 10 марта 2027 в 11:30.");
    expect(chartRequest.mock.calls.filter(([path]) => path === "/natal-charts")).toHaveLength(1); // список повторно не грузится
    noPost();
  });

  test("сетевая ошибка (без status): «Нет связи…» и «Повторить»", async () => {
    serve({ solar: new Error(NETWORK) });
    await render();
    expect(alertText()).toContain(NETWORK);
    expect(control("Повторить")).toBeTruthy();
    expect(yearCalls()).toHaveLength(1);
  });

  test("пока считаем: «Строим карту года...», без года, без ошибки и без «Повторить»", async () => {
    chartRequest.mockImplementation(async path => path === "/natal-charts" ? listOf(chart7) : new Promise(() => {}));
    await render();
    expect(text()).toContain(LOADING);
    expect(themesBlock()).toBeFalsy();
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(control("Повторить")).toBeUndefined();
  });

  test("уход со страницы отменяет запрос года (AbortController)", async () => {
    chartRequest.mockImplementation(async path => path === "/natal-charts" ? listOf(chart7) : new Promise(() => {}));
    await render();
    const { signal } = yearCalls()[0][1];
    expect(signal.aborted).toBe(false);
    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);
    root = createRoot(container); // afterEach размонтирует уже пустой корень
  });

  test("отказ при отменённом запросе не показывается: после смены карты видна только новая карта", async () => {
    let abortOld;
    chartRequest.mockImplementation(async (path, options) => {
      if (path === "/natal-charts") return listOf(chart8, chart7);
      if (path.includes("/natal-chart/7/")) return new Promise((_, reject) => { abortOld = () => reject(refusal(UNAVAILABLE, 503)); options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))); });
      return year();
    });
    await render();
    mockSearch = "?chart=8";
    await rerender();
    await act(async () => { try { abortOld(); } catch { /* уже отклонён отменой */ } });
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(text()).toContain("Асцендент года — Рак");
  });
});
