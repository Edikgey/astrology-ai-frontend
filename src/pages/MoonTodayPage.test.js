import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { chartRequest } from "../api/chartsApi";

// ---- LUNAR-1-fe, LD7 (tasks/LUNAR-1/DESIGN.md §3 «Контракт», §4 «Отказы», §6 «Страница», §7 LD7) ----
// Регрессия до кода. Тексты — литералы из DESIGN §3–§6, тесты сравнивают дословно.
// Страница `src/pages/MoonTodayPage.js` — по образцу MyMonthPage: вход, список карт, выбор карты, ?chart=. Чата здесь нет:
// запрос `GET /natal-chart/{id}/moon-day?tz=` идёт через chartRequest (подменён, как в MyMonthPage.test.js), текст на экране
// собирает фронтенд из таблицы смыслов `src/components/moon/meanings.js` (имена экспортов — REGRESSION-fe.md).
// Допущения, которых DESIGN прямо не фиксирует (автору учесть или вернуть вопрос координатору):
//  1. Загрузка списка карт, ошибка списка и «Повторить загрузку» — как в MyMonthPage (DESIGN §6: «вход, список карт и выбор — как MyMonthPage»).
//  2. Совет на день — отдельный блок: `<section>` с заголовком h2/h3 «Совет на день»; в нём дословно строки таблицы:
//     совет фазы, совет знака Луны в полдень (смена знака до 12:00 — уже новый знак), тема главного аспекта и тон его семьи.
//     Главный аспект — у точки меньшей группы (☉ ☽ AS MC → ☿ ♀ ♂ → ♃ ♄ → ♅ ♆ ♇), при равенстве — раньше по времени.
//     Нет аспектов — ни тем, ни тонов в блоке нет. Семья: ☌ conjunction, ⚹ △ soft, □ ☍ hard.
//  3. «Повторить» — только у 503 и сетевой ошибки; у 404/403/422 повтор ничего не изменит, кнопки нет.
//  4. Аспекты — в порядке ответа сервера (он уже по времени, DESIGN §2 «порядок»).

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
  useLocation: () => ({ pathname: "/moon", search: mockSearch, state: null }),
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));

const chart7 = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };
const chart8 = { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "Other city" };
const chart9 = { chart_id: 9, year: 1988, month: 5, day: 30, hour: 20, city: "Third city" };
const listOf = (...charts) => ({ charts, count: charts.length, limit: 10 });

const TITLE = "Луна сегодня";
const SUBTITLE = "Фаза и знак Луны на сегодня и то, как она касается вашей карты.";
const GUEST_TITLE = "Войдите, чтобы увидеть свою Луну";
const GUEST_TEXT = "Лунный день считается по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.";
const NO_CHARTS_TITLE = "Сначала создайте карту";
const NO_CHARTS_TEXT = "Лунный день считается по вашей натальной карте — это займёт минуту.";
const LIST_ERROR = "Не удалось загрузить карты. Попробуйте ещё раз.";
const LOADING = "Считаем Луну...";
const LEGACY = "Луну на сегодня для этой карты не посчитать: она построена в старой версии Lunaria, где часовой пояс рождения не проверялся. Постройте карту заново, выбрав место рождения из подсказок, и откройте «Луну сегодня» для новой карты.";
const UNAVAILABLE = "Сейчас не получилось рассчитать Луну на сегодня. Попробуйте ещё раз через несколько минут.";
const MISSING = "Не удалось найти сохранённые положения планет этой карты.";
const NOT_FOUND = "Карта не найдена или недоступна.";
const NETWORK = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
const FOOT_DEVICE = "Время — по часовому поясу вашего устройства.";
const FOOT_BIRTH = "Время — по часовому поясу места рождения.";
const FOOT_ANGLES = "Аспекты к Луне, Асценденту и Середине неба зависят от точного времени рождения.";

// День A из DESIGN §5: Europe/Kyiv 2026-11-15, растущий серп 31 %, Козерог → Водолей в 11:24, четыре аспекта.
const dayA = {
  date: "2026-11-15", timezone: "Europe/Kyiv",
  phase: { code: "waxing_crescent", illumination: 31, exact_at: null },
  sign: { index: 9, ingress: { at: "11:24", index: 10 } },
  aspects: [
    { at: "03:17", aspect: "△", point: "♀" }, { at: "09:41", aspect: "□", point: "MC" },
    { at: "16:05", aspect: "☍", point: "♄" }, { at: "23:59", aspect: "⚹", point: "☉" },
  ],
};
const day = (patch = {}) => ({ ...dayA, ...patch });
const quiet = patch => day({ sign: { index: 9, ingress: null }, aspects: [], ...patch });
const phaseOf = (code, illumination, exact_at = null) => ({ code, illumination, exact_at });

const SHOWN = [
  "03:17 — Трин Луны и вашей Венеры", "09:41 — Квадрат Луны и вашей Середины неба",
  "16:05 — Оппозиция Луны и вашего Сатурна", "23:59 — Секстиль Луны и вашего Солнца",
];

// Страницы на базе нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом файла.
const loadPage = () => {
  try { return require("./MoonTodayPage").default; }
  catch (error) { throw new Error(`src/pages/MoonTodayPage.js не существует (DESIGN §6): ${error.message}`); }
};
const meanings = () => {
  try { return require("../components/moon/meanings"); }
  catch (error) { throw new Error(`src/components/moon/meanings.js не существует (DESIGN §6): ${error.message}`); }
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
const text = () => container.textContent.replace(/ /g, " ");
const control = label => [...container.querySelectorAll("a, button")].find(el => el.textContent.trim() === label);
const alertText = () => container.querySelector("[role=alert]")?.textContent;
const moonCalls = () => chartRequest.mock.calls.filter(([path]) => String(path).includes("/moon-day"));
const moonPaths = () => moonCalls().map(([path]) => path);
const destination = async el => {
  mockNavigate.mockClear();
  el.addEventListener("click", event => event.preventDefault(), { once: true });
  await act(async () => el.click());
  if (el.tagName === "A") return { to: el.getAttribute("href"), state: el.dataset.state ? JSON.parse(el.dataset.state) : undefined };
  const [to, options] = mockNavigate.mock.calls[0] || [];
  return { to, state: options?.state };
};
const phaseImage = () => [...container.querySelectorAll("[role=img]")].find(el => /освещено/i.test(el.getAttribute("aria-label") || ""));
const adviceBlock = () => {
  const heading = [...container.querySelectorAll("h2, h3, h4")].find(el => el.textContent.trim() === "Совет на день");
  return heading && (heading.closest("section") || heading.parentElement);
};
// Сервер отвечает на список карт и на день по пути запроса; day — значение, функция или отказ.
const serve = ({ charts = [chart7], moon = day() } = {}) => chartRequest.mockImplementation(async path => {
  if (path === "/natal-charts") return listOf(...charts);
  if (String(path).includes("/moon-day")) {
    const value = typeof moon === "function" ? moon(path) : moon;
    if (value instanceof Error) throw value;
    return value;
  }
  throw new Error(`неожиданный запрос ${path}`);
});
const refusal = (message, status) => Object.assign(new Error(message), { status });

describe("LD7: гость, вход и 401 — раздел входа, без запросов", () => {
  test("гость: заголовок, объяснение, «Войти» с returnTo /moon и «Создать карту» → /try-free; ни карт, ни дня", async () => {
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(text()).toContain(SUBTITLE);
    expect(text()).toContain(GUEST_TITLE);
    expect(text()).toContain(GUEST_TEXT);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/moon" } });
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chartRequest).not.toHaveBeenCalled();
    expect(container.querySelector("select")).toBeNull();
    expect(phaseImage()).toBeUndefined();
  });

  test("нет user, но в localStorage остался токен: запросов нет (права решает сервер, не токен)", async () => {
    localStorage.setItem("access_token", "stale-jwt");
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(chartRequest).not.toHaveBeenCalled();
  });

  test("список карт ответил 401 — тот же раздел входа, дня нет", async () => {
    signIn();
    chartRequest.mockRejectedValue(refusal("Сессия истекла. Войдите снова.", 401));
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/moon" } });
    expect(moonCalls()).toHaveLength(0);
    expect(text()).not.toContain(LIST_ERROR);
  });

  test("день ответил 401 — раздел входа с returnTo /moon, без текста ошибки и без «Повторить»", async () => {
    signIn();
    serve({ moon: refusal("Сессия истекла. Войдите снова.", 401) });
    await render();
    expect(text()).toContain(GUEST_TITLE);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/moon" } });
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

describe("LD7: список карт и выбор карты", () => {
  test("карт 0: «Сначала создайте карту» и «Создать карту» → /try-free, запроса дня нет", async () => {
    signIn();
    serve({ charts: [] });
    await render();
    expect(chartRequest.mock.calls[0][0]).toBe("/natal-charts");
    expect(text()).toContain(NO_CHARTS_TITLE);
    expect(text()).toContain(NO_CHARTS_TEXT);
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(moonCalls()).toHaveLength(0);
    expect(container.querySelector("select")).toBeNull();
  });

  test("список ещё грузится: «Загрузка карт...», дня нет", async () => {
    signIn();
    chartRequest.mockReturnValue(new Promise(() => {}));
    await render();
    expect(text()).toContain("Загрузка карт...");
    expect(moonCalls()).toHaveLength(0);
  });

  test("ошибка списка (не 401): текст и «Повторить загрузку»; повтор — новый запрос списка, затем день", async () => {
    signIn();
    let listCalls = 0;
    chartRequest.mockImplementation(async path => {
      if (path === "/natal-charts") { listCalls += 1; if (listCalls === 1) throw refusal("boom", 500); return listOf(chart7); }
      return day();
    });
    await render();
    expect(alertText()).toContain(LIST_ERROR);
    expect(text()).not.toContain(GUEST_TITLE);
    expect(moonCalls()).toHaveLength(0);
    expect(listCalls).toBe(1); // автоповтора нет
    await act(async () => control("Повторить загрузку").click());
    expect(listCalls).toBe(2);
    expect(moonPaths()).toEqual(["/natal-chart/7/moon-day?tz=Europe%2FKyiv"]);
    expect(text()).not.toContain(LIST_ERROR);
  });

  test("карт 1: «Карта: <имя>», без выбора; запрос дня несёт tz, authenticated и сигнал отмены", async () => {
    signIn();
    serve();
    await render();
    expect(text()).toContain("Карта: Карта без названия");
    expect(container.querySelector("select")).toBeNull();
    expect(moonCalls()).toHaveLength(1);
    const [path, options] = moonCalls()[0];
    expect(path).toBe("/natal-chart/7/moon-day?tz=Europe%2FKyiv");
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
    expect(moonPaths()).toEqual(["/natal-chart/7/moon-day?tz=America%2FArgentina%2FBuenos_Aires"]);
  });

  test("браузер не дал пояс (resolvedOptions без timeZone) — запрос без tz вовсе", async () => {
    signIn();
    serve();
    zoneSpy.mockRestore();
    zoneSpy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => ({ resolvedOptions: () => ({}) }));
    await render();
    expect(moonPaths()).toEqual(["/natal-chart/7/moon-day"]);
  });

  test("карт 3: <label>Карта <select> в порядке создания, по умолчанию первая сохранённая; день запрашивается для 7", async () => {
    signIn();
    serve({ charts: [chart9, chart8, chart7] }); // сервер: новые сверху
    await render();
    const select = container.querySelector("select");
    expect(select.labels[0].textContent).toContain("Карта");
    expect([...select.options].map(option => option.value)).toEqual(["7", "8", "9"]);
    expect(select.value).toBe("7");
    expect(moonPaths()).toEqual(["/natal-chart/7/moon-day?tz=Europe%2FKyiv"]);
  });

  test("?chart=8 — своя карта выбрана, день запрашивается для 8", async () => {
    signIn();
    mockSearch = "?chart=8";
    serve({ charts: [chart9, chart8, chart7] });
    await render();
    expect(container.querySelector("select").value).toBe("8");
    expect(moonPaths()).toEqual(["/natal-chart/8/moon-day?tz=Europe%2FKyiv"]);
  });

  test.each([["чужой id", "?chart=99"], ["кривой id", "?chart=abc"], ["пустой", "?chart="], ["дробный", "?chart=8.5"], ["пара-инъекция", "?chart=8%2F../9"]])(
    "?chart — %s: не уходит на сервер, выбрана первая сохранённая (7)", async (_name, search) => {
      signIn();
      mockSearch = search;
      serve({ charts: [chart9, chart8, chart7] });
      await render();
      expect(container.querySelector("select").value).toBe("7");
      expect(moonPaths()).toEqual(["/natal-chart/7/moon-day?tz=Europe%2FKyiv"]);
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
    expect(chartRequest.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });

  test("в адресе сменилась карта: день запрашивается заново для новой, прежний запрос отменён, пока ждём — «Считаем Луну...»", async () => {
    signIn();
    let release;
    chartRequest.mockImplementation(async (path, options) => {
      if (path === "/natal-charts") return listOf(chart9, chart8, chart7);
      if (path.includes("/natal-chart/7/")) return day();
      return new Promise(resolve => { release = () => resolve(day({ phase: phaseOf("full_moon", 100, "16:53") })); options.signal.addEventListener("abort", () => {}); });
    });
    await render();
    const firstSignal = moonCalls()[0][1].signal;
    expect(text()).toContain("Растущий серп");
    mockSearch = "?chart=9";
    await rerender();
    expect(moonPaths()).toEqual(["/natal-chart/7/moon-day?tz=Europe%2FKyiv", "/natal-chart/9/moon-day?tz=Europe%2FKyiv"]);
    expect(firstSignal.aborted).toBe(true);
    expect(text()).toContain(LOADING);
    expect(text()).not.toContain("Растущий серп"); // день прежней карты на новой не показываем
    await act(async () => release());
    expect(text()).toContain("Полнолуние");
  });
});

describe("LD7: день — что видит человек", () => {
  beforeEach(() => signIn());

  test("день A: заголовок, фаза, освещённость, знак со сменой, аспекты по порядку, совет не пустой", async () => {
    serve();
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(text()).toContain("Растущий серп");
    expect(container.textContent).toContain("Освещено 31 %"); // перед % неразрывный пробел
    expect(text()).toContain("Луна в Козероге, с 11:24 — в Водолее");
    const positions = SHOWN.map(line => { expect(text()).toContain(line); return text().indexOf(line); });
    expect([...positions].sort((a, b) => a - b)).toEqual(positions); // порядок ответа сервера
    expect(adviceBlock()).toBeTruthy();
    expect(adviceBlock().textContent.replace("Совет на день", "").trim().length).toBeGreaterThan(20);
    expect(text()).not.toContain(LOADING);
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  test("рисунок фазы: role=img и подпись «<фаза>, освещено N %»", async () => {
    serve();
    await render();
    const image = phaseImage();
    expect(image).toBeTruthy();
    expect(image.getAttribute("aria-label").replace(/ /g, " ")).toBe("Растущий серп, освещено 31 %");
  });

  test("рисунок зависит от освещённости и стороны: растущая и убывающая 31 %, полная 100 %, новая 0 % — четыре разных", async () => {
    const variants = [phaseOf("waxing_crescent", 31), phaseOf("waning_crescent", 31), phaseOf("full_moon", 100), phaseOf("new_moon", 0)];
    const markups = [];
    for (const phase of variants) {
      serve({ moon: quiet({ phase }) });
      await remount();
      await render();
      markups.push(phaseImage().innerHTML);
    }
    expect(new Set(markups).size).toBe(4);
  });

  test("день события: «Полнолуние в 16:53» и «Новолуние в 02:51»; в обычный день слова «в HH:MM» у фазы нет", async () => {
    serve({ moon: quiet({ phase: phaseOf("full_moon", 100, "16:53") }) });
    await render();
    expect(text()).toContain("Полнолуние в 16:53");
    expect(container.textContent).toContain("Освещено 100 %");
    serve({ moon: quiet({ date: "2026-12-09", phase: phaseOf("new_moon", 0, "02:51"), sign: { index: 8, ingress: null } }) });
    await remount();
    await render();
    expect(text()).toContain("Новолуние в 02:51");
    expect(text()).toContain("Луна в Стрельце");
    serve({ moon: quiet({ phase: phaseOf("waxing_crescent", 31) }) });
    await remount();
    await render();
    expect(text()).not.toMatch(/Растущий серп в \d/);
  });

  test("смена знака через 0°: «Луна в Рыбах, с 16:34 — в Овне»; без смены — «Луна в Козероге» без «с …»", async () => {
    serve({ moon: quiet({ phase: phaseOf("first_quarter", 52, "07:42"), sign: { index: 11, ingress: { at: "16:34", index: 0 } } }) });
    await render();
    expect(text()).toContain("Первая четверть в 07:42");
    expect(text()).toContain("Луна в Рыбах, с 16:34 — в Овне");
    serve({ moon: quiet() });
    await remount();
    await render();
    expect(text()).toContain("Луна в Козероге");
    expect(text()).not.toMatch(/Луна в Козероге, с/);
  });

  test("день без аспектов: фаза, знак и совет есть, строк аспектов нет, пустых «undefined/NaN/null»", async () => {
    serve({ moon: quiet() });
    await render();
    expect(text()).toContain("Растущий серп");
    expect(text()).toContain("Луна в Козероге");
    SHOWN.forEach(line => expect(text()).not.toContain(line));
    expect(text()).not.toMatch(/Квадрат|Трин|Оппозиция|Секстиль|Соединение/);
    expect(adviceBlock()).toBeTruthy();
    expect(text()).not.toMatch(/undefined|NaN|null|\[object/);
  });

  test("все аспекты и точки: «Соединение Луны и вашего Меркурия» … «Квадрат Луны и вашего Асцендента»", async () => {
    const points = [["☉", "вашего Солнца"], ["☽", "вашей Луны"], ["☿", "вашего Меркурия"], ["♀", "вашей Венеры"], ["♂", "вашего Марса"],
      ["♃", "вашего Юпитера"], ["♄", "вашего Сатурна"], ["♅", "вашего Урана"], ["♆", "вашего Нептуна"], ["♇", "вашего Плутона"],
      ["AS", "вашего Асцендента"], ["MC", "вашей Середины неба"]];
    const names = { "☌": "Соединение", "⚹": "Секстиль", "□": "Квадрат", "△": "Трин", "☍": "Оппозиция" };
    const symbols = Object.keys(names);
    const aspects = points.map(([point], index) => ({ at: `${String(index).padStart(2, "0")}:30`, aspect: symbols[index % 5], point }));
    serve({ moon: quiet({ aspects }) });
    await render();
    points.forEach(([, genitive], index) =>
      expect(text()).toContain(`${String(index).padStart(2, "0")}:30 — ${names[symbols[index % 5]]} Луны и ${genitive}`));
  });

  test("сноски: пояс устройства и «зависят от точного времени рождения»; пояс ответа другой — «места рождения»", async () => {
    serve();
    await render();
    expect(text()).toContain(FOOT_DEVICE);
    expect(text()).not.toContain(FOOT_BIRTH);
    expect(text()).toContain(FOOT_ANGLES);
    serve({ moon: day({ timezone: "Asia/Kathmandu" }) }); // отправили Europe/Kyiv, сервер считал по поясу карты
    await remount();
    await render();
    expect(text()).toContain(FOOT_BIRTH);
    expect(text()).not.toContain(FOOT_DEVICE);
    expect(text()).toContain(FOOT_ANGLES);
  });

  test("на странице нет латиницы, сырых кодов и чисел вроде «31%» без пробела; ни одного POST", async () => {
    serve();
    await render();
    expect(text()).not.toMatch(/[A-Za-z]/);
    expect(text()).not.toMatch(/waxing|new_moon|ingress|exact_at|illumination/);
    expect(chartRequest.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
  });
});

describe("LD7: «Совет на день» собирается из таблицы смыслов", () => {
  beforeEach(() => signIn());
  const advice = async patch => { serve({ moon: quiet(patch) }); await remount(); await render(); return adviceBlock().textContent.replace(/ /g, " "); };

  test("в совете — совет фазы и совет знака Луны в полдень (смена в 11:24 — уже Водолей, не Козерог)", async () => {
    const { PHASE_TEXTS, SIGN_ADVICE } = meanings();
    serve();
    await render();
    const block = adviceBlock().textContent.replace(/ /g, " ");
    expect(block).toContain(PHASE_TEXTS.waxing_crescent.advice);
    expect(block).toContain(SIGN_ADVICE[10]);
    expect(block).not.toContain(SIGN_ADVICE[9]);
  });

  test("смена знака после полудня (13:09, Телец → Близнецы) — в полдень ещё Телец", async () => {
    const { SIGN_ADVICE, PHASE_TEXTS } = meanings();
    const block = await advice({ phase: phaseOf("full_moon", 100, "16:53"), sign: { index: 1, ingress: { at: "13:09", index: 2 } } });
    expect(block).toContain(PHASE_TEXTS.full_moon.advice);
    expect(block).toContain(SIGN_ADVICE[1]);
    expect(block).not.toContain(SIGN_ADVICE[2]);
  });

  test("без смены знака — совет знака дня; совет фазы у каждой из 8 фаз свой", async () => {
    const { SIGN_ADVICE, PHASE_TEXTS } = meanings();
    for (const code of Object.keys(PHASE_TEXTS)) {
      const block = await advice({ phase: phaseOf(code, 50), sign: { index: 5, ingress: null } });
      expect(block).toContain(PHASE_TEXTS[code].advice);
      expect(block).toContain(SIGN_ADVICE[5]);
      Object.keys(PHASE_TEXTS).filter(other => other !== code).forEach(other => expect(block).not.toContain(PHASE_TEXTS[other].advice));
    }
  });

  test("главный аспект — у точки меньшей группы, затем раньше по времени: MC □ в 09:41 (не ♀ △ в 03:17, не ☉ ⚹ позже); тон — hard", async () => {
    const { POINT_MEANINGS, TONE_ADVICE } = meanings();
    const block = await advice({ aspects: dayA.aspects });
    expect(block).toContain(POINT_MEANINGS.MC.theme);
    expect(block).toContain(TONE_ADVICE.hard);
    ["☉", "♀", "♄"].forEach(symbol => expect(block).not.toContain(POINT_MEANINGS[symbol].theme));
    expect(block).not.toContain(TONE_ADVICE.soft);
    expect(block).not.toContain(TONE_ADVICE.conjunction);
  });

  test("нет точек группы 0 — берётся группа ☿ ♀ ♂ (♀ △ в 10:00 раньше ♂ □ в 12:00, ♄ в 08:00 — группа 2); тон — soft", async () => {
    const { POINT_MEANINGS, TONE_ADVICE } = meanings();
    const block = await advice({ aspects: [
      { at: "08:00", aspect: "☍", point: "♄" }, { at: "10:00", aspect: "△", point: "♀" }, { at: "12:00", aspect: "□", point: "♂" },
    ] });
    expect(block).toContain(POINT_MEANINGS["♀"].theme);
    expect(block).toContain(TONE_ADVICE.soft);
    expect(block).not.toContain(POINT_MEANINGS["♄"].theme);
    expect(block).not.toContain(POINT_MEANINGS["♂"].theme);
    expect(block).not.toContain(TONE_ADVICE.hard);
  });

  test("только внешние точки: ♆ в 05:00 и ♅ в 07:00 — оба группа 3, берётся раньше (♆); соединение — тон conjunction", async () => {
    const { POINT_MEANINGS, TONE_ADVICE } = meanings();
    const block = await advice({ aspects: [{ at: "05:00", aspect: "☌", point: "♆" }, { at: "07:00", aspect: "☍", point: "♅" }] });
    expect(block).toContain(POINT_MEANINGS["♆"].theme);
    expect(block).toContain(TONE_ADVICE.conjunction);
    expect(block).not.toContain(POINT_MEANINGS["♅"].theme);
    expect(block).not.toContain(TONE_ADVICE.hard);
  });

  test("без аспектов — в совете нет ни тем, ни тонов, но фаза и знак на месте", async () => {
    const { POINT_MEANINGS, TONE_ADVICE, PHASE_TEXTS, SIGN_ADVICE } = meanings();
    const block = await advice({ phase: phaseOf("waning_gibbous", 70), sign: { index: 3, ingress: null }, aspects: [] });
    expect(block).toContain(PHASE_TEXTS.waning_gibbous.advice);
    expect(block).toContain(SIGN_ADVICE[3]);
    Object.values(POINT_MEANINGS).forEach(item => expect(block).not.toContain(item.theme));
    Object.values(TONE_ADVICE).forEach(tone => expect(block).not.toContain(tone));
  });
});

describe("LD7: отказы и ошибки — текст сервера как есть, действие понятно", () => {
  beforeEach(() => signIn());

  test.each([
    ["422 старая карта", refusal(LEGACY, 422)],
    ["404 нет положений", refusal(MISSING, 404)],
    ["404 карта не найдена", refusal(NOT_FOUND, 404)],
    ["403 чужая карта", refusal("Эта карта вам недоступна.", 403)],
  ])("%s: текст в role=alert дословно, дня нет, без «Повторить», без кодов и номеров", async (_name, error) => {
    serve({ moon: error });
    await render();
    expect(alertText()).toContain(error.message);
    expect(alertText()).not.toMatch(/MOON_|CHART_|\b(403|404|422|503)\b|undefined/);
    expect(phaseImage()).toBeUndefined();
    expect(adviceBlock()).toBeFalsy();
    expect(control("Повторить")).toBeUndefined();
    expect(text()).not.toContain(LOADING);
    expect(moonCalls()).toHaveLength(1); // автоповтора нет
  });

  test("503: текст сервера и «Повторить»; нажатие — второй запрос того же дня, затем день и без ошибки", async () => {
    let attempts = 0;
    serve({ moon: () => { attempts += 1; return attempts === 1 ? refusal(UNAVAILABLE, 503) : day(); } });
    await render();
    expect(alertText()).toContain(UNAVAILABLE);
    expect(moonCalls()).toHaveLength(1);
    await act(async () => control("Повторить").click());
    expect(moonPaths()).toEqual(Array(2).fill("/natal-chart/7/moon-day?tz=Europe%2FKyiv"));
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(text()).toContain("Луна в Козероге, с 11:24 — в Водолее");
    expect(chartRequest.mock.calls.filter(([path]) => path === "/natal-charts")).toHaveLength(1); // список повторно не грузится
  });

  test("сетевая ошибка (без status): «Нет связи…» и «Повторить»", async () => {
    serve({ moon: new Error(NETWORK) });
    await render();
    expect(alertText()).toContain(NETWORK);
    expect(control("Повторить")).toBeTruthy();
    expect(moonCalls()).toHaveLength(1);
  });

  test("пока считаем: «Считаем Луну...», без дня, без ошибки и без «Повторить»", async () => {
    chartRequest.mockImplementation(async path => path === "/natal-charts" ? listOf(chart7) : new Promise(() => {}));
    await render();
    expect(text()).toContain(LOADING);
    expect(phaseImage()).toBeUndefined();
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(control("Повторить")).toBeUndefined();
  });

  test("уход со страницы отменяет запрос дня (AbortController)", async () => {
    chartRequest.mockImplementation(async path => path === "/natal-charts" ? listOf(chart7) : new Promise(() => {}));
    await render();
    const { signal } = moonCalls()[0][1];
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
      return day();
    });
    await render();
    mockSearch = "?chart=8";
    await rerender();
    await act(async () => { try { abortOld(); } catch { /* уже отклонён отменой */ } });
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(text()).toContain("Растущий серп");
  });
});
