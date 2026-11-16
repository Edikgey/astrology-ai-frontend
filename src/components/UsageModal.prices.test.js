// FE-PAY-TIDY: the old list window takes its prices from PRICES (config/plans), not from its own text.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsageProvider } from "../context/UsageContext";
import UsageSummary from "./UsageSummary";

let mockAuth;
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../api/stripe", () => ({ stripeConfigured: false, getStripe: jest.fn(), billingRequest: jest.fn() }));
jest.mock("../config/plans", () => {
  const actual = jest.requireActual("../config/plans");
  return { ...actual, PRICES: { ...actual.PRICES, premium_month: { usd: "$1.11", rub: "111 ₽" } } };
});
let container, root, fetchOriginal;
const ok = value => ({ ok: true, json: async () => value });

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuth = { user: { id: 1, email: "test@example.test" }, token: "fake-jwt", loading: false };
  localStorage.setItem("access_token", "fake-jwt");
  const usage = { plan: "free", gpt_messages_used: 0, gpt_messages_limit: 10, gpt_limit_type: "lifetime",
    saved_charts_used: 0, saved_charts_limit: 3, lava_checkout_available: true };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  fetchOriginal = global.fetch;
  global.fetch = jest.fn(async () => ok(usage));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); localStorage.clear(); global.fetch = fetchOriginal; jest.restoreAllMocks();
});

test("both prices of the month in the old window are the ones of PRICES", async () => {
  await act(async () => root.render(<UsageProvider><UsageSummary /></UsageProvider>));
  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Перейти на Premium").click());
  const prices = [...container.querySelectorAll(".payment-option-price")].map(item => item.textContent);
  expect(prices).toEqual(["$1.11 USD / месяц", "111 ₽ / месяц"]);
});
