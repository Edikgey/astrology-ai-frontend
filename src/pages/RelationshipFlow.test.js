import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import RelationshipNewPage from "./RelationshipNewPage";
import RelationshipResultPage from "./RelationshipResultPage";
import biwheelFixture from "../components/synastry/fixtures/relationship.json";
import { chartRequest } from "../api/chartsApi";
import { relationshipRequest } from "../api/relationshipsApi";

let mockParams = { relationshipId: "9" };
let mockLocation = { pathname: "/relationships/new", state: null };
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate, useLocation: () => mockLocation, useParams: () => mockParams,
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock("../api/chartsApi", () => ({ chartRequest: jest.fn() }));
jest.mock("../api/relationshipsApi", () => ({ relationshipRequest: jest.fn() }));
jest.mock("../context/UsageContext", () => ({ useUsage: () => ({ usage: { plan: "free", saved_charts_used: 2,
  saved_charts_limit: 3 }, handleLimitError: jest.fn() }) }));
jest.mock("../components/AskGptForm", () => props => <div data-subject={props.subjectType} data-id={props.relationshipId}>{props.subtitle}</div>);

let root, container;
const charts = [{ chart_id: 7 }, { chart_id: 8 }, { chart_id: 10 }];
const snapshot = { aspects: [{ participant_a: "A", body_a: "☉", participant_b: "B", body_b: "☽", aspect: "△", orb_deg: 1.25 },
  { participant_a: "A", body_a: "♀", participant_b: "B", body_b: "MC", aspect: "☌", orb_deg: 2 }],
  house_overlays: [{ planet_participant: "A", house_participant: "B", available: true, placements: [{ body: "☉", house: 7 }] },
    { planet_participant: "B", house_participant: "A", available: false, reason: "missing_or_invalid_cusps", placements: [] }],
  angle_availability: { A: { AS: true, MC: true }, B: { AS: false, MC: true } } };
const relationship = { id: 9, chart_a_id: 7, chart_b_id: 8, person_a_label: "Анна", person_b_label: "Илья",
  speaker_person: "A", ruleset_version: "synastry-major-8-v1", calculation: snapshot };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); localStorage.setItem("access_token", "jwt");
  mockNavigate.mockReset(); chartRequest.mockReset(); relationshipRequest.mockReset();
  mockLocation = { pathname: "/relationships/new", state: null }; mockParams = { relationshipId: "9" };
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });
const render = component => act(async () => root.render(component));
const change = (selector, value) => act(async () => Simulate.change(container.querySelector(selector), { target: { value } }));

test("creation loads charts, prevents same pair, edits labels and opens created or duplicate result", async () => {
  chartRequest.mockResolvedValue({ charts, count: 3, limit: 3 });
  relationshipRequest.mockResolvedValue(relationship);
  await render(<RelationshipNewPage />);
  await change("#relationship-chart-A", "7");
  expect(container.querySelector('#relationship-chart-B option[value="7"]').disabled).toBe(true);
  await change("#relationship-chart-B", "8");
  await change("#relationship-label-A", "Анна новая");
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(relationshipRequest).toHaveBeenCalledWith("", { method: "POST", body: {
    chart_a_id: 7, chart_b_id: 8, person_a_label: "Анна новая", person_b_label: "Карта №8", speaker_person: null,
  } });
  expect(mockNavigate).toHaveBeenCalledWith("/relationships/9", { replace: true });
});

test("second-person flow restores Person A and auto-selects the newly created chart", async () => {
  mockLocation = { pathname: "/relationships/new", state: { relationshipDraft: { chartAId: 7, labelA: "Анна", speaker: "A" }, createdChartId: 10 } };
  chartRequest.mockResolvedValue({ charts, count: 3, limit: 3 });
  await render(<RelationshipNewPage />);
  expect(container.querySelector("#relationship-chart-A").value).toBe("7");
  expect(container.querySelector("#relationship-chart-B").value).toBe("10");
  expect(container.querySelector("#relationship-label-A").value).toBe("Анна");
  expect(container.querySelector("#relationship-label-B").value).toBe("Карта №10");
});

test("creation backend validation is readable and one-chart state reuses natal creation", async () => {
  chartRequest.mockResolvedValue({ charts: [charts[0]], count: 1, limit: 3 });
  await render(<RelationshipNewPage />);
  expect(container.textContent).toContain("Нужна ещё одна карта");
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Добавить карту другого человека").click());
  expect(mockNavigate).toHaveBeenCalledWith("/try-free", { state: { returnTo: "/relationships/new",
    relationshipDraft: { chartAId: null, chartBId: null, labelA: "", labelB: "", speaker: "" } } });
});

test("legacy or unverified chart rejection is shown as a readable creation error", async () => {
  chartRequest.mockResolvedValue({ charts, count: 3, limit: 3 });
  relationshipRequest.mockRejectedValue(new Error("Одна из карт создана без проверенного времени рождения. Создайте её заново."));
  await render(<RelationshipNewPage />);
  await change("#relationship-chart-A", "7"); await change("#relationship-chart-B", "8");
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(container.querySelector('[role="alert"]').textContent).toContain("без проверенного времени рождения");
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("result preserves A/B, places chat before facts and renders availability without a score", async () => {
  relationshipRequest.mockResolvedValue(relationship);
  await render(<RelationshipResultPage />);
  expect(container.textContent).toContain("Анна + Илья");
  expect(container.querySelector("[data-subject]").dataset.subject).toBe("relationship");
  expect(container.querySelector("[data-subject]").dataset.id).toBe("9");
  expect(container.querySelector(".relationship-chat").compareDocumentPosition(container.querySelector(".relationship-details")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.textContent).toContain("Анна · Солнце");
  expect(container.textContent).toContain("Илья · Луна");
  expect(container.textContent).toContain("Илья · MC");
  expect(container.textContent).toContain("дом 7");
  expect(container.textContent).toContain("не хватает проверенных куспидов");
  expect(container.textContent).not.toMatch(/\d+%|совместимость 87/i);
  expect(container.querySelector(".relationship-details details").open).toBe(false);
});

test("result deletion explains scope and returns safely without deleting charts", async () => {
  relationshipRequest.mockResolvedValueOnce(relationship).mockResolvedValueOnce(null);
  jest.spyOn(window, "confirm").mockReturnValue(true);
  await render(<RelationshipResultPage />);
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Удалить разбор").click());
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Обе натальные карты останутся"));
  expect(relationshipRequest).toHaveBeenLastCalledWith("/9", { method: "DELETE" });
  expect(mockNavigate).toHaveBeenCalledWith("/my-charts", { replace: true });
});

test('bi-wheel and adjacent selected detail precede chat, with reference facts below', async () => {
  relationshipRequest.mockResolvedValue(biwheelFixture);
  await render(<RelationshipResultPage />);
  const wheel = container.querySelector('.synastry-chart'), chat = container.querySelector('.relationship-chat');
  const aspectReference = container.querySelector('.relationship-synastry-reference');
  expect(wheel.querySelector('svg')).not.toBeNull();
  expect(wheel.querySelector('.synastry-detail')).not.toBeNull();
  expect(wheel.querySelector('.synastry-aspect-picker')).toBeNull();
  expect(wheel.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(chat.compareDocumentPosition(aspectReference) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(aspectReference.compareDocumentPosition(container.querySelector('.relationship-details')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  aspectReference.open = true;
  await act(async () => aspectReference.querySelector('button').click());
  expect(wheel.querySelector('.synastry-detail').textContent).toContain('Межкартовый аспект');
  expect(wheel.querySelectorAll('.synastry-anchor.is-selected')).toHaveLength(2);
});

test('loading and failed relationship fetch do not mount a renderer with invented data', async () => {
  let reject;
  relationshipRequest.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  await render(<RelationshipResultPage />);
  expect(container.textContent).toContain('Загрузка разбора');
  expect(container.querySelector('.synastry-chart')).toBeNull();
  await act(async () => reject(new Error('Разбор недоступен')));
  expect(container.querySelector('[role="alert"]').textContent).toBe('Разбор недоступен');
  expect(container.querySelector('.synastry-chart')).toBeNull();
});
