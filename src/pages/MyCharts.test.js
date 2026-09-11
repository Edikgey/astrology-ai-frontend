import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MyCharts from "./MyCharts";
import NatalChartResultPage from "./NatalChartResultPage";
import { chartRequest } from "../api/chartsApi";

let mockChartId;
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ chartId: mockChartId }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true }); // CRA's Jest resolver predates React Router 7 package exports.
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));
jest.mock("../components/NatalChart", () => ({ chartId, children }) => <div data-chart={chartId}>{children}</div>);
jest.mock("../components/AskGptForm", () => ({ chartId }) => <div data-chat={chartId} />);

let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem("access_token", "test-token");
  jest.clearAllMocks();
  chartRequest.mockReset();
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
const summary = { chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "Test city" };

test("lists server data, formats saved time, opens the selected ID and shows the limit", async () => {
  chartRequest.mockResolvedValue({ charts: [summary], count: 3, limit: 3 });
  await render(<MyCharts />);
  expect(container.textContent).toContain("3 / 3");
  expect(container.textContent).toContain("02.01.2000");
  expect(container.textContent).toContain("12:30");
  expect(container.textContent).toContain("Test city");
  expect(button("Создать карту").disabled).toBe(true);
  await click(button("Открыть"));
  expect(mockNavigate).toHaveBeenCalledWith("/natal-chart-result/7");
});

test("delete requires confirmation, refreshes the list and releases the slot", async () => {
  chartRequest.mockResolvedValueOnce({ charts: [summary], count: 3, limit: 3 });
  await render(<MyCharts />);
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  await click(button("Удалить"));
  expect(chartRequest).toHaveBeenCalledTimes(1);
  confirm.mockReturnValue(true);
  localStorage.setItem("chart_id", "7");
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 7 }));
  chartRequest.mockResolvedValueOnce(null).mockResolvedValueOnce({ charts: [], count: 2, limit: 3 });
  await click(button("Удалить"));
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/7", { method: "DELETE", authenticated: true });
  expect(container.textContent).toContain("2 / 3");
  expect(button("Создать карту").disabled).toBe(false);
  expect(localStorage.getItem("chart_id")).toBeNull();
  expect(localStorage.getItem("natalChart")).toBeNull();
});

test("guests cannot load the saved user list", async () => {
  localStorage.removeItem("access_token");
  await render(<MyCharts />);
  expect(chartRequest).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Войдите в аккаунт");
});

test("opening by URL fetches that ID and passes it to visualization and GPT history", async () => {
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 999 }));
  mockChartId = "7";
  chartRequest.mockResolvedValue({ chart_id: 7 });
  await render(<NatalChartResultPage />);
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/7", expect.any(Object));
  expect(container.querySelector("[data-chart]").dataset.chart).toBe("7");
  expect(container.querySelector("[data-chat]").dataset.chat).toBe("7");
});

test("old guest URL uses its cached ID but verifies access on the backend", async () => {
  localStorage.removeItem("access_token");
  localStorage.setItem("session_token", "guest-token");
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 8 }));
  chartRequest.mockResolvedValue({ chart_id: 8 });
  await render(<NatalChartResultPage />);
  expect(chartRequest).toHaveBeenCalledWith("/natal-chart/8", expect.any(Object));
  expect(container.querySelector("[data-chat]").dataset.chat).toBe("8");
});

test("denied chart does not render cached data or chat", async () => {
  mockChartId = "7";
  localStorage.setItem("natalChart", JSON.stringify({ chart_id: 7 }));
  chartRequest.mockRejectedValue(Object.assign(new Error("Карта не найдена или недоступна."), { status: 404 }));
  await render(<NatalChartResultPage />);
  expect(container.textContent).toContain("Карта не найдена");
  expect(container.querySelector("[data-chart]")).toBeNull();
  expect(container.querySelector("[data-chat]")).toBeNull();
});

test("late response for previous chart cannot replace the newly opened chart", async () => {
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
