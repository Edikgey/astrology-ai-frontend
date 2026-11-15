import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { chartRequest } from "../api/chartsApi";
import OwnChartPicker from "./OwnChartPicker";

// Общий выбор своей карты (REVIEW FE-CHART-PICKER P3-1, P3-2): отмена запроса списка при уходе со страницы
// и отсутствие повторного запроса списка при смене адреса (?chart=, ?topic=).
let mockSearch = "";
let mockParamsCache = { search: null, params: null };
const mockParams = () => {
  if (mockParamsCache.search !== mockSearch) mockParamsCache = { search: mockSearch, params: new URLSearchParams(mockSearch) };
  return mockParamsCache.params;
};

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [mockParams(), jest.fn()],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1 }, loading: false, authError: null }) }));
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));

const TEXTS = { signInHeading: "Вход", signInText: "Войдите", emptyText: "Пусто" };
const charts = { charts: [{ chart_id: 7, year: 2000, month: 1, day: 2, hour: 12.5, city: "A" },
  { chart_id: 8, year: 1994, month: 11, day: 21, hour: 8.25, city: "B" }] };
// `params` — новый объект на каждой перерисовке, как у TopicsPage.
const picker = topic => <OwnChartPicker prefix="x" returnTo="/x" texts={TEXTS} params={{ topic }}>
  {chart => <div className="body" data-chart={chart.chart_id} />}
</OwnChartPicker>;
const listCalls = () => chartRequest.mock.calls.filter(([path]) => path === "/natal-charts");

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  chartRequest.mockReset();
  mockSearch = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("уход со страницы отменяет запрос /natal-charts: signal.aborted === true", async () => {
  chartRequest.mockReturnValue(new Promise(() => {})); // список висит
  await act(async () => root.render(picker("career")));
  expect(listCalls()).toHaveLength(1);
  const { signal } = listCalls()[0][1];
  expect(signal.aborted).toBe(false);
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  root = createRoot(container); // afterEach снимает ещё раз
});

test("смена ?chart= и темы не запрашивает список карт повторно", async () => {
  chartRequest.mockResolvedValue(charts);
  await act(async () => root.render(picker("career")));
  expect(container.querySelector(".body").dataset.chart).toBe("7");
  mockSearch = "?chart=8&topic=money";
  await act(async () => root.render(picker("money")));
  expect(container.querySelector(".body").dataset.chart).toBe("8");
  mockSearch = "?chart=7&topic=love";
  await act(async () => root.render(picker("love")));
  expect(container.querySelector(".body").dataset.chart).toBe("7");
  expect(listCalls()).toHaveLength(1);
});
