import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UsageProvider, useUsage } from "../context/UsageContext";
import UsageSummary from "./UsageSummary";
import AskGptForm from "./AskGptForm";
import TryFreePage from "../pages/TryFreePage";
import MyCharts from "../pages/MyCharts";

let mockAuth;
const mockNavigate = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/try-free", state: null }),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const FREE = { plan: "free", saved_charts_used: 3, saved_charts_limit: 3,
  gpt_messages_used: 3, gpt_messages_limit: 10, gpt_messages_reserved: 0,
  gpt_messages_available: 7, gpt_limit_type: "lifetime", gpt_period_valid: true,
  current_period_start: null, current_period_end: null };
const PREMIUM = { ...FREE, plan: "premium", saved_charts_limit: 10, gpt_messages_limit: 300,
  gpt_limit_type: "billing_period", current_period_start: "2026-09-12T00:00:00",
  current_period_end: "2026-10-12T00:00:00" };
const ok = data => ({ ok: true, status: 200, json: async () => data });
const fail = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) });
const calls = part => global.fetch.mock.calls.filter(([url]) => url.includes(part));
let root, container, originalFetch, serverUsage;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); localStorage.setItem("access_token", "jwt");
  mockAuth = { user: { id: 1 }, token: "jwt", loading: false };
  serverUsage = { ...FREE };
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith("/account/usage")) return ok(serverUsage);
    if (url.includes("/gpt-messages")) return ok([{ role: "gpt", content: "Saved answer" }]);
    if (url.endsWith("/natal-charts")) return ok({ count: 3, limit: 3, charts: [{ chart_id: 7 }] });
    throw new Error(`Unexpected test request: ${url}`);
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockNavigate.mockReset();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch; jest.restoreAllMocks();
});
const render = async (page = <UsageSummary />) => act(async () => root.render(<UsageProvider>{page}</UsageProvider>));
const button = text => [...container.querySelectorAll("button")].find(el => el.textContent === text);
const click = async el => act(async () => el.click());
const selectBirthplace = async () => {
  global.fetch.mockResolvedValueOnce(ok({ results: [{ formatted: 'AB', geometry: { lat: 50, lng: 30 },
    components: {}, annotations: { timezone: { name: 'Europe/Kyiv' } } }] }));
  await act(async () => Simulate.change(container.querySelector('[name="birthPlace"]'), { target: { name: 'birthPlace', value: 'ABC' } }));
  await click(container.querySelector('.suggestions-list li'));
};
const Refresh = () => { const { refreshUsage } = useUsage(); return <><UsageSummary /><button onClick={refreshUsage}>Refresh</button></>; };

test("guest and pending auth never request account usage; verified JWT loads server counters", async () => {
  mockAuth = { user: null, token: "jwt", loading: true };
  await render(); expect(global.fetch).not.toHaveBeenCalled();
  mockAuth = { user: { id: 1 }, token: "jwt", loading: false };
  serverUsage = { ...FREE, saved_charts_limit: 5, gpt_messages_limit: 17 };
  await render();
  expect(container.textContent).toContain("План: Free");
  expect(container.textContent).toContain("3 / 5");
  expect(container.textContent).toContain("3 / 17");
  expect(calls("/account/usage")[0][1].headers).toEqual({ Authorization: "Bearer jwt" });
  localStorage.removeItem("access_token"); mockAuth = { user: null, token: null, loading: false };
  await render(); expect(container.textContent).toBe(""); expect(calls("/account/usage")).toHaveLength(1);
});

test("Free upgrade preserves comparison modal and disables checkout when env is missing", async () => {
  await render(); await click(button("Перейти на Premium"));
  const modal = container.querySelector("dialog[open]");
  expect(modal.textContent).toContain("3 карты"); expect(modal.textContent).toContain("10 AI-вопросов за всё время");
  expect(modal.textContent).toContain("10 карт"); expect(modal.textContent).toContain("300 AI-вопросов в месяц");
  const upgrade = [...modal.querySelectorAll("button")].find(el => el.textContent === "Перейти на Premium");
  expect(upgrade.disabled).toBe(true); await click(upgrade);
  expect(modal.textContent).toContain("Оплата пока не настроена."); expect(global.fetch).toHaveBeenCalledTimes(1);
  await click(button("Закрыть")); expect(container.querySelector("dialog")).toBeNull();
});

test("Premium shows real billing period and pending reservations without any upgrade CTA", async () => {
  serverUsage = { ...PREMIUM, gpt_messages_used: 299, gpt_messages_reserved: 1 };
  await render();
  expect(container.textContent).toContain("План: Premium"); expect(container.textContent).toContain("299 / 300");
  expect(container.textContent).toContain("за расчётный период"); expect(container.textContent).toContain("12.10.2026");
  expect(container.textContent).toContain("Запросов в обработке: 1"); expect(button("Перейти на Premium")).toBeUndefined();
});

test.each([401, 500])("usage HTTP %s shows a recoverable error, never invented Free counters", async status => {
  global.fetch.mockResolvedValueOnce(fail(status, "Failure")); await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).not.toContain("План: Free"); expect(button("Перейти на Premium")).toBeUndefined();
  if (status === 401) expect(container.querySelector("a").getAttribute("href")).toBe("/authorization");
  else { await click(button("Обновить лимиты")); expect(container.textContent).toContain("3 / 10"); }
});

test("a late response from another JWT cannot expose usage or resurrect its modal", async () => {
  await render(); await click(button("Перейти на Premium"));
  let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => window.dispatchEvent(new Event("focus")));
  mockAuth = { user: { id: 2 }, token: "new-jwt", loading: false }; localStorage.setItem("access_token", "new-jwt");
  serverUsage = { ...PREMIUM, gpt_messages_used: 22 };
  await render(); await act(async () => finish(ok({ ...FREE, gpt_messages_used: 999 })));
  expect(container.textContent).toContain("22 / 300"); expect(container.textContent).not.toContain("999");
  expect(container.querySelector("dialog")).toBeNull();
});

test("overlapping refreshes for the same JWT keep the newest response", async () => {
  await render(<Refresh />); let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click(button("Refresh"));
  serverUsage = { ...FREE, gpt_messages_used: 4 }; await click(button("Refresh"));
  await act(async () => finish(ok(FREE)));
  expect(container.textContent).toContain("4 / 10");
});

test("successful GPT send keeps saved history and refreshes account usage", async () => {
  const consumed = jest.fn(); await render(<AskGptForm chartId={7} initialQuestion="Pending question" onQuestionConsumed={consumed} />);
  expect(container.textContent).toContain("Saved answer");
  serverUsage = { ...FREE, gpt_messages_used: 4, gpt_messages_available: 6 };
  global.fetch.mockResolvedValueOnce(ok({ response: "New answer" }));
  await click(button("Спросить"));
  expect(container.textContent).toContain("New answer"); expect(container.querySelector('.chat-allowance').textContent).toBe("Free · Доступно вопросов: 6");
  expect(calls("/account/usage")).toHaveLength(2); expect(calls("/ask-gpt")).toHaveLength(1);
  expect(consumed).toHaveBeenCalledTimes(1); expect(container.querySelector("textarea").value).toBe("");
});

test('chat shows the server-provided Premium availability in a compact composer indicator', async () => {
  serverUsage = { ...PREMIUM, gpt_messages_used: 12, gpt_messages_reserved: 1, gpt_messages_available: 287 };
  await render(<AskGptForm chartId={7} />);
  expect(container.querySelector('.chat-allowance').textContent).toBe('Premium · Доступно вопросов: 287');
  expect(container.querySelector('.chat-usage')).toBeNull();
  expect(button('Перейти на Premium')).toBeUndefined();
});

test.each(["GPT_LIMIT_REACHED", "gpt_limit_reached"])("%s retains pending question and opens Free paywall instead of generic error", async code => {
  const consumed = jest.fn(); await render(<AskGptForm chartId={7} initialQuestion="Pending question" onQuestionConsumed={consumed} />);
  serverUsage = { ...FREE, gpt_messages_used: 10 };
  global.fetch.mockResolvedValueOnce(fail(409, { code, plan: "free", used: 10, limit: 10 }));
  await click(button("Спросить"));
  expect(container.querySelector("dialog[open]").textContent).toContain("Достигнут лимит AI-вопросов");
  expect(container.textContent).not.toContain("Не удалось выполнить запрос");
  expect(container.querySelector("textarea").value).toBe("Pending question"); expect(consumed).not.toHaveBeenCalled();
  expect(calls("/ask-gpt")).toHaveLength(1); expect(calls("/gpt-messages")).toHaveLength(1);
  expect(container.textContent).toContain("Saved answer");
});

test.each(["GPT_LIMIT_REACHED", "GPT_PERIOD_INVALID"])("Premium %s never presents a Free paywall even if the cached plan was Free", async code => {
  await render(<AskGptForm chartId={7} initialQuestion="Question" />);
  serverUsage = { ...PREMIUM, gpt_messages_used: 300, gpt_period_valid: code !== "GPT_PERIOD_INVALID" };
  global.fetch.mockResolvedValueOnce(fail(409, { code, plan: "premium", used: 300, limit: 300 }));
  await click(button("Спросить"));
  const modal = container.querySelector("dialog[open]");
  expect(modal.textContent).toContain("Premium"); expect(modal.textContent).not.toContain("Free");
  expect(modal.textContent).not.toContain("Оплата пока не настроена."); expect(button("Перейти на Premium")).toBeUndefined();
});

test.each(["free", "premium"])("chart limit response for %s preserves the form and shows the appropriate limit state", async plan => {
  serverUsage = plan === "free" ? FREE : PREMIUM;
  await render(<TryFreePage />);
  await selectBirthplace();
  global.fetch.mockResolvedValueOnce(fail(409, { code: "CHART_LIMIT_REACHED", plan, used: serverUsage.saved_charts_limit, limit: serverUsage.saved_charts_limit }));
  await act(async () => Simulate.submit(container.querySelector("form")));
  const modal = container.querySelector("dialog[open]"); expect(modal.textContent).toContain("Достигнут лимит сохранённых карт");
  expect(modal.textContent.includes("Оплата пока не настроена.")).toBe(plan === "free");
  expect(container.querySelector('[name="birthPlace"]').value).toBe("AB"); expect(mockNavigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("chart_id")).toBeNull();
});

test("chart creation refreshes usage and navigates to the created ID", async () => {
  serverUsage = { ...FREE, saved_charts_used: 1 }; await render(<TryFreePage />);
  await selectBirthplace();
  serverUsage = { ...FREE, saved_charts_used: 2 }; global.fetch.mockResolvedValueOnce(ok({ chart_id: 8 }));
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(mockNavigate).toHaveBeenCalledWith("/natal-chart-result/8");
  expect(container.textContent).toContain("2 / 3"); expect(calls("/account/usage")).toHaveLength(2);
});

test("My Charts uses account limit 10 over an older list limit, then refreshes on deletion without resetting GPT usage", async () => {
  serverUsage = PREMIUM; await render(<MyCharts />);
  expect(container.textContent).toContain("3 из 10"); expect(button("Создать новую карту").disabled).toBe(false);
  jest.spyOn(window, "confirm").mockReturnValue(true);
  serverUsage = { ...PREMIUM, saved_charts_used: 2 };
  global.fetch.mockResolvedValueOnce({ ok: true, status: 204 });
  await click(button("Удалить карту"));
  expect(container.textContent).toContain("2 из 10"); expect(container.textContent).toContain("Осталось 7 из 300");
  expect(calls("/natal-chart/7")[0][1].method).toBe("DELETE");
});
