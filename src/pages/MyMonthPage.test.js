import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { chartRequest } from "../api/chartsApi";

// ---- MY-MONTH-PAGE-fe, MM2 и MM3 (tasks/MY-MONTH-PAGE/DESIGN.md §3 «Страница», §5) ----
// Регрессия до кода. Тексты — литералы из DESIGN §3, тесты сравнивают дословно.
// Чат подменён (как MyCharts.test.js:29): страница отвечает за раздел входа, список карт, выбор карты
// и за то, что отдаёт чату (chartId, view="month", heading, subtitle, intro). Сам чат — в AskGptForm.test.js (MM4–MM7).
// Допущения, которых DESIGN прямо не фиксирует (автору учесть или вернуть вопрос координатору):
//  1. heading / subtitle / intro чата страница передаёт props-ами (как RelationshipResultPage).
//  2. Сервер отдаёт карты «новые сверху» (endpoints.py:222–238): «в порядке создания» — по возрастанию chart_id;
//     «первая сохранённая» (по умолчанию) — первая в этом порядке, то есть самая старая.

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
  useLocation: () => ({ pathname: "/my-month", search: mockSearch, state: null }),
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../context/UsageContext", () => ({ useUsage: () => ({ usage: null, usageLoading: false, usageError: null,
  refreshUsage: async () => null, handleLimitError: () => false, openUpgrade: () => {}, noteOffer: () => {} }) }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));
jest.mock("../components/AskGptForm", () => props => <div className="chat-stub" data-chat={String(props.chartId)} data-view={props.view}>
  <h2>{props.heading}</h2><p className="chat-stub-subtitle">{props.subtitle}</p><div className="chat-stub-intro">{props.intro}</div>
</div>);

const chart7 = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };
const chart8 = { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "Other city" };
const chart9 = { chart_id: 9, year: 1988, month: 5, day: 30, hour: 20, city: "Third city" };
const listOf = (...charts) => ({ charts, count: charts.length, limit: 10 });

const TITLE = "Мой месяц";
const DESCRIPTION = "Ближайшие 30 дней по вашей карте: любовь, работа, силы и то, на что стоит обратить внимание.";
const GUEST_TITLE = "Войдите, чтобы увидеть свой месяц";
const GUEST_TEXT = "Обзор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.";
const NO_CHARTS_TITLE = "Сначала создайте карту";
const NO_CHARTS_TEXT = "Обзор месяца строится по вашей натальной карте — это займёт минуту.";
const LIST_ERROR = "Не удалось загрузить карты. Попробуйте ещё раз.";
const CHAT_HEADING = "Обзор месяца";
const CHAT_SUBTITLE = "Строится по транзитам — тому, как планеты сейчас стоят относительно вашей карты. Обзор и ответы сохраняются в разговоре этой карты.";
const CHAT_INTRO = "Соберу обзор ваших ближайших 30 дней: любовь и отношения, работа и деньги, силы и самочувствие, на что обратить внимание. Потом можно спросить подробнее.";

// Страницы на базе нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом файла.
const loadPage = () => {
  try { return require("./MyMonthPage").default; }
  catch (error) { throw new Error(`src/pages/MyMonthPage.js не существует (DESIGN §3): ${error.message}`); }
};

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  jest.clearAllMocks();
  chartRequest.mockReset();
  mockSearch = "";
  mockAuth = { user: null, loading: false, authError: null };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const signIn = () => { mockAuth = { user: { id: 1 }, loading: false, authError: null }; localStorage.setItem("access_token", "jwt"); };
const render = async () => { const Page = loadPage(); await act(async () => root.render(<Page />)); };
const control = text => [...container.querySelectorAll("a, button")].find(el => el.textContent.trim() === text);
const chat = () => container.querySelector(".chat-stub");
// Куда ведёт элемент: ссылка (href + state) или переход через navigate — страница вправе выбрать любое.
const destination = async el => {
  mockNavigate.mockClear();
  el.addEventListener("click", event => event.preventDefault(), { once: true });
  await act(async () => el.click());
  if (el.tagName === "A") return { to: el.getAttribute("href"), state: el.dataset.state ? JSON.parse(el.dataset.state) : undefined };
  const [to, options] = mockNavigate.mock.calls[0] || [];
  return { to, state: options?.state };
};

describe("MM2: без входа и при 401 списка — раздел входа, без запросов", () => {
  test("гость: заголовок, объяснение, «Войти» с returnTo /my-month и «Создать карту» → /try-free; ни карт, ни чата", async () => {
    await render();
    expect(container.textContent).toContain(GUEST_TITLE);
    expect(container.textContent).toContain(GUEST_TEXT);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/my-month" } });
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chartRequest).not.toHaveBeenCalled();
    expect(chat()).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  test("нет user, но в localStorage остался токен: запросов к картам всё равно нет (права решает сервер, не токен)", async () => {
    localStorage.setItem("access_token", "stale-jwt");
    await render();
    expect(container.textContent).toContain(GUEST_TITLE);
    expect(chartRequest).not.toHaveBeenCalled();
    expect(chat()).toBeNull();
  });

  test("список карт ответил 401 — тот же раздел входа, чата нет", async () => {
    signIn();
    chartRequest.mockRejectedValue(Object.assign(new Error("Сессия истекла. Войдите снова."), { status: 401 }));
    await render();
    expect(chartRequest).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain(GUEST_TITLE);
    expect(container.textContent).toContain(GUEST_TEXT);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/my-month" } });
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chat()).toBeNull();
    expect(container.textContent).not.toContain(LIST_ERROR);
  });

  test("проверка аккаунта идёт — «Проверка аккаунта...», без раздела входа и без запросов", async () => {
    mockAuth = { user: null, loading: true, authError: null };
    await render();
    expect(container.textContent).toContain("Проверка аккаунта...");
    expect(container.textContent).not.toContain(GUEST_TITLE);
    expect(chartRequest).not.toHaveBeenCalled();
    expect(chat()).toBeNull();
  });

  test("не удалось проверить вход (authError) — страница молчит: объясняет общая плашка, раздела входа и запросов нет", async () => {
    mockAuth = { user: null, loading: false, authError: new Error("offline") };
    await render();
    expect(container.textContent).not.toContain(GUEST_TITLE);
    expect(container.textContent).not.toContain("Проверка аккаунта...");
    expect(chartRequest).not.toHaveBeenCalled();
    expect(chat()).toBeNull();
  });
});

describe("MM3: список карт, выбор карты, передача чату", () => {
  test("карт 0: «Сначала создайте карту» и «Создать карту» → /try-free, чата нет", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf());
    await render();
    expect(chartRequest.mock.calls[0][0]).toBe("/natal-charts");
    expect(container.textContent).toContain(NO_CHARTS_TITLE);
    expect(container.textContent).toContain(NO_CHARTS_TEXT);
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chat()).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  test("карт 1: «Карта: <имя>», без выбора; чат получает chartId и view=month и тексты из DESIGN §3", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart7));
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(container.textContent).toContain(DESCRIPTION);
    expect(container.textContent).toContain("Карта: Карта без названия");
    expect(container.querySelector("select")).toBeNull();
    expect(chat().dataset.chat).toBe("7");
    expect(chat().dataset.view).toBe("month");
    expect(chat().querySelector("h2").textContent).toBe(CHAT_HEADING);
    expect(chat().querySelector(".chat-stub-subtitle").textContent).toBe(CHAT_SUBTITLE);
    expect(chat().querySelector(".chat-stub-intro").textContent).toBe(CHAT_INTRO);
    expect(container.textContent).not.toContain(NO_CHARTS_TITLE);
    expect(container.textContent).not.toContain(GUEST_TITLE);
  });

  test("список ещё грузится: «Загрузка карт...», чата нет", async () => {
    signIn();
    chartRequest.mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toContain("Загрузка карт...");
    expect(chat()).toBeNull();
  });

  test("карт 3: <label>Карта <select> в порядке создания, по умолчанию первая сохранённая", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7)); // сервер: новые сверху
    await render();
    const select = container.querySelector("select");
    expect(select.labels[0].textContent).toContain("Карта");
    expect([...select.options].map(option => option.value)).toEqual(["7", "8", "9"]);
    ["02.01.2000", "21.11.1994", "30.05.1988"].forEach((date, index) =>
      expect(select.options[index].textContent).toBe(`Карта без названия · ${date}`)); // имена — chartLabels, как на «Мои карты»
    expect(select.value).toBe("7");
    expect(chat().dataset.chat).toBe("7");
    expect(chat().dataset.view).toBe("month");
  });

  test("?chart=8 — своя карта выбрана; чату уходит 8", async () => {
    signIn();
    mockSearch = "?chart=8";
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
    await render();
    expect(container.querySelector("select").value).toBe("8");
    expect(chat().dataset.chat).toBe("8");
  });

  test.each([["чужой id", "?chart=99"], ["кривой id", "?chart=abc"], ["пустой", "?chart="], ["дробный", "?chart=8.5"], ["пара-инъекция", "?chart=8%2F../9"]])(
    "?chart — %s: не запрашивается и не передаётся чату, выбрана первая сохранённая", async (_name, search) => {
      signIn();
      mockSearch = search;
      chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
      await render();
      expect(container.querySelector("select").value).toBe("7");
      expect(chat().dataset.chat).toBe("7");
      expect(chartRequest).toHaveBeenCalledTimes(1); // только список; чужую карту по id не запрашиваем
    });

  test("?chart с одной картой другого id — выбрана единственная своя", async () => {
    signIn();
    mockSearch = "?chart=99";
    chartRequest.mockResolvedValue(listOf(chart8));
    await render();
    expect(chat().dataset.chat).toBe("8");
  });

  test("смена карты → setSearchParams({ chart }, { replace: true }); карты в запросах не создаются и не удаляются", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
    await render();
    await act(async () => Simulate.change(container.querySelector("select"), { target: { value: "9" } }));
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const [params, options] = mockSetSearchParams.mock.calls[0];
    expect(String(params.chart)).toBe("9");
    expect(options).toEqual({ replace: true });
    expect(chartRequest).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("ошибка списка (не 401): текст и «Повторить загрузку»; повтор — новый запрос, затем чат", async () => {
    signIn();
    chartRequest.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 })).mockResolvedValue(listOf(chart7));
    await render();
    expect(container.querySelector("[role=alert]").textContent).toContain(LIST_ERROR);
    expect(container.textContent).not.toContain(GUEST_TITLE);
    expect(chat()).toBeNull();
    expect(chartRequest).toHaveBeenCalledTimes(1); // автоповтора нет
    await act(async () => control("Повторить загрузку").click());
    expect(chartRequest).toHaveBeenCalledTimes(2);
    expect(chat().dataset.chat).toBe("7");
    expect(container.textContent).not.toContain(LIST_ERROR);
  });
});
