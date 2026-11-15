import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { chartRequest } from "../api/chartsApi";

// ---- TOPICS-1-fe, TF1 (tasks/TOPICS-1/DESIGN.md §3.1 «Страница», §4, §5) ----
// Регрессия до кода. Тексты — литералы из DESIGN §2.1 и §3.1, тесты сравнивают дословно.
// Чат подменён (как MyMonthPage.test.js): страница отвечает за раздел входа, список карт, выбор карты и темы
// и за то, что отдаёт чату (chartId, view="topic", topicQuestion, heading, subtitle, intro). Сам чат — в AskGptForm.test.js (TF2).
// Допущения, которых DESIGN прямо не фиксирует (автору учесть или вернуть вопрос координатору):
//  1. Выбор карты — как у «Мой месяц» (DESIGN §3.1 «повторяет схему MyMonthPage.js»): <label>Карта <select> при 2+ картах,
//     «Карта: <имя>» при одной, порядок по возрастанию chart_id, по умолчанию самая старая; чужой/кривой ?chart= не запрашивается.
//  2. Смена темы — setSearchParams({chart, topic}, {replace: true}); chart сравнивается как строка (String), как у select.
//  3. Кнопки тем — <button> с aria-pressed ("true"/"false"); одна нажата всегда.
//  4. Чат получает heading = метка темы, subtitle и intro — одни для всех тем (DESIGN §3.1).
//  5. Страница не знает про состояние истории: ссылки «Спросить подробнее в чате карты» и кнопки «Собрать …» рисует чат (TF2).

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
  useLocation: () => ({ pathname: "/topics", search: mockSearch, state: null }),
  Link: ({ to, state, children, ...props }) => <a href={to} data-state={state ? JSON.stringify(state) : undefined} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../context/UsageContext", () => ({ useUsage: () => ({ usage: null, usageLoading: false, usageError: null,
  refreshUsage: async () => null, handleLimitError: () => false, openUpgrade: () => {}, noteOffer: () => {} }) }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));
jest.mock("../components/AskGptForm", () => props => <div className="chat-stub" data-chat={String(props.chartId)} data-view={props.view}
  data-topic-question={props.topicQuestion}>
  <h2>{props.heading}</h2><p className="chat-stub-subtitle">{props.subtitle}</p><div className="chat-stub-intro">{props.intro}</div>
</div>);

const chart7 = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };
const chart8 = { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "Other city" };
const chart9 = { chart_id: 9, year: 1988, month: 5, day: 30, hour: 20, city: "Third city" };
const listOf = (...charts) => ({ charts, count: charts.length, limit: 10 });

const TITLE = "Разборы по темам";
const DESCRIPTION = "Готовый разбор вашей натальной карты по одной теме — по планетам и домам. Разбор сохраняется, его можно перечитать.";
const GUEST_TITLE = "Войдите, чтобы получить разбор";
const GUEST_TEXT = "Разбор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.";
const NO_CHARTS_TITLE = "Сначала создайте карту";
const NO_CHARTS_TEXT = "Разбор строится по вашей натальной карте — это займёт минуту.";
const LIST_ERROR = "Не удалось загрузить карты. Попробуйте ещё раз.";
const CHAT_SUBTITLE = "Разбор сохраняется в разговоре этой карты.";
const CHAT_INTRO = "Соберу разбор вашей карты по этой теме — по планетам, домам и аспектам.";
const ACCURACY = "Дома карты зависят от точного времени рождения. Если время было примерным, части о домах могут не совпасть.";
const LOVE_LINK = "Совместимость с конкретным человеком — в разборе отношений";
// DESIGN §2.1 (TOPIC_QUESTIONS) и §3.1: ключ темы → метка кнопки, текст вопроса, строка о теме.
const TOPICS = {
  career: { label: "Призвание и работа", question: "Призвание и работа: разбор моей карты",
    line: "Какие занятия и условия работы вам подходят, ваши сильные стороны и что может мешать." },
  money: { label: "Деньги", question: "Деньги: разбор моей карты",
    line: "Как вы зарабатываете, тратите и бережёте деньги — склонности и стиль, без советов по вложениям." },
  love: { label: "Любовь", question: "Любовь: разбор моей карты",
    line: "Что для вас важно в любви, как вы проявляете чувства и каким видите партнёра." },
};

// Страницы на базе нет: каждый тест красный по одной понятной причине, а не одним сломанным импортом файла.
const loadPage = () => {
  try { return require("./TopicsPage").default; }
  catch (error) { throw new Error(`src/pages/TopicsPage.js не существует (DESIGN §3.1): ${error.message}`); }
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
const topicButton = key => [...container.querySelectorAll("button")].find(el => el.textContent.trim() === TOPICS[key].label);
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

describe("TF1: без входа и при 401 списка — раздел входа, без запросов", () => {
  test("гость: заголовок, объяснение, «Войти» с returnTo /topics и «Создать карту» → /try-free; ни карт, ни чата", async () => {
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(container.textContent).toContain(DESCRIPTION);
    expect(container.textContent).toContain(GUEST_TITLE);
    expect(container.textContent).toContain(GUEST_TEXT);
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/topics" } });
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
    expect(await destination(control("Войти"))).toEqual({ to: "/authorization", state: { returnTo: "/topics" } });
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

describe("TF1: список карт — ноль карт, загрузка, ошибка с повтором, выбор карты", () => {
  test("карт 0: «Сначала создайте карту» и «Создать карту» → /try-free, чата и кнопок тем нет", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf());
    await render();
    expect(chartRequest.mock.calls[0][0]).toBe("/natal-charts");
    expect(container.textContent).toContain(NO_CHARTS_TITLE);
    expect(container.textContent).toContain(NO_CHARTS_TEXT);
    expect((await destination(control("Создать карту"))).to).toBe("/try-free");
    expect(chat()).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    expect(topicButton("career")).toBeUndefined();
  });

  test("список ещё грузится: «Загрузка карт...», чата нет", async () => {
    signIn();
    chartRequest.mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toContain("Загрузка карт...");
    expect(chat()).toBeNull();
  });

  test("ошибка списка (не 401): текст и «Повторить загрузку»; повтор — новый запрос, затем чат; автоповтора нет", async () => {
    signIn();
    chartRequest.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 })).mockResolvedValue(listOf(chart7));
    await render();
    expect(container.querySelector("[role=alert]").textContent).toContain(LIST_ERROR);
    expect(container.textContent).not.toContain(GUEST_TITLE);
    expect(chat()).toBeNull();
    expect(chartRequest).toHaveBeenCalledTimes(1);
    await act(async () => control("Повторить загрузку").click());
    expect(chartRequest).toHaveBeenCalledTimes(2);
    expect(chat().dataset.chat).toBe("7");
    expect(container.textContent).not.toContain(LIST_ERROR);
  });

  test("карт 1: «Карта: <имя>», без выбора; чат получает chartId, view=topic и тексты из DESIGN §3.1", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart7));
    await render();
    expect(container.textContent).toContain("Карта: Карта без названия");
    expect(container.querySelector("select")).toBeNull();
    expect(chat().dataset.chat).toBe("7");
    expect(chat().dataset.view).toBe("topic");
    expect(chat().querySelector(".chat-stub-subtitle").textContent).toBe(CHAT_SUBTITLE);
    expect(chat().querySelector(".chat-stub-intro").textContent).toBe(CHAT_INTRO);
    expect(container.textContent).not.toContain(NO_CHARTS_TITLE);
    expect(container.textContent).not.toContain(GUEST_TITLE);
  });

  test("карт 3: <label>Карта <select> в порядке создания, по умолчанию первая сохранённая; ?chart=8 — своя карта", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7)); // сервер: новые сверху
    await render();
    const select = container.querySelector("select");
    expect(select.labels[0].textContent).toContain("Карта");
    expect([...select.options].map(option => option.value)).toEqual(["7", "8", "9"]);
    expect(select.value).toBe("7");
    expect(chat().dataset.chat).toBe("7");
    await act(async () => root.unmount());
    root = createRoot(container);
    mockSearch = "?chart=8";
    await render();
    expect(container.querySelector("select").value).toBe("8");
    expect(chat().dataset.chat).toBe("8");
  });

  test.each([["чужой id", "?chart=99"], ["кривой id", "?chart=abc"], ["пустой", "?chart="], ["дробный", "?chart=8.5"], ["пара-инъекция", "?chart=8%2F../9"]])(
    "?chart — %s: не запрашивается и не передаётся чату, выбрана первая сохранённая", async (_name, search) => {
      signIn();
      mockSearch = `${search}&topic=money`;
      chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
      await render();
      expect(container.querySelector("select").value).toBe("7");
      expect(chat().dataset.chat).toBe("7");
      expect(chat().dataset.topicQuestion).toBe(TOPICS.money.question); // тема при этом сохранена
      expect(chartRequest).toHaveBeenCalledTimes(1); // только список; чужую карту по id не запрашиваем
    });

  test("смена карты → setSearchParams с chart и прежней темой, { replace: true }; запросов и переходов нет", async () => {
    signIn();
    mockSearch = "?topic=love";
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
    await render();
    const { Simulate } = require("react-dom/test-utils");
    await act(async () => Simulate.change(container.querySelector("select"), { target: { value: "9" } }));
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const [params, options] = mockSetSearchParams.mock.calls[0];
    expect(String(params.chart)).toBe("9");
    expect(params.topic).toBe("love");
    expect(options).toEqual({ replace: true });
    expect(chartRequest).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("TF1: темы — три кнопки, ?topic=, текст вопроса дословно", () => {
  test("страница: заголовок, описание; три кнопки в порядке «Призвание и работа», «Деньги», «Любовь», строка о точности времени", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart7));
    await render();
    expect(container.querySelector("h1").textContent).toBe(TITLE);
    expect(container.textContent).toContain(DESCRIPTION);
    const buttons = ["career", "money", "love"].map(topicButton);
    buttons.forEach(button => { expect(button).toBeDefined(); expect(button.getAttribute("type")).toBe("button"); });
    expect(buttons[0].compareDocumentPosition(buttons[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buttons[1].compareDocumentPosition(buttons[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain(ACCURACY);
  });

  test("без ?topic= выбрана «Призвание и работа»: aria-pressed, строка о теме, чат получает её вопрос и метку заголовком", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart7));
    await render();
    expect(topicButton("career").getAttribute("aria-pressed")).toBe("true");
    expect(topicButton("money").getAttribute("aria-pressed")).toBe("false");
    expect(topicButton("love").getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain(TOPICS.career.line);
    expect(container.textContent).not.toContain(TOPICS.money.line);
    expect(container.textContent).not.toContain(TOPICS.love.line);
    expect(chat().dataset.topicQuestion).toBe(TOPICS.career.question);
    expect(chat().querySelector("h2").textContent).toBe(TOPICS.career.label);
  });

  test.each(["career", "money", "love"])("?topic=%s: нажата своя кнопка, своя строка о теме, в чат уходит текст вопроса дословно (DESIGN §2.1)", async key => {
    signIn();
    mockSearch = `?topic=${key}`;
    chartRequest.mockResolvedValue(listOf(chart7));
    await render();
    for (const other of ["career", "money", "love"]) expect(topicButton(other).getAttribute("aria-pressed")).toBe(other === key ? "true" : "false");
    expect(container.textContent).toContain(TOPICS[key].line);
    expect(chat().dataset.view).toBe("topic");
    expect(chat().dataset.topicQuestion).toBe(TOPICS[key].question);
    expect(chat().querySelector("h2").textContent).toBe(TOPICS[key].label);
    expect(chat().querySelector(".chat-stub-subtitle").textContent).toBe(CHAT_SUBTITLE);
    expect(chat().querySelector(".chat-stub-intro").textContent).toBe(CHAT_INTRO);
  });

  test.each([["неизвестная", "?topic=crypto"], ["пустая", "?topic="], ["регистр", "?topic=Money"], ["вопрос темы", "?topic=Деньги%3A+разбор+моей+карты"],
    ["прототип", "?topic=__proto__"], ["constructor", "?topic=constructor"]])(
    "?topic — %s: «Призвание и работа», запроса нет, в чат уходит только один из трёх постоянных текстов", async (_name, search) => {
      signIn();
      mockSearch = search;
      chartRequest.mockResolvedValue(listOf(chart7));
      await render();
      expect(topicButton("career").getAttribute("aria-pressed")).toBe("true");
      expect(chat().dataset.topicQuestion).toBe(TOPICS.career.question);
      expect(chartRequest).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

  test("нажатие темы → setSearchParams({ chart, topic }, { replace: true }); ни запроса, ни перехода", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart9, chart8, chart7));
    await render();
    await act(async () => topicButton("money").click());
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    const [params, options] = mockSetSearchParams.mock.calls[0];
    expect(String(params.chart)).toBe("7");
    expect(params.topic).toBe("money");
    expect(options).toEqual({ replace: true });
    expect(chartRequest).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("«Любовь»: ссылка «Совместимость с конкретным человеком — в разборе отношений» → /relationships/new; у других тем её нет", async () => {
    signIn();
    chartRequest.mockResolvedValue(listOf(chart7));
    mockSearch = "?topic=love";
    await render();
    expect((await destination(control(LOVE_LINK))).to).toBe("/relationships/new");
    await act(async () => root.unmount());
    root = createRoot(container);
    for (const key of ["career", "money"]) {
      mockSearch = `?topic=${key}`;
      await render();
      expect(control(LOVE_LINK)).toBeUndefined();
      expect(container.querySelector('a[href="/relationships/new"]')).toBeNull();
      await act(async () => root.unmount());
      root = createRoot(container);
    }
  });
});
