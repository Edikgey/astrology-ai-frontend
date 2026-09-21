import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MyCharts from "./MyCharts";
import NatalChartResultPage from "./NatalChartResultPage";
import { chartRequest } from "../api/chartsApi";
import { relationshipRequest } from "../api/relationshipsApi";

let mockChartId;
let mockUsage;
let mockBilling;
const mockNavigate = jest.fn();
const mockRefreshUsage = jest.fn();
const mockHandleLimitError = jest.fn();
const mockOpenUpgrade = jest.fn();
const mockManageSubscription = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ chartId: mockChartId }),
  useLocation: () => ({ pathname: `/natal-chart-result/${mockChartId}`, state: null }),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock("../context/UsageContext", () => ({ useUsage: () => mockUsage }));
jest.mock("../context/BillingContext", () => ({ useBilling: () => mockBilling }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));
jest.mock("../api/relationshipsApi", () => ({ relationshipRequest: jest.fn() }));
jest.mock("../components/NatalChart", () => ({ chartId, children }) => <div data-chart={chartId}>{children}</div>);
jest.mock("../components/AskGptForm", () => ({ chartId }) => <div data-chat={chartId} />);

const FREE = { plan: "free", saved_charts_used: 2, saved_charts_limit: 3,
  gpt_messages_used: 4, gpt_messages_limit: 10, gpt_messages_available: 6,
  gpt_limit_type: "lifetime", gpt_period_valid: true };
const PREMIUM = { ...FREE, plan: "premium", saved_charts_used: 3, saved_charts_limit: 10,
  gpt_messages_used: 47, gpt_messages_limit: 300, gpt_messages_available: 253,
  gpt_limit_type: "billing_period", can_manage_subscription: true };
const chart = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };
const secondChart = { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "A very long city name for layout verification" };
const relationship = { id: 9, chart_a_id: 7, chart_b_id: 8, person_a_label: "Анна", person_b_label: "Илья" };

let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem("access_token", "test-token");
  jest.clearAllMocks();
  chartRequest.mockReset();
  relationshipRequest.mockReset();
  chartRequest.mockResolvedValue({ charts: [chart, secondChart], count: 2, limit: 3 });
  relationshipRequest.mockResolvedValue({ relationships: [relationship], count: 1 });
  mockUsage = { usage: FREE, usageLoading: false, usageError: null, refreshUsage: mockRefreshUsage,
    handleLimitError: mockHandleLimitError, openUpgrade: mockOpenUpgrade };
  mockBilling = { busy: false, message: "", error: "", manageSubscription: mockManageSubscription };
  mockChartId = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

const render = async component => { await act(async () => root.render(component)); };
const click = async element => { await act(async () => element.click()); };
const button = label => [...container.querySelectorAll("button")].find(element => element.textContent === label);
const link = label => [...container.querySelectorAll("a")].find(element => element.textContent.trim().startsWith(label));

test("authenticated user sees the product dashboard", async () => {
  await render(<MyCharts />);
  expect(container.querySelector("h1").textContent).toBe("Ваше пространство");
  expect(container.textContent).toContain("Ваши карты, разговоры и разборы отношений — в одном месте.");
});

test("natal charts render as consumer cards with real date, time and city", async () => {
  await render(<MyCharts />);
  expect(container.querySelectorAll(".saved-charts-list > li")).toHaveLength(2);
  expect(container.textContent).toContain("2 января 2000 · 12:30");
  expect(container.textContent).toContain("Test city");
});

test("relationship analyses render in a separate section", async () => {
  await render(<MyCharts />);
  expect(container.querySelectorAll(".relationship-cards > li")).toHaveLength(1);
  expect(container.textContent).toContain("Анна + Илья");
  expect(container.textContent).toContain("Карта взаимодействия");
});

test("technical database IDs are not exposed in card copy", async () => {
  await render(<MyCharts />);
  expect(container.textContent).not.toContain("Карта №");
  expect(container.textContent).not.toContain("№ 7");
  expect(container.textContent).not.toContain("ID");
});

test("create chart CTA uses the existing onboarding route", async () => {
  await render(<MyCharts />);
  await click(button("Создать новую карту"));
  expect(mockNavigate).toHaveBeenCalledWith("/try-free");
});

test("create relationship CTAs use the existing relationship flow", async () => {
  await render(<MyCharts />);
  expect(link("Разобрать отношения").getAttribute("href")).toBe("/relationships/new");
  expect(link("+ Новый разбор").getAttribute("href")).toBe("/relationships/new");
});

test("natal open action links to the existing result route", async () => {
  await render(<MyCharts />);
  expect(link("Открыть карту").getAttribute("href")).toBe("/natal-chart-result/7");
});

test("relationship open action links to the existing result route", async () => {
  await render(<MyCharts />);
  expect(link("Открыть разбор").getAttribute("href")).toBe("/relationships/9");
});

test("relationship deletion confirmation says natal charts remain", async () => {
  await render(<MyCharts />);
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  await click(button("Удалить разбор"));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Исходные натальные карты сохранятся"));
  expect(relationshipRequest).toHaveBeenCalledTimes(1);
});

test("natal dependency conflict keeps a useful relationship instruction", async () => {
  chartRequest.mockResolvedValueOnce({ charts: [chart], count: 1, limit: 3 });
  await render(<MyCharts />);
  jest.spyOn(window, "confirm").mockReturnValue(true);
  chartRequest.mockRejectedValueOnce(Object.assign(new Error("raw"), { code: "relationship_dependencies_exist" }));
  await click(button("Удалить карту"));
  expect(container.textContent).toContain("Сначала удалите связанный разбор отношений");
  expect(container.textContent).not.toContain("raw");
});

test("Free plan status uses canonical available usage and shows upgrade", async () => {
  await render(<MyCharts />);
  expect(container.textContent).toContain("Бесплатный план");
  expect(container.textContent).toContain("Осталось 6 из 10 AI-вопросов за всё время аккаунта");
  await click(button("Перейти на Premium"));
  expect(mockOpenUpgrade).toHaveBeenCalledTimes(1);
});

test("Premium status uses billing-period data and existing management flow", async () => {
  mockUsage = { ...mockUsage, usage: PREMIUM };
  await render(<MyCharts />);
  expect(container.textContent).toContain("Осталось 253 из 300 AI-вопросов в текущем периоде");
  expect(button("Перейти на Premium")).toBeUndefined();
  await click(button("Управление подпиской"));
  expect(mockManageSubscription).toHaveBeenCalledTimes(1);
});

test("new user gets useful chart and relationship empty states without a dead-end relationship CTA", async () => {
  mockUsage = { ...mockUsage, usage: { ...FREE, saved_charts_used: 0 } };
  chartRequest.mockResolvedValue({ charts: [], count: 0, limit: 3 });
  relationshipRequest.mockResolvedValue({ relationships: [], count: 0 });
  await render(<MyCharts />);
  expect(container.textContent).toContain("Начните с первой карты");
  expect(button("Создать мою карту")).toBeDefined();
  expect(container.textContent).toContain("Для разбора отношений понадобятся две карты");
  expect(container.textContent).not.toContain("Создать разбор отношений");
});

test("one chart and no relationships explains the next step and links to creation", async () => {
  mockUsage = { ...mockUsage, usage: { ...FREE, saved_charts_used: 1 } };
  chartRequest.mockResolvedValue({ charts: [chart], count: 1, limit: 3 });
  relationshipRequest.mockResolvedValue({ relationships: [], count: 0 });
  await render(<MyCharts />);
  expect(container.textContent).toContain("Добавьте карту второго человека");
  expect(link("Создать разбор отношений").getAttribute("href")).toBe("/relationships/new");
});

test("relationship API failure leaves natal cards usable", async () => {
  relationshipRequest.mockRejectedValue(new Error("offline"));
  await render(<MyCharts />);
  expect(link("Открыть карту")).toBeDefined();
  expect(container.textContent).toContain("Не удалось загрузить разборы отношений");
  expect(container.textContent).not.toContain("offline");
});

test("chart API failure leaves relationship cards usable", async () => {
  chartRequest.mockRejectedValue(new Error("offline"));
  await render(<MyCharts />);
  expect(container.textContent).toContain("Не удалось загрузить карты");
  expect(link("Открыть разбор").getAttribute("href")).toBe("/relationships/9");
});

test("usage API failure stays local and does not hide product data", async () => {
  mockUsage = { ...mockUsage, usage: null, usageError: new Error("offline") };
  await render(<MyCharts />);
  expect(container.textContent).toContain("Не удалось обновить данные плана");
  expect(link("Открыть карту")).toBeDefined();
  expect(link("Открыть разбор")).toBeDefined();
});

test("loading state is complete while both collections are pending", async () => {
  chartRequest.mockReturnValue(new Promise(() => {}));
  relationshipRequest.mockReturnValue(new Promise(() => {}));
  await render(<MyCharts />);
  expect(container.querySelector('[role="status"]').textContent).toContain("Загрузка вашего пространства");
});

test("long participant labels stay intact and cards provide keyboard-usable native menus", async () => {
  const long = "Александра-Мария с очень длинным именем";
  relationshipRequest.mockResolvedValue({ relationships: [{ ...relationship, person_a_label: long,
    person_b_label: "Константин с ещё более длинным именем" }], count: 1 });
  await render(<MyCharts />);
  expect(container.textContent).toContain(long);
  const menu = container.querySelector('.relationship-cards summary[aria-label^="Действия с разбором"]');
  expect(menu).not.toBeNull();
  expect(menu.parentElement.tagName).toBe("DETAILS");
});

test("dashboard makes only the two collection requests and no AI request", async () => {
  await render(<MyCharts />);
  expect(chartRequest).toHaveBeenCalledTimes(1);
  expect(chartRequest).toHaveBeenCalledWith("/natal-charts", expect.any(Object));
  expect(relationshipRequest).toHaveBeenCalledTimes(1);
  expect(relationshipRequest).toHaveBeenCalledWith("", expect.any(Object));
  expect([...chartRequest.mock.calls, ...relationshipRequest.mock.calls].flat().join(" ")).not.toMatch(/gpt|ask|messages/i);
});

test("confirmed natal deletion refreshes collections and releases local selected data", async () => {
  chartRequest.mockReset()
    .mockResolvedValueOnce({ charts: [chart], count: 1, limit: 3 })
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ charts: [], count: 0, limit: 3 });
  relationshipRequest.mockResolvedValue({ relationships: [], count: 0 });
  localStorage.setItem("chart_id", "7");
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 7 }));
  jest.spyOn(window, "confirm").mockReturnValue(true);
  await render(<MyCharts />);
  await click(button("Удалить карту"));
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/7", { method: "DELETE", authenticated: true });
  expect(localStorage.getItem("chart_id")).toBeNull();
  expect(localStorage.getItem("natalChart")).toBeNull();
  expect(container.textContent).toContain("Начните с первой карты");
});

test("guests cannot load saved account collections", async () => {
  localStorage.removeItem("access_token");
  await render(<MyCharts />);
  expect(chartRequest).not.toHaveBeenCalled();
  expect(relationshipRequest).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Войдите в аккаунт");
});

test("opening a natal result URL still fetches that ID and passes it to visualization and chat", async () => {
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 999 }));
  mockChartId = "7";
  chartRequest.mockResolvedValue({ chart_id: 7 });
  await render(<NatalChartResultPage />);
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/7", expect.any(Object));
  expect(container.querySelector("[data-chart]").dataset.chart).toBe("7");
  expect(container.querySelector("[data-chat]").dataset.chat).toBe("7");
});

test("old guest natal URL keeps its established access flow", async () => {
  localStorage.removeItem("access_token");
  localStorage.setItem("session_token", "guest-token");
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 8 }));
  chartRequest.mockResolvedValue({ chart_id: 8 });
  await render(<NatalChartResultPage />);
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/8", expect.any(Object));
  expect(container.querySelector("[data-chat]").dataset.chat).toBe("8");
});

test("denied natal chart does not render cached visualization or chat", async () => {
  mockChartId = "7";
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 7 }));
  chartRequest.mockRejectedValue(Object.assign(new Error("Карта не найдена или недоступна."), { status: 404 }));
  await render(<NatalChartResultPage />);
  expect(container.textContent).toContain("Карта не найдена");
  expect(container.querySelector("[data-chart]")).toBeNull();
  expect(container.querySelector("[data-chat]")).toBeNull();
});

test("late response for a previous natal route cannot replace the newly opened chart", async () => {
  let resolvePrevious;
  mockChartId = "7";
  chartRequest.mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }));
  await render(<NatalChartResultPage />);
  mockChartId = "8";
  chartRequest.mockResolvedValueOnce({ chart_id: 8 });
  await render(<NatalChartResultPage />);
  await act(async () => resolvePrevious({ chart_id: 7 }));
  expect(container.querySelector("[data-chart]").dataset.chart).toBe("8");
  expect(container.querySelector("[data-chat]").dataset.chat).toBe("8");
});
