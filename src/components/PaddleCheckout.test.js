import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsageProvider } from "../context/UsageContext";
import UsageSummary from "./UsageSummary";
import { initializePaddle } from "@paddle/paddle-js";

let mockAuth;
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@paddle/paddle-js", () => ({ initializePaddle: jest.fn() }));
jest.mock("../api/paddle", () => {
  process.env.REACT_APP_PADDLE_CLIENT_TOKEN = "test_isolated_publishable_fixture";
  process.env.REACT_APP_PADDLE_PREMIUM_PRICE_ID = "pri_01m2aaqxhr6prath62z1efsvvn";
  return jest.requireActual("../api/paddle");
});
const PRICE = "pri_01m2aaqxhr6prath62z1efsvvn";
const TXN = "txn_" + "a".repeat(26);
let callback, container, root, serverUsage, originalFetch;
const paddle = { Checkout: { open: jest.fn(), close: jest.fn() }, PricePreview: jest.fn() };
const ok = data => ({ ok: true, status: 200, json: async () => data });
const free = { plan: "free", saved_charts_used: 1, saved_charts_limit: 3, gpt_messages_used: 2,
  gpt_messages_limit: 10, gpt_limit_type: "lifetime", gpt_period_valid: true };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem("access_token", "jwt");
  mockAuth = { user: { id: 1, email: "test@example.test" }, token: "jwt", loading: false };
  serverUsage = { ...free };
  initializePaddle.mockImplementation(async options => { callback = options.eventCallback; return paddle; });
  paddle.Checkout.open.mockClear(); paddle.Checkout.close.mockClear();
  paddle.PricePreview.mockResolvedValue({ data: { details: { lineItems: [{ price: { id: PRICE }, formattedTotals: { total: "39,99 zł" } }] } } });
  originalFetch = global.fetch;
  global.fetch = jest.fn(async url => {
    if (url.endsWith("/account/usage")) return ok(serverUsage);
    if (url.endsWith("/checkout")) return ok({ transaction_id: TXN, price_id: PRICE });
    if (url.endsWith("/portal")) return ok({ url: "https://sandbox-customer-portal.paddle.com/example" });
    throw new Error("Unexpected request");
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); global.fetch = originalFetch;
  localStorage.clear(); jest.restoreAllMocks(); jest.useRealTimers();
});
const render = async () => act(async () => root.render(<UsageProvider><UsageSummary /><textarea defaultValue="Pending question" /></UsageProvider>));
const click = async button => act(async () => button.click());
const upgrade = () => [...container.querySelectorAll("button")].find(b => b.textContent === "Upgrade to Premium");
const open = async () => { await render(); await click(upgrade()); await click(container.querySelector("dialog button")); };

test("authenticated upgrade opens sandbox server transaction and preserves pending question", async () => {
  await open();
  expect(initializePaddle).toHaveBeenCalledWith(expect.objectContaining({ environment: "sandbox", token: "test_isolated_publishable_fixture" }));
  expect(paddle.Checkout.open).toHaveBeenCalledWith({ transactionId: TXN, customer: { email: "test@example.test" }, settings: { displayMode: "overlay", allowLogout: false } });
  expect(global.fetch.mock.calls.find(([url]) => url.endsWith("/checkout"))[1]).toEqual({ method: "POST", headers: { Authorization: "Bearer jwt" } });
  expect(container.querySelector("dialog").open).toBe(false);
  expect(container.querySelector("textarea").value).toBe("Pending question");
  expect(container.textContent).toContain("План: Free");
  expect(container.textContent).toContain("39,99 zł / месяц");
  await act(async () => callback({ name: "checkout.closed" }));
  expect(container.querySelector("dialog").open).toBe(true);
  expect(container.querySelector("textarea").value).toBe("Pending question");
});

test("checkout success never grants premium until account usage confirms webhook", async () => {
  jest.useFakeTimers(); await open();
  await act(async () => callback({ name: "checkout.completed" }));
  expect(container.textContent).toContain("План: Free");
  expect(container.textContent).toContain("Ожидаем подтверждение");
  serverUsage = { ...free, plan: "premium", gpt_messages_limit: 300, saved_charts_limit: 10 };
  await act(async () => jest.advanceTimersByTime(3000));
  expect(container.textContent).toContain("План: Premium");
  expect(container.textContent).toContain("Premium активирован");
});

test("logout while checkout request is pending cannot open checkout for stale identity", async () => {
  await render(); await click(upgrade());
  let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await click(container.querySelector("dialog button"));
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  await act(async () => finish(ok({ transaction_id: TXN, price_id: PRICE })));
  expect(paddle.Checkout.open).not.toHaveBeenCalled();
});

test("guest cannot launch payment; server errors do not lose modal or draft", async () => {
  mockAuth = { user: null, token: null, loading: false }; localStorage.clear(); await render();
  expect(upgrade()).toBeUndefined(); expect(global.fetch).not.toHaveBeenCalled();
  mockAuth = { user: { id: 1 }, token: "jwt", loading: false }; localStorage.setItem("access_token", "jwt");
  await render(); await click(upgrade());
  global.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ detail: "Paddle Sandbox is not configured" }) });
  await click(container.querySelector("dialog button"));
  expect(paddle.Checkout.open).not.toHaveBeenCalled();
  expect(container.querySelector("dialog").open).toBe(true);
  expect(container.textContent).toContain("Paddle Sandbox is not configured");
  expect(container.querySelector("textarea").value).toBe("Pending question");
});

test("manage subscription opens fresh server portal URL without iframe", async () => {
  const tab = { opener: {}, location: {}, close: jest.fn() };
  jest.spyOn(window,"open").mockReturnValue(tab);
  serverUsage = { ...free, plan: "premium", can_manage_subscription: true };
  await render(); await click([...container.querySelectorAll("button")].find(b => b.textContent === "Manage subscription"));
  expect(tab.opener).toBeNull();
  expect(tab.location.href).toBe("https://sandbox-customer-portal.paddle.com/example");
  expect(global.fetch.mock.calls.find(([url]) => url.endsWith("/portal"))[1].headers.Authorization).toBe("Bearer jwt");
});
