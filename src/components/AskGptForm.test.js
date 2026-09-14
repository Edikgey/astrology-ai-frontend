import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import AskGptForm, { CHAT_INTRO } from "./AskGptForm";
import { TextEncoder, TextDecoder } from "util";

let mockAuth;
const mockNavigate = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
let root, container, originalFetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.TextDecoder = TextDecoder;
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
const button = text => [...container.querySelectorAll("button")].find(el => el.textContent.replace(/^→ /, '') === text);
const click = async el => act(async () => el.click());
const response = data => ({ ok: true, json: async () => data });
const authenticate = () => { mockAuth = { user: { id: 1 }, loading: false }; localStorage.setItem("access_token", "jwt"); };

// Deliberately controlled chunks: assertions run while the response is still open.
const controlledStream = () => {
  let pending;
  const reader = {
    read: jest.fn(() => new Promise(resolve => { pending = resolve; })),
    cancel: jest.fn(async () => {}), releaseLock: jest.fn(),
  };
  return {
    response: { ok: true, headers: { get: () => 'text/event-stream' }, body: { getReader: () => reader } },
    reader,
    bytes: async value => act(async () => pending({ value, done: false })),
    event: async event => act(async () => pending({ value: new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`), done: false })),
    end: async () => act(async () => pending({ done: true })),
  };
};

test('real chunks render before completion; suggestions wait for done and scroll respects the reader', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: 'Old answer' }]));
  await render({ initialQuestion: 'Что важно для меня?' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  expect(global.fetch.mock.calls[1][1].headers.Accept).toBe('text/event-stream');
  const history = container.querySelector('.chat-messages');
  Object.defineProperties(history, { scrollHeight: { value: 1200, configurable: true }, clientHeight: { value: 300 } });
  await stream.event({ type: 'delta', text: 'Мой путь ' });
  expect(container.textContent).toContain('Мой путь ');
  expect(history.scrollTop).toBe(1200);
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  expect(container.querySelector('.stream-indicator')).not.toBeNull();
  history.scrollTop = 80;
  await act(async () => Simulate.scroll(history));
  // A UTF-8 character split across network chunks must remain intact.
  const bytes = new TextEncoder().encode('data: {"type":"delta","text":"🌙"}\n\n');
  const split = bytes.indexOf(0xf0) + 2;
  await stream.bytes(bytes.slice(0, split));
  await stream.bytes(bytes.slice(split));
  expect(container.textContent).toContain('Мой путь 🌙');
  expect(history.scrollTop).toBe(80);
  const suggestions = ['Как мне раскрыть свои силы?', 'Что мне важно в отношениях?', 'Как мне выбрать направление?'];
  await stream.event({ type: 'done', response: 'Мой путь 🌙', follow_up_suggestions: suggestions });
  expect(history.scrollTop).toBe(80);
  expect(container.querySelector('.stream-indicator')).toBeNull();
  expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3);
  expect(container.querySelector('.chat-starters')).toBeNull();
  expect(container.querySelectorAll('.message.user')).toHaveLength(1);
  expect(container.querySelectorAll('.message.gpt')).toHaveLength(2);
  expect(global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'))).toHaveLength(1);
  expect(stream.reader.cancel).toHaveBeenCalledTimes(1);
  expect(stream.reader.releaseLock).toHaveBeenCalledTimes(1);
});

test.each(['disconnect', 'error'])('interrupted stream (%s) reloads saved history, keeps draft and never retries POST', async ending => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Мой вопрос' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response).mockResolvedValueOnce(response([{ role: 'gpt', content: 'Saved history' }]));
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: 'Partial answer' });
  expect(container.textContent).toContain('Partial answer');
  if (ending === 'disconnect') await stream.end();
  else await stream.event({ type: 'error', status: 502, detail: 'Stream interrupted' });
  expect(container.textContent).not.toContain('Partial answer');
  expect(container.textContent).toContain('Saved history');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('textarea').value).toBe('Мой вопрос');
  expect(container.querySelector('textarea').disabled).toBe(false);
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  expect(global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'))).toHaveLength(1);
});

test("assistant chips send one ordinary user request even on immediate double-click", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: "Что важно в работе?" });
  const suggestions = ["Как проявляется моё лидерство?", "Что мешает мне развиваться?", "Что карта говорит о деньгах?"];
  global.fetch.mockResolvedValueOnce(response({ response: "Ответ о карьере", follow_up_suggestions: suggestions }));
  await click(button("Спросить"));
  const chips = container.querySelectorAll('.chat-follow-ups button');
  expect(chips).toHaveLength(3);
  expect(container.querySelector('.message.gpt').textContent).toContain("Ответ о карьере");
  let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { chips[0].click(); chips[0].click(); });
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
  const posts = global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'));
  expect(posts).toHaveLength(2); // Original question and precisely one follow-up.
  expect(JSON.parse(posts[1][1].body)).toEqual({ chart_id: 7, question: suggestions[0] });
  expect(posts[1][1].headers.Authorization).toBe('Bearer jwt');
  await act(async () => finish(response({ response: "Ответ о лидерстве" })));
  expect([...container.querySelectorAll('.message.user')].map(el => el.textContent)).toContain(suggestions[0]);
  expect(container.textContent).toContain('Ответ о лидерстве');
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
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

test('empty chat has starters until its first completed answer, including answers without suggestions', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Мой вопрос' });
  expect(container.querySelector('h2').textContent).toBe('Ваш персональный AI-астролог');
  expect(container.querySelector('.badge')).toBeNull();
  expect(container.querySelector('.chat-usage')).toBeNull();
  expect(container.querySelectorAll('.chat-starters button')).toHaveLength(4);
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: 'Начало ответа' });
  expect(container.querySelector('.chat-starters')).not.toBeNull();
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  await stream.event({ type: 'done', response: 'Начало ответа', follow_up_suggestions: [] });
  expect(container.querySelector('.chat-starters')).toBeNull();
  expect(container.querySelector('.message.user strong')).toBeNull();
  expect(container.querySelector('.message.gpt strong')).toBeNull();
});

test('composer grows with the draft and resets after one successful send', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render();
  const textarea = container.querySelector('textarea');
  Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => textarea.value.length > 50 ? 320 : 48 });
  const question = 'Мой длинный вопрос\n'.repeat(12);
  await act(async () => Simulate.change(textarea, { target: { value: question } }));
  expect(textarea.style.height).toBe('320px'); // CSS max-height caps the rendered box, then scrolls internally.
  global.fetch.mockResolvedValueOnce(response({ response: 'Ответ' }));
  await click(button('Спросить'));
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).question).toBe(question.trim());
  expect(textarea.value).toBe('');
  expect(textarea.style.height).toBe('48px');
  expect(global.fetch.mock.calls.filter(([url]) => url.includes('/ask-gpt'))).toHaveLength(1);
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

test("authenticated history hides starters; restored draft and custom send use the same JWT flow", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: "user", content: "Old question" }, { role: "gpt", content: "Old answer" }]));
  const consumed = jest.fn();
  await render({ initialQuestion: "Pending question", onQuestionConsumed: consumed });
  expect(container.textContent).toContain("Old answer");
  expect(container.querySelector("textarea").value).toBe("Pending question");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer jwt" });
  expect(container.querySelector('.chat-starters')).toBeNull();
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: 'Какая карьера мне подходит?' } }));
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
