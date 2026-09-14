import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import AskGptForm, { CHAT_INTRO } from "./AskGptForm";

let mockAuth;
const mockNavigate = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
let root, container, originalFetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem("session_token", "guest-token");
  mockAuth = { user: null, loading: false };
  mockNavigate.mockReset();
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  global.fetch = originalFetch;
});
const render = async props => act(async () => root.render(<AskGptForm chartId={7} {...props} />));
const button = text => [...container.querySelectorAll("button")].find(el => el.textContent === text);
const click = async el => act(async () => el.click());
const response = data => ({ ok: true, json: async () => data });
const authenticate = () => { mockAuth = { user: { id: 1 }, loading: false }; localStorage.setItem("access_token", "jwt"); };

test("assistant chips send one ordinary user request even on immediate double-click", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: "Что важно в работе?" });
  const suggestions = ["Как проявляется моё лидерство?", "Что мешает мне развиваться?", "Что карта говорит о деньгах?"];
  global.fetch.mockResolvedValueOnce(response({ response: "Ответ о карьере", follow_up_suggestions: suggestions }));
  await click(button("Спросить"));
  const chips = container.querySelectorAll('.message.gpt .chat-follow-ups button');
  expect(chips).toHaveLength(3);
  expect(chips[0].closest('.message').textContent).toContain("Ответ о карьере");
  let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { chips[0].click(); chips[0].click(); });
  expect([...chips].every(chip => chip.disabled)).toBe(true);
  const posts = global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'));
  expect(posts).toHaveLength(2); // Original question and precisely one follow-up.
  expect(JSON.parse(posts[1][1].body)).toEqual({ chart_id: 7, question: suggestions[0] });
  expect(posts[1][1].headers.Authorization).toBe('Bearer jwt');
  await act(async () => finish(response({ response: "Ответ о лидерстве" })));
  expect([...container.querySelectorAll('.message.user')].map(el => el.textContent)).toContain('Вы' + suggestions[0]);
  expect(container.textContent).toContain('Ответ о лидерстве');
  expect(chips[0].disabled).toBe(false);
});

test.each([undefined, null, 'broken', ['one', 7, 'three']])("missing/malformed suggestions (%s) keep assistant text readable", async suggestions => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: 'Saved answer without chips' }]));
  await render({ initialQuestion: "Question" });
  global.fetch.mockResolvedValueOnce(response({ response: 'Valid answer', follow_up_suggestions: suggestions }));
  await click(button('Спросить'));
  expect(container.textContent).toContain('Saved answer without chips');
  expect(container.textContent).toContain('Valid answer');
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
});

test("a denied follow-up keeps its draft without retry or duplicate message", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: "First question" });
  global.fetch.mockResolvedValueOnce(response({ response: 'Answer', follow_up_suggestions: ['Next question?', 'Related question?', 'Deeper question?'] }));
  await click(button('Спросить'));
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce(response([]));
  await click(button('Next question?'));
  expect(container.querySelector('textarea').value).toBe('Next question?');
  expect(global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'))).toHaveLength(2);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

test("guest preview has static intro, four suggestions, no history, GPT requests or allowance", async () => {
  await render();
  expect(container.textContent).toContain(CHAT_INTRO);
  expect(container.querySelectorAll(".predefined-questions button")).toHaveLength(4);
  expect(container.querySelector("textarea")).not.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(container.textContent).not.toMatch(/10|300|allowance/);
});

test.each(["suggestion", "focus", "click", "input", "send"])("guest %s opens gate without any API request", async interaction => {
  await render();
  await act(async () => {
    if (interaction === "suggestion") button("Какие у меня сильные стороны?").click();
    if (interaction === "focus") Simulate.focus(container.querySelector("textarea"));
    if (interaction === "click") container.querySelector("textarea").click();
    if (interaction === "input") Simulate.change(container.querySelector("textarea"), { target: { value: "Мой вопрос" } });
    if (interaction === "send") Simulate.submit(container.querySelector("form"));
  });
  expect(container.querySelector("dialog[open]")).not.toBeNull();
  expect(container.textContent).toContain("Сохраните карту и продолжите разбор");
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([["Продолжить бесплатно", "register"], ["У меня уже есть аккаунт", "login"]])("%s preserves selected chart, token, question and return route", async (cta, mode) => {
  localStorage.setItem("chart_id", "999");
  await render();
  await click(button("Какие у меня сильные стороны?"));
  await click(button(cta));
  expect(mockNavigate).toHaveBeenCalledWith("/authorization", { state: {
    mode, returnTo: "/natal-chart-result/7", guestChart: { chartId: 7, sessionToken: "guest-token", pendingQuestion: "Какие у меня сильные стороны?" },
  } });
  expect(global.fetch).not.toHaveBeenCalled();
});

test("authenticated history, restored draft, suggestions and custom send use the same JWT flow", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: "user", content: "Old question" }, { role: "gpt", content: "Old answer" }]));
  const consumed = jest.fn();
  await render({ initialQuestion: "Pending question", onQuestionConsumed: consumed });
  expect(container.textContent).toContain("Old answer");
  expect(container.querySelector("textarea").value).toBe("Pending question");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer jwt" });
  await click(button("Какая карьера мне подходит?"));
  expect(container.querySelector("textarea").value).toBe("Какая карьера мне подходит?");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  global.fetch.mockResolvedValueOnce(response({ response: "Career answer" }));
  await click(button("Спросить"));
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ chart_id: 7, question: "Какая карьера мне подходит?" });
  expect(container.textContent).toContain("Career answer");
  expect(consumed).toHaveBeenCalledTimes(1);
  await act(async () => Simulate.change(container.querySelector("textarea"), { target: { value: "Custom question" } }));
  global.fetch.mockResolvedValueOnce(response({ response: "Custom answer" }));
  await click(button("Спросить"));
  expect(container.textContent).toContain("Custom answer");
  expect(global.fetch.mock.calls.every(([, options]) => !options.headers["X-Session-Token"])).toBe(true);
});

test("unsaved chart and pending auth never fetch GPT even with a JWT", async () => {
  authenticate();
  await render({ unsaved: true });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(button("Спросить").disabled).toBe(true);
  mockAuth.loading = true;
  await render();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("refresh restores one saved exchange without duplicate assistant responses", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: "Какие у меня сильные стороны?" });
  expect(container.querySelector("textarea").maxLength).toBe(4000);
  global.fetch.mockResolvedValueOnce(response({ response: "Связанный с картой ответ" }));
  await click(button("Спросить"));
  expect([...container.querySelectorAll(".message.gpt")].map(el => el.textContent).filter(text => text.includes("Связанный с картой ответ"))).toHaveLength(1);
  await act(async () => root.unmount());
  root = createRoot(container);
  global.fetch.mockResolvedValueOnce(response([
    { id: 101, role: "user", content: "Какие у меня сильные стороны?" },
    { id: 102, role: "gpt", content: "Связанный с картой ответ" },
  ]));
  await render();
  expect(container.querySelectorAll(".message")).toHaveLength(2);
  expect(container.querySelectorAll(".message.gpt")).toHaveLength(1);
  await act(async () => Simulate.change(container.querySelector("textarea"), { target: { value: "А как это проявляется в отношениях?" } }));
  global.fetch.mockResolvedValueOnce(response({ response: "Продолжение разговора" }));
  await click(button("Спросить"));
  expect(container.querySelectorAll(".message")).toHaveLength(4);
  expect(container.querySelectorAll(".message.gpt")).toHaveLength(2);
});

test("late history and send responses cannot appear on another chart", async () => {
  authenticate();
  let finishHistory, finishSend;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishHistory = resolve; }));
  await render();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ chartId: 8 });
  await act(async () => finishHistory(response([{ role: "gpt", content: "Wrong history" }])));
  expect(container.textContent).not.toContain("Wrong history");
  await click(button("Какая карьера мне подходит?"));
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishSend = resolve; }));
  await click(button("Спросить"));
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ chartId: 9 });
  await act(async () => finishSend(response({ response: "Wrong answer" })));
  expect(container.textContent).not.toContain("Wrong answer");
});

test.each([401, 403, 404, 409, 500])("history HTTP %s shows error and blocks send without guest fallback", async status => {
  authenticate();
  global.fetch.mockResolvedValue({ ok: false, status });
  await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(button("Спросить").disabled).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([401, 403, 404, 409, 500])("send HTTP %s retains the draft and refreshes history without retrying POST", async status => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render();
  await click(button("Какая карьера мне подходит?"));
  global.fetch.mockResolvedValueOnce({ ok: false, status }).mockResolvedValueOnce(response([]));
  await click(button("Спросить"));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector("textarea").value).toBe("Какая карьера мне подходит?");
  expect(global.fetch.mock.calls.filter(([url]) => url.includes("/ask-gpt"))).toHaveLength(1);
  expect(global.fetch.mock.calls.every(([, options]) => !options.headers["X-Session-Token"])).toBe(true);
});
