import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsageProvider } from "../context/UsageContext";
import UsageSummary from "./UsageSummary";

let mockAuth;
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../api/paddle", () => ({ paddleConfigured: false, onPaddleEvent: () => () => {},
  getPaddle: jest.fn(), billingRequest: jest.fn() }));
let container, root, state, tab, fetchOriginal;
const ok = value => ({ ok: true, json: async () => value });
const click = async text => {
  const button = [...container.querySelectorAll("button")].find(b => b.textContent === text);
  await act(async () => button.click());
};
const render = async () => act(async () => root.render(<UsageProvider><UsageSummary /><textarea defaultValue="Мой вопрос" /></UsageProvider>));

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuth = { user: { id: 1, email: "test@example.test" }, token: "fake-jwt", loading: false };
  localStorage.setItem("access_token", "fake-jwt");
  state = { plan: "free", gpt_messages_used: 0, gpt_messages_limit: 10, gpt_limit_type: "lifetime",
    saved_charts_used: 0, saved_charts_limit: 3, lava_checkout_available: true };
  tab = { opener: {}, close: jest.fn(), location: {} };
  jest.spyOn(window, "open").mockReturnValue(tab);
  jest.spyOn(window, "confirm").mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchOriginal = global.fetch;
  global.fetch = jest.fn(async url => ok(url.endsWith("/account/usage") ? state :
    url.endsWith("/cancel") ? { pending: true } : { url: "https://pay.example.test/invoice" }));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); localStorage.clear();
  global.fetch = fetchOriginal; jest.restoreAllMocks(); jest.useRealTimers();
  window.history.replaceState({}, "", "/");
});

test("RUB option uses authenticated server checkout without client price and preserves draft", async () => {
  await render(); await click("Перейти на Premium");
  expect(container.textContent).toContain("799 ₽ / месяц");
  await click("Оплатить в RUB");
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/payments/lava/checkout"),
    { method: "POST", headers: { Authorization: "Bearer fake-jwt" } });
  expect(tab.opener).toBeNull(); expect(tab.location.href).toBe("https://pay.example.test/invoice");
  expect(container.querySelector("textarea").value).toBe("Мой вопрос");
  expect(container.textContent).toContain("План: Free");
});

test("unconfigured Lava stays hidden and guest cannot start checkout", async () => {
  state.lava_checkout_available = false;
  await render(); await click("Перейти на Premium");
  expect(container.textContent).not.toContain("Оплатить в RUB");
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  expect(container.textContent).not.toContain("Оплатить в RUB");
});

test("stale checkout result after logout cannot navigate", async () => {
  await render(); await click("Перейти на Premium");
  let resolve;
  global.fetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await click("Оплатить в RUB");
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  await act(async () => resolve(ok({ url: "https://pay.example.test/invoice" })));
  expect(tab.close).toHaveBeenCalled(); expect(tab.location.href).toBeUndefined();
});

test("malformed checkout URL cannot navigate", async () => {
  await render(); await click("Перейти на Premium");
  global.fetch.mockResolvedValueOnce(ok({ url: "javascript:alert(1)" }));
  await click("Оплатить в RUB");
  expect(tab.close).toHaveBeenCalled(); expect(tab.location.href).toBeUndefined();
  expect(container.textContent).toContain("Некорректный адрес оплаты");
});

test("price/configuration errors retain Free and draft", async () => {
  await render(); await click("Перейти на Premium");
  global.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ detail: "Цена требует проверки" }) });
  await click("Оплатить в RUB");
  expect(container.textContent).toContain("Цена требует проверки");
  const lava = container.querySelector('[aria-label="Оплата в рублях — Lava.top"]');
  const paddle = container.querySelector('[aria-label="Международная оплата — Paddle"]');
  expect(lava.querySelector('[role="alert"]').textContent).toBe("Цена требует проверки");
  expect(paddle.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("План: Free");
  expect(container.querySelector("textarea").value).toBe("Мой вопрос");
});

test("payment cards share controls and keep Lava reusable after opening", async () => {
  await render(); await click("Перейти на Premium");
  const cards = [...container.querySelectorAll('.payment-option')];
  expect(cards).toHaveLength(2);
  expect(cards.map(c => c.querySelector('button').className)).toEqual(['usage-button', 'usage-button']);
  await click("Оплатить в RUB");
  expect(cards[1].querySelector('button').disabled).toBe(false);
  await click("Оплатить в RUB");
  expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/payments/lava/checkout'))).toHaveLength(2);
});

test("failed return does not claim payment received or start success polling", async () => {
  jest.useFakeTimers(); window.history.replaceState({}, "", "/my-charts?billing=lava&status=failed");
  await render();
  expect(container.textContent).toContain("Оплата не завершена");
  const count = global.fetch.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(60000));
  expect(global.fetch.mock.calls.length).toBe(count);
  expect(container.textContent).toContain("План: Free");
});

test("Lava subscriber gets confirmation and Lava cancel endpoint, never Paddle portal", async () => {
  state = { ...state, plan: "premium", payment_provider: "lava", can_cancel_subscription: true,
    can_manage_subscription: false };
  await render();
  expect(container.textContent).not.toContain("Управлять подпиской");
  await click("Отключить продление Lava");
  expect(window.confirm).toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/payments/lava/cancel"), expect.any(Object));
  expect(window.open).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Ожидаем подтверждение Lava");
});

test("declining cancellation does not send request", async () => {
  state = { ...state, plan: "premium", payment_provider: "lava", can_cancel_subscription: true };
  window.confirm.mockReturnValue(false); await render(); await click("Отключить продление Lava");
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith("/cancel"))).toBe(false);
});

test("forged successful return polls server and cannot grant Premium", async () => {
  jest.useFakeTimers(); window.history.replaceState({}, "", "/my-charts?billing=lava&status=success&invoiceId=fake");
  await render();
  expect(container.textContent).toContain("План: Free");
  expect(container.textContent).toContain("Ожидаем подтверждение");
  state = { ...state, plan: "premium" };
  await act(async () => jest.advanceTimersByTime(3000));
  expect(container.textContent).toContain("План: Premium");
});
