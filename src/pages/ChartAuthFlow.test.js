import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { AuthProvider } from "../context/AuthContext";
import AuthorizationPage from "./AuthorizationPage";
import NatalChartResultPage from "./NatalChartResultPage";
import TryFreePage from "./TryFreePage";
import MyCharts from "./MyCharts";
import Header from "../components/Header";

let mockLocation, mockChartId;
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => ({ chartId: mockChartId }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock("../components/NatalChart", () => props => <div data-chart={props.chartId} data-houses={JSON.stringify(props.houses)}>{props.children}</div>);
let container, root, originalFetch;
const guestToken = "12345678-1234-4234-8234-123456789abc";
const guestChart = { chartId: 7, sessionToken: guestToken, pendingQuestion: "Какие у меня сильные стороны?" };
const houses = [{ symbol: "I", degree: 10 }];
const ok = data => ({ ok: true, json: async () => data });
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem("session_token", guestToken);
  localStorage.setItem("chart_id", "999");
  mockLocation = { pathname: "/authorization", state: { guestChart, returnTo: "/natal-chart-result/7" } };
  mockChartId = "7";
  mockNavigate.mockReset();
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  jest.spyOn(console, "log").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});
const render = async page => act(async () => root.render(<AuthProvider>{page}</AuthProvider>));
const change = async (selector, value) => act(async () => Simulate.change(container.querySelector(selector), { target: { value } }));
const submit = async () => act(async () => Simulate.submit(container.querySelector("form")));
const gptCalls = () => global.fetch.mock.calls.filter(([url]) => /ask-gpt|gpt-messages/.test(url));

test.each(["login", "verify-code"].flatMap(flow => ["migrated", "limit_reached", "not_found", "not_requested"].map(status => [flow, status])))
  ("%s / %s preserves auth and the selected chart through return and reload", async (flow, status) => {
    if (flow === "verify-code") mockLocation.state.mode = "register";
    global.fetch.mockImplementation(async url => {
      if (url.includes("/auth/me")) return ok({ id: 1, email: "person@example.com" });
      if (url.includes("/auth/request-register")) return ok({ message: "Code sent" });
      if (url.includes("/auth/")) return ok({ access_token: "jwt", guest_chart_migration: { status, chart_id: 7 } });
      if (url.includes("/natal-charts")) return ok({ count: status === "migrated" ? 1 : 0, limit: 3, charts: status === "migrated" ? [{ chart_id: 7 }] : [] });
      if (url.includes("/natal-chart/7")) return ok({ chart_id: 7, houses });
      if (url.includes("/gpt-messages")) return ok([{ role: "gpt", content: "Existing answer" }]);
      throw new Error(`Unexpected request ${url}`);
    });
    await render(<AuthorizationPage />);
    await change('input[type="email"]', "person@example.com");
    await change('input[type="password"]', "test-password-only");
    await submit();
    if (flow === "verify-code") {
      expect(gptCalls()).toHaveLength(0);
      expect(localStorage.getItem("session_token")).toBe(guestToken);
      await change('input[placeholder="Код из почты"]', "123456");
      await submit();
    }
    const authCall = global.fetch.mock.calls.find(([url]) => url.includes(`/auth/${flow}`));
    expect(JSON.parse(authCall[1].body)).toEqual({ email: "person@example.com", password: "test-password-only", guest_chart_id: 7 });
    expect(authCall[1].headers["X-Session-Token"]).toBe(guestToken);
    expect(localStorage.getItem("access_token")).toBe("jwt");
    expect(localStorage.getItem("session_token")).toBe(guestToken);
    expect(mockNavigate).toHaveBeenLastCalledWith("/natal-chart-result/7", expect.objectContaining({ replace: true, state: { chartAuth: expect.objectContaining({ chartId: 7, status, pendingQuestion: guestChart.pendingQuestion }) } }));
    expect(gptCalls()).toHaveLength(0);
    const returnCall = mockNavigate.mock.calls.find(([, options]) => options?.state?.chartAuth);
    mockLocation = { pathname: returnCall[0], state: returnCall[1].state };
    await render(<NatalChartResultPage />);
    expect(container.querySelector("[data-chart]").dataset.chart).toBe("7");
    expect(JSON.parse(container.querySelector("[data-chart]").dataset.houses)).toEqual(houses);
    expect(container.querySelector("textarea").value).toBe(guestChart.pendingQuestion);
    const chartCalls = global.fetch.mock.calls.filter(([url]) => url.includes("/natal-chart/7"));
    expect(chartCalls.at(-1)[1].headers).toEqual(status === "migrated" ? { Authorization: "Bearer jwt" } : { "X-Session-Token": guestToken });
    if (status === "migrated") {
      expect(container.textContent).toContain("Existing answer");
      expect(container.textContent).toContain("Карта сохранена");
    } else {
      expect(gptCalls()).toHaveLength(0);
      expect(container.textContent).toContain("не сохранена");
    }
    expect(global.fetch.mock.calls.some(([url]) => url.includes("/ask-gpt"))).toBe(false);
    // Remount the provider/page with only browser storage and router state (F5).
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(<NatalChartResultPage />);
    expect(container.querySelector("[data-chart]").dataset.chart).toBe("7");
    expect(global.fetch.mock.calls.some(([url]) => url.includes("/ask-gpt"))).toBe(false);
    await render(<MyCharts />);
    expect(container.textContent.includes("Карта №7")).toBe(status === "migrated");
  });

test("ordinary login ignores old cached IDs and returns to its existing destination", async () => {
  mockLocation.state = { returnTo: "/pricing" };
  global.fetch.mockImplementation(async url => ok(url.includes("/auth/me") ? { id: 1 } : { access_token: "jwt", guest_chart_migration: { status: "not_requested", chart_id: null } }));
  await render(<AuthorizationPage />);
  await change('input[type="email"]', "person@example.com");
  await change('input[type="password"]', "test-password-only");
  await submit();
  expect(JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes("/auth/login"))[1].body)).not.toHaveProperty("guest_chart_id");
  expect(mockNavigate).toHaveBeenCalledWith("/pricing", { replace: true });
});

test("guest creation keeps the existing API flow, renders the result, and never fetches GPT", async () => {
  global.fetch.mockImplementation(async url => {
    if (/\/natal-chart(?:\/7)?$/.test(url)) return ok({ chart_id: 7, houses });
    throw new Error(`Unexpected request ${url}`);
  });
  await render(<TryFreePage />);
  await submit();
  const creation = global.fetch.mock.calls[0];
  expect(creation[1].headers["X-Session-Token"]).toBe(guestToken);
  expect(localStorage.getItem("chart_id")).toBe("7");
  expect(mockNavigate).toHaveBeenCalledWith("/natal-chart-result/7");
  mockLocation = { pathname: "/natal-chart-result/7", state: null };
  await render(<NatalChartResultPage />);
  expect(container.querySelector("[data-chart]").dataset.chart).toBe("7");
  expect(container.textContent).toContain("Я уже посмотрел вашу карту");
  expect(gptCalls()).toHaveLength(0);
  await render(<MyCharts />);
  expect(global.fetch.mock.calls.some(([url]) => url.includes("/natal-charts"))).toBe(false);
});

test("header auth uses only a successfully opened guest chart and forgets it on leaving", async () => {
  mockLocation = { pathname: "/natal-chart-result/7", state: null };
  global.fetch.mockResolvedValue(ok({ chart_id: 7, houses }));
  await render(<><Header /><NatalChartResultPage /></>);
  await act(async () => container.querySelector(".login-btn").click());
  expect(mockNavigate).toHaveBeenLastCalledWith("/authorization", { state: {
    guestChart: { chartId: 7, sessionToken: guestToken, pendingQuestion: "" }, returnTo: "/natal-chart-result/7",
  } });
  await render(<><Header /><div>Another page</div></>);
  await act(async () => container.querySelector(".login-btn").click());
  expect(mockNavigate).toHaveBeenLastCalledWith("/authorization", undefined);
});
