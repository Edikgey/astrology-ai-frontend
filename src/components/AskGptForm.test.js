import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import AskGptForm, { CHAT_INTRO, MONTH_QUESTION } from "./AskGptForm";
import { productAnalytics } from "../analytics/productAnalytics";
import { TextEncoder, TextDecoder } from "util";

let mockAuth;
const mockNavigate = jest.fn();
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
const mockHandleLimitError = jest.fn(() => false);
jest.mock("../context/UsageContext", () => ({ useUsage: () => ({ usage: null, usageLoading: false, usageError: null,
  refreshUsage: async () => null, handleLimitError: error => mockHandleLimitError(error), openUpgrade: () => {}, noteOffer: () => {} }) }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
let root, container, originalFetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.TextDecoder = TextDecoder;
  localStorage.clear();
  localStorage.setItem("session_token", "guest-token");
  mockAuth = { user: null, loading: false };
  mockNavigate.mockReset();
  mockHandleLimitError.mockReset().mockReturnValue(false);
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
const button = text => [...container.querySelectorAll("button")].find(el => (el.querySelector('.chat-follow-up-text')?.textContent || el.textContent) === text);
const semanticSuggestions = texts => texts.map((text, index) => ({ type: ['deepen', 'personalize', 'explore'][index], text }));
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
  const suggestions = semanticSuggestions(['Что усиливает эту реакцию?', 'Как мне заметить это в жизни?', 'Как это связано с доверием?']);
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

test("guest window is a labelled modal dialog: focus moves in, then returns to the composer without reopening", async () => {
  await render();
  const textarea = container.querySelector("textarea");
  await act(async () => textarea.focus());
  const dialog = container.querySelector("dialog[open]");
  expect(dialog.getAttribute("role")).toBe("dialog");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.querySelector("#" + dialog.getAttribute("aria-labelledby")).textContent).toBe("Сохраните карту и продолжите разбор");
  expect(dialog.contains(document.activeElement)).toBe(true);
  await click(button("Вернуться к карте"));
  expect(container.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(textarea);
});

test("closing the guest window with a suggestion returns focus to that suggestion", async () => {
  await render();
  const suggestion = button("Какие у меня сильные стороны?");
  await act(async () => suggestion.focus());
  await click(suggestion);
  expect(container.querySelector("dialog[open]").contains(document.activeElement)).toBe(true);
  await act(async () => container.querySelector("dialog").dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
  expect(container.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(button("Какие у меня сильные стороны?"));
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

test('relationship subject uses isolated endpoints, starters, SSE and the shared usage refresh', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ subjectType: 'relationship', relationshipId: 42,
    heading: <>Поговорите <span>об отношениях</span></>, intro: 'Разбор пары готов.' });
  expect(global.fetch.mock.calls[0][0]).toContain('/relationships/42/messages');
  expect(container.textContent).toContain('Разбор пары готов.');
  expect(container.textContent).toContain('В чём наша главная сила как пары?');
  expect(container.querySelector('.askgpt-container').classList).toContain('is-empty-chat');
  await click(button('В чём наша главная сила как пары?'));
  const stream = controlledStream(); global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  const request = global.fetch.mock.calls[1];
  expect(request[0]).toContain('/relationships/42/ask');
  expect(JSON.parse(request[1].body)).toEqual({ question: 'В чём наша главная сила как пары?' });
  await stream.event({ type: 'delta', text: 'Ваша сила' });
  expect(container.querySelector('.chat-starters')).not.toBeNull();
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  await stream.event({ type: 'done', response: 'Ваша сила', follow_up_suggestions: semanticSuggestions(['Что поддерживает нашу близость?', 'Как нам слушать друг друга?', 'Как бережно спорить?']) });
  expect(container.querySelector('.chat-starters')).toBeNull();
  expect(container.querySelector('.askgpt-container').classList).not.toContain('is-empty-chat');
  expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3);
});

test.each(['natal', 'relationship'])('typed %s follow-ups use one ordinary send, replace old suggestions and clear on subject switch', async subjectType => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ subjectType, chartId: 42, relationshipId: 42, initialQuestion: 'Мой вопрос' });
  const suggestions = semanticSuggestions(['Что усиливает эту реакцию?', 'Как мне замечать её в жизни?', 'Как это связано с доверием?']);
  global.fetch.mockResolvedValueOnce(response({ response: 'Ответ', follow_up_suggestions: suggestions }));
  await click(button('Спросить'));
  expect([...container.querySelectorAll('.chat-follow-up-label')].map(el => el.textContent)).toEqual([
    'Разобрать глубже', 'Применить к ситуации', 'Исследовать дальше',
  ]);
  expect([...container.querySelectorAll('.chat-follow-up-text')].map(el => el.textContent)).toEqual(suggestions.map(item => item.text));
  expect(container.querySelector('.chat-starters')).toBeNull();
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button(suggestions[1].text));
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  const posts = global.fetch.mock.calls.filter(([, options]) => options.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(JSON.parse(posts[1][1].body)).toEqual(subjectType === 'relationship'
    ? { question: suggestions[1].text } : { chart_id: 42, question: suggestions[1].text });
  await stream.event({ type: 'delta', text: 'Продолжение' });
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  const next = semanticSuggestions(['Что лежит за этой потребностью?', 'Как мне обсудить это спокойно?', 'Что помогает мне сближаться?']);
  await stream.event({ type: 'done', response: 'Продолжение', follow_up_suggestions: next });
  expect([...container.querySelectorAll('.chat-follow-up-text')].map(el => el.textContent)).toEqual(next.map(item => item.text));
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ subjectType: subjectType === 'natal' ? 'relationship' : 'natal', chartId: 42, relationshipId: 42 });
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  expect(container.querySelector('.chat-starters')).not.toBeNull();
});

test('natal 42 and relationship 42 never share late history or request state', async () => {
  authenticate(); let finishNatal;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishNatal = resolve; }));
  await render({ chartId: 42 });
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: 'Relationship history' }]));
  await render({ chartId: 42, subjectType: 'relationship', relationshipId: 42 });
  await act(async () => finishNatal(response([{ role: 'gpt', content: 'Wrong natal history' }])));
  expect(container.textContent).toContain('Relationship history');
  expect(container.textContent).not.toContain('Wrong natal history');
  expect(global.fetch.mock.calls[0][0]).toContain('/gpt-messages?chart_id=42');
  expect(global.fetch.mock.calls[1][0]).toContain('/relationships/42/messages');
});

test('switching relationships aborts the previous subject and ignores its late response', async () => {
  authenticate(); let finishFirst;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
  await render({ subjectType: 'relationship', relationshipId: 41 });
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: 'Second pair' }]));
  await render({ subjectType: 'relationship', relationshipId: 42 });
  await act(async () => finishFirst(response([{ role: 'gpt', content: 'First pair late' }])));
  expect(container.textContent).toContain('Second pair');
  expect(container.textContent).not.toContain('First pair late');
});

test.each([
  [403, "⛔ Недоступно: карта не принадлежит пользователю", "Чат этой карты недоступен для вашего аккаунта."],
  [404, "❌ Натальная карта не найдена", "Чат этой карты недоступен для вашего аккаунта."],
  [409, "Conflict", "Запрос сейчас недоступен. Попробуйте позже."],
  [429, "Too many requests", "Слишком много запросов. Подождите немного и попробуйте ещё раз."],
])("send HTTP %s with a string detail shows the chat's own hint", async (status, detail, hint) => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render();
  await click(button("Какая карьера мне подходит?"));
  global.fetch.mockResolvedValueOnce({ ok: false, status, json: async () => ({ detail }) }).mockResolvedValueOnce(response([]));
  await click(button("Спросить"));
  expect(container.querySelector('[role="alert"]').textContent).toBe(hint);
});

test("send with a lost connection shows Russian text and keeps the draft", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render();
  await click(button("Какая карьера мне подходит?"));
  global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response([]));
  await click(button("Спросить"));
  expect(container.querySelector('[role="alert"]').textContent).toBe("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
  expect(container.querySelector("textarea").value).toBe("Какая карьера мне подходит?");
  expect(global.fetch.mock.calls.filter(([url]) => url.includes("/ask-gpt"))).toHaveLength(1);
});

test("history with HTML instead of JSON shows Russian text", async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
  await render();
  expect(container.querySelector('[role="alert"]').textContent)
    .toContain("Сервер ответил неожиданно. Обновите страницу и попробуйте ещё раз.");
});

// ---- CHAT-QUALITY-fe, CQF-4 (DESIGN.md §3 «FE-1», §7): разметка в ответах AI, не в репликах пользователя ----
const MARKED_ANSWER = "**Главное:** у вас сильная Луна.\n\n- Солнце в Рыбах\n- Луна в Раке\n- Асцендент в Деве";
const log = () => container.querySelector('[role="log"]');
const expectNoRawMarkup = el => {
  expect(el.textContent).not.toContain('**');
  expect(el.textContent).not.toMatch(/^- /m);
};
const HOSTILE_ANSWER = [
  'Привет <img src=x onerror=alert(1)> и <script>window.__xss=1</script>',
  '[ссылка](http://evil.example/page) и [клик](javascript:window.__xss=1)',
  '![картинка](http://evil.example/p.png)',
  '- <img src=x onerror=alert(2)>',
  '- **[жирная ссылка](http://evil.example)**',
].join('\n\n');
const expectNoActiveContent = () => {
  expect(log().querySelectorAll('a, img, script, iframe, style, svg')).toHaveLength(0);
  [...log().querySelectorAll('*')].forEach(el => [...el.attributes].forEach(attribute =>
    expect(attribute.name).not.toMatch(/^(on|href$|src$|srcdoc$|style$)/i)));
  expect(window.__xss).toBeUndefined();
};

test('CQF-4 stream: markup in the answer becomes strong and li in the conversation log, before and after done', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Расскажите про мою карту' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: '**Главное:** у вас сильная Луна.\n\n- Солнце в Рыбах\n- Луна ' });
  await stream.event({ type: 'delta', text: 'в Раке\n- Асцендент в Деве' });
  expect(log().querySelector('.message.gpt strong').textContent).toBe('Главное:');
  expect([...log().querySelectorAll('.message.gpt ul > li')].map(el => el.textContent))
    .toEqual(['Солнце в Рыбах', 'Луна в Раке', 'Асцендент в Деве']);
  expectNoRawMarkup(log().querySelector('.message.gpt'));
  await stream.event({ type: 'done', response: MARKED_ANSWER, follow_up_suggestions: [] });
  expect(log().querySelector('.message.gpt strong').textContent).toBe('Главное:');
  expect(log().querySelectorAll('.message.gpt li')).toHaveLength(3);
  expect(log().querySelector('.stream-indicator')).toBeNull();
  expectNoRawMarkup(log().querySelector('.message.gpt'));
});

test('CQF-4 stream: an unclosed ** is literal while streaming and bold once it closes', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Вопрос' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: 'Это **важ' });
  expect(log().querySelector('.message.gpt').textContent).toContain('Это **важ');
  expect(log().querySelector('.message.gpt strong')).toBeNull();
  await stream.event({ type: 'delta', text: 'но** для вас' });
  expect(log().querySelector('.message.gpt strong').textContent).toBe('важно');
  expect(log().querySelector('.message.gpt').textContent).not.toContain('**');
});

test('CQF-4: a non-stream JSON answer with markup renders the same way', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Вопрос' });
  global.fetch.mockResolvedValueOnce(response({ response: MARKED_ANSWER }));
  await click(button('Спросить'));
  expect(log().querySelector('.message.gpt strong').textContent).toBe('Главное:');
  expect(log().querySelectorAll('.message.gpt ul > li')).toHaveLength(3);
});

test('CQF-4: the user message with **x** and a list stays literal, in the log and after a reload from history', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  const question = 'Что значит **x** в карте?\n- первое\n- второе';
  await render({ initialQuestion: question });
  global.fetch.mockResolvedValueOnce(response({ response: MARKED_ANSWER }));
  await click(button('Спросить'));
  let user = log().querySelector('.message.user');
  expect(user.textContent).toBe(question);
  expect(user.querySelector('strong, em, ul, ol, li, br, p')).toBeNull();
  // Та же реплика пришла из истории (после обновления страницы).
  await act(async () => root.unmount());
  root = createRoot(container);
  global.fetch.mockResolvedValueOnce(response([{ role: 'user', content: question }, { role: 'gpt', content: MARKED_ANSWER }]));
  await render();
  user = log().querySelector('.message.user');
  expect(user.textContent).toBe(question);
  expect(user.querySelector('strong, em, ul, ol, li, br, p')).toBeNull();
  expect(log().querySelector('.message.gpt strong').textContent).toBe('Главное:');
});

test.each(['natal', 'relationship'])('CQF-4: an answer loaded from %s history is drawn with the same markup', async subjectType => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([
    { role: 'user', content: 'Что **главное**?' },
    { role: 'gpt', content: MARKED_ANSWER },
  ]));
  await render({ subjectType, chartId: 42, relationshipId: 42 });
  expect(log().querySelector('.message.gpt strong').textContent).toBe('Главное:');
  expect([...log().querySelectorAll('.message.gpt ul > li')].map(el => el.textContent))
    .toEqual(['Солнце в Рыбах', 'Луна в Раке', 'Асцендент в Деве']);
  expectNoRawMarkup(log().querySelector('.message.gpt'));
  expect(log().querySelector('.message.user').textContent).toBe('Что **главное**?');
  expect(log().querySelector('.message.user strong')).toBeNull();
});

test('CQF-4: HTML and links in a stored answer never reach the DOM as elements', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: HOSTILE_ANSWER }]));
  await render();
  expect(log().querySelector('.message.gpt').textContent).toContain('ссылка');
  expect(log().querySelector('.message.gpt').textContent).not.toContain('evil.example');
  expectNoActiveContent();
});

test('CQF-4: HTML and links in a streamed and a finished answer never reach the DOM as elements', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Вопрос' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: HOSTILE_ANSWER });
  expectNoActiveContent();
  await stream.event({ type: 'done', response: HOSTILE_ANSWER, follow_up_suggestions: [] });
  expectNoActiveContent();
  expect(log().querySelector('.message.gpt').textContent).toContain('ссылка');
  expect(log().querySelector('.message.gpt').textContent).not.toContain('evil.example');
});

test('CQF-4 guard (green on base): HTML in a user message and the waiting text stay plain', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([{ role: 'user', content: '<img src=x onerror=alert(1)> [т](http://evil.example)' }]));
  await render();
  expect(log().querySelector('.message.user').textContent).toBe('<img src=x onerror=alert(1)> [т](http://evil.example)');
  expect(log().querySelectorAll('a, img, script')).toHaveLength(0);
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: 'Вопрос' } }));
  await click(button('Спросить'));
  expect(log().textContent).toContain('Обдумываю вашу карту и вопрос...');
});

test('CQF-4: after a failed answer with markup the draft stays and the partial answer disappears', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: 'Мой вопрос' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response).mockResolvedValueOnce(response([]));
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: '**Главное:**\n- пункт' });
  expect(log().querySelector('.message.gpt strong')).not.toBeNull();
  await stream.event({ type: 'error', status: 502, detail: 'Stream interrupted' });
  expect(log().querySelector('.message.gpt strong')).toBeNull();
  expect(log().querySelector('.message.gpt li')).toBeNull();
  expect(container.querySelector('textarea').value).toBe('Мой вопрос');
});

test('a suggested question from the wheel fills the input for a signed-in user and is not sent', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ suggestedQuestion: null });
  await render({ suggestedQuestion: { id: 1, text: 'Что значит Венера в Стрельце в 6 доме в моей карте?' } });
  expect(container.querySelector('textarea').value).toBe('Что значит Венера в Стрельце в 6 доме в моей карте?');
  expect(global.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});

test('a suggested question reaches a guest input without opening the sign-in dialog', async () => {
  await render({ suggestedQuestion: null });
  await render({ suggestedQuestion: { id: 1, text: 'Что значит первый дом в моей карте?' } });
  expect(container.querySelector('textarea').value).toBe('Что значит первый дом в моей карте?');
  expect(container.querySelector('dialog')).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('asking again with the same text refills the input after the user changed it', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ suggestedQuestion: null });
  await render({ suggestedQuestion: { id: 1, text: 'Вопрос из круга' } });
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: 'Правка' } }));
  await render({ suggestedQuestion: { id: 2, text: 'Вопрос из круга' } });
  expect(container.querySelector('textarea').value).toBe('Вопрос из круга');
});

test('after «Спросить об этом» a guest keeps focus in the input and the sign-in dialog stays closed', async () => {
  await render({ suggestedQuestion: null });
  await render({ suggestedQuestion: { id: 1, text: 'Что значит первый дом в моей карте?' } });
  expect(document.activeElement).toBe(container.querySelector('textarea'));
  expect(container.querySelector('dialog')).toBeNull();
  await act(async () => Simulate.focus(container.querySelector('textarea')));
  expect(container.querySelector('dialog')).not.toBeNull();
});

// ---- MY-MONTH-fe, MF1-MF5 (DESIGN.md §7, §10): кнопка «Мой месяц» в чате карты; MY-MONTH-PAGE: MF1–MF3 переписаны (MM7), MF5 заменён на MM6 ----
// Литералы из DESIGN §2.3 и §3.4: тесты сравнивают дословно, не через константу кода.
const MONTH_TEXT = "Мой месяц: что меня ждёт в ближайшие 30 дней?";
const MONTH_LEGACY_TEXT = "Обзор месяца строится по транзитам, а для этой карты они не считаются: она построена в старой версии Lunaria, где часовой пояс рождения не проверялся. Постройте карту заново, выбрав место рождения из подсказок, и спросите о своём месяце в её чате.";
const MONTH_UNAVAILABLE_TEXT = "Сейчас не получилось рассчитать транзиты для обзора месяца. Квота не списана — попробуйте ещё раз через несколько минут.";
const OLD_EXCHANGE = [{ role: 'user', content: 'Привет' }, { role: 'gpt', content: 'Старый ответ' }];
const monthButton = () => container.querySelector('.chat-month button');
const posts = () => global.fetch.mock.calls.filter(([, init]) => init?.method === 'POST');

// MY-MONTH-PAGE MM7 (DESIGN §3 «Чат карты», §5): «Мой месяц» уходит из стартовых подсказок и становится входом на страницу.
test('MF1 (rewritten, MM7): signed-in first screen has 3 questions + «Задать свой вопрос»; «Мой месяц» is not a starter, MONTH_QUESTION stays the literal', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render();
  expect(MONTH_QUESTION).toBe(MONTH_TEXT);
  expect([...container.querySelectorAll('.chat-starters button')].map(el => el.textContent)).toEqual([
    'Какие у меня сильные стороны?', 'Что у меня с отношениями?', 'Какая карьера мне подходит?', 'Задать свой вопрос']);
  expect(container.textContent).not.toContain('Мой месяц');
  expect(container.querySelector('.chat-month')).toBeNull();
  expect(posts()).toHaveLength(0);
});

test('MF2 (rewritten, MM7): guest sees the same 4 suggestions without «Мой месяц»; the sign-in flow keeps the question the guest chose', async () => {
  await render();
  expect([...container.querySelectorAll('.predefined-questions button')].map(el => el.textContent)).toEqual([
    'Какие у меня сильные стороны?', 'Что у меня с отношениями?', 'Какая карьера мне подходит?', 'Задать свой вопрос']);
  expect(container.textContent).not.toContain('Мой месяц');
  await click(button('Что у меня с отношениями?'));
  expect(container.querySelector('dialog[open]')).not.toBeNull();
  await click(button('Продолжить бесплатно'));
  expect(mockNavigate).toHaveBeenCalledWith('/authorization', { state: {
    mode: 'register', returnTo: '/natal-chart-result/7',
    guestChart: { chartId: 7, sessionToken: 'guest-token', pendingQuestion: 'Что у меня с отношениями?' },
  } });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('MF3 (rewritten, MM7): after a fresh answer «Мой месяц» sits in its own .chat-month group and is an entry — navigate to /my-month?chart=7, no POST, no events', async () => {
  authenticate();
  const emit = jest.spyOn(productAnalytics, 'emit');
  try {
    global.fetch.mockResolvedValueOnce(response([]));
    await render({ initialQuestion: 'Что важно в работе?' });
    const suggestions = ['Как проявляется моё лидерство?', 'Что мешает мне развиваться?', 'Что карта говорит о деньгах?'];
    global.fetch.mockResolvedValueOnce(response({ response: 'Ответ о карьере', follow_up_suggestions: suggestions }));
    await click(button('Спросить'));
    expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3); // the group of 3 stays as it is
    const group = container.querySelector('.chat-month');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Обзор месяца');
    expect(group.closest('.chat-follow-ups')).toBeNull();
    expect(container.querySelector('.chat-follow-ups').contains(group)).toBe(false);
    expect(monthButton().textContent).toBe('Мой месяц');
    emit.mockClear();
    const postsBefore = posts().length; // the original question only
    await click(monthButton());
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/my-month?chart=7');
    expect(posts()).toHaveLength(postsBefore); // the button sent nothing
    const names = emit.mock.calls.map(([name]) => name);
    expect(names).not.toContain('ai_followup_selected');
    expect(names).not.toContain('ai_question_started');
    expect([...container.querySelectorAll('.message.user')].map(el => el.textContent)).not.toContain(MONTH_TEXT);
  } finally { emit.mockRestore(); }
});

test('MF3 (rewritten, MM7): «Мой месяц» is also under an answer loaded from history and leads to the page of the open chart id', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response(OLD_EXCHANGE));
  await render({ chartId: 55 });
  expect(container.querySelector('.chat-follow-ups')).toBeNull();
  expect(monthButton().textContent).toBe('Мой месяц');
  await click(monthButton());
  expect(mockNavigate).toHaveBeenCalledWith('/my-month?chart=55');
  expect(posts()).toHaveLength(0);
  expect(global.fetch).toHaveBeenCalledTimes(1); // only the history read
});

test('MF4 guard (green on base): no month group under an answer while it streams, after a month answer, in history with the question or on the first screen', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ initialQuestion: MONTH_TEXT });
  expect(container.querySelector('.chat-month')).toBeNull(); // first screen
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: 'Начало обзора' });
  expect(container.querySelector('.chat-month')).toBeNull(); // while the answer streams
  await stream.event({ type: 'done', response: 'Обзор месяца', follow_up_suggestions: [] });
  expect(container.textContent).toContain('Обзор месяца');
  expect(container.querySelector('.chat-month')).toBeNull(); // after the answer to MONTH_QUESTION
  await act(async () => root.unmount());
  root = createRoot(container);
  global.fetch.mockResolvedValueOnce(response([{ role: 'user', content: MONTH_TEXT }, { role: 'gpt', content: 'Обзор месяца' }]));
  await render();
  expect(container.textContent).toContain('Обзор месяца');
  expect(container.querySelector('.chat-month')).toBeNull(); // the question is already in the stored history
});

test('MF4 guard (green on base): while an ordinary answer streams over an old history there is no month group', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response(OLD_EXCHANGE));
  await render({ initialQuestion: 'Обычный вопрос' });
  const stream = controlledStream();
  global.fetch.mockResolvedValueOnce(stream.response);
  await click(button('Спросить'));
  await stream.event({ type: 'delta', text: 'Часть ответа' });
  expect(container.textContent).toContain('Часть ответа');
  expect(container.querySelector('.chat-month')).toBeNull();
});

test('MF4 guard (green on base): the pair chat has no «Мой месяц» in starters, under an answer or in history', async () => {
  authenticate();
  global.fetch.mockResolvedValueOnce(response([]));
  await render({ subjectType: 'relationship', relationshipId: 42 });
  expect(container.textContent).not.toContain('Мой месяц');
  global.fetch.mockResolvedValueOnce(response({ response: 'Ответ о паре', follow_up_suggestions: [] }));
  await act(async () => Simulate.change(container.querySelector('textarea'), { target: { value: 'Вопрос о паре' } }));
  await click(button('Спросить'));
  expect(container.textContent).toContain('Ответ о паре');
  expect(container.textContent).not.toContain('Мой месяц');
  expect(container.querySelector('.chat-month')).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(container);
  global.fetch.mockResolvedValueOnce(response([{ role: 'gpt', content: 'Старый ответ о паре' }]));
  await render({ subjectType: 'relationship', relationshipId: 43 });
  expect(container.textContent).toContain('Старый ответ о паре');
  expect(container.querySelector('.chat-month')).toBeNull();
});

// ---- MY-MONTH-PAGE-fe, MM4–MM6 (DESIGN §3 «Чатик view="month"», §4, §5): чатик «Мой месяц» над той же перепиской карты ----
// Тексты и тексты отказов — литералы из DESIGN §3 / §4 (дословно). heading / subtitle / intro чату передаёт страница (props).
const MONTH_HEADING = 'Обзор месяца';
const MONTH_SUBTITLE = 'Строится по транзитам — тому, как планеты сейчас стоят относительно вашей карты. Обзор и ответы сохраняются в разговоре этой карты.';
const MONTH_INTRO = 'Соберу обзор ваших ближайших 30 дней: любовь и отношения, работа и деньги, силы и самочувствие, на что обратить внимание. Потом можно спросить подробнее.';
const monthChat = props => render({ view: 'month', heading: MONTH_HEADING, subtitle: MONTH_SUBTITLE, intro: MONTH_INTRO, ...props });
const overviewButton = () => button('Собрать обзор месяца');
const newOverviewButton = () => button('Собрать новый обзор');
const messageTexts = kind => [...container.querySelectorAll(`.message.${kind}`)].map(el => el.textContent);
const typeQuestion = async value => act(async () => Simulate.change(container.querySelector('textarea'), { target: { value } }));
const typedSuggestions = semanticSuggestions(['Что усилит этот период?', 'Как мне это заметить?', 'Что с деньгами подробнее?']);
// Переписка карты целиком: старый обзор, обычный обмен, свежий обзор (created_at — UTC без пояса, usage.py:215), уточнение.
const MONTH_HISTORY = [
  { role: 'user', content: MONTH_TEXT, created_at: '2026-10-01T09:00:00' }, { role: 'gpt', content: 'Прошлый обзор месяца' },
  ...OLD_EXCHANGE,
  { role: 'user', content: MONTH_TEXT, created_at: '2026-11-14T12:00:00' }, { role: 'gpt', content: 'Обзор: любовь и работа' },
  { role: 'user', content: 'Что с деньгами?' }, { role: 'gpt', content: 'Ответ про деньги' },
];

describe('MM4: view="month", в переписке нет вопроса MONTH_QUESTION', () => {
  test('старая переписка не видна; вступление и одна кнопка обзора; нет поля, стартовых, .chat-month; классы is-month-view is-empty-chat', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(OLD_EXCHANGE));
    await monthChat();
    expect(container.textContent).not.toContain('Привет');
    expect(container.textContent).not.toContain('Старый ответ');
    expect(messageTexts('user')).toEqual([]);
    expect(container.querySelector('h2').textContent).toBe(MONTH_HEADING);
    expect(container.querySelector('.chat-heading p').textContent).toBe(MONTH_SUBTITLE);
    expect(messageTexts('gpt')).toEqual([MONTH_INTRO]);
    expect(overviewButton()).not.toBeNull();
    expect(overviewButton().classList).toContain('chat-send');
    expect(overviewButton().disabled).toBe(false);
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('.chat-starters')).toBeNull();
    expect(container.querySelector('.chat-month')).toBeNull();
    expect(container.querySelector('.chat-follow-ups')).toBeNull();
    expect(newOverviewButton()).toBeUndefined();
    const box = container.querySelector('.askgpt-container');
    expect(box.classList).toContain('is-month-view');
    expect(box.classList).toContain('is-empty-chat');
    expect(posts()).toHaveLength(0);
  });

  test('пустая переписка выглядит так же: вступление и кнопка обзора', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response([]));
    await monthChat();
    expect(messageTexts('gpt')).toEqual([MONTH_INTRO]);
    expect(overviewButton()).not.toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('.chat-starters')).toBeNull();
  });

  test('двойной клик по «Собрать обзор месяца» — один POST {chart_id: 7, question: MONTH_QUESTION}; после done — поле и подсказки модели', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response([]));
    await monthChat();
    expect(overviewButton()).not.toBeNull();
    let finish;
    global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => { const start = overviewButton(); start.click(); start.click(); });
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ chart_id: 7, question: MONTH_TEXT });
    expect(posts()[0][1].headers.Authorization).toBe('Bearer jwt');
    expect(messageTexts('user')).toEqual([MONTH_TEXT]);
    expect(overviewButton()?.disabled ?? true).toBe(true);
    await act(async () => finish(response({ response: 'Обзор: любовь, работа, силы', follow_up_suggestions: typedSuggestions })));
    expect(posts()).toHaveLength(1);
    expect(messageTexts('user')).toEqual([MONTH_TEXT]);
    expect(messageTexts('gpt').join('\n')).toContain('Обзор: любовь, работа, силы');
    expect(container.querySelector('textarea')).not.toBeNull();
    expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3);
    expect(container.querySelector('.chat-month')).toBeNull();
    expect(container.querySelector('.chat-starters')).toBeNull();
    expect(container.querySelector('.askgpt-container').classList).not.toContain('is-empty-chat');
    expect(container.querySelector('.askgpt-container').classList).toContain('is-month-view');
    expect(container.textContent).not.toContain('Обзор от'); // у только что отправленного вопроса даты нет — строки нет
  });
});

describe('MM5: view="month", в переписке есть MONTH_QUESTION', () => {
  test('лента — с ПОСЛЕДНЕГО такого вопроса; «Обзор от 14 ноября 2026», «Собрать новый обзор», поле, без стартовых', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(MONTH_HISTORY));
    await monthChat();
    expect(messageTexts('user')).toEqual([MONTH_TEXT, 'Что с деньгами?']);
    expect(messageTexts('gpt').join('\n')).toContain('Обзор: любовь и работа');
    expect(messageTexts('gpt').join('\n')).toContain('Ответ про деньги');
    for (const hidden of ['Прошлый обзор месяца', 'Привет', 'Старый ответ']) expect(container.textContent).not.toContain(hidden);
    expect(container.textContent).toContain('Обзор от 14 ноября 2026');
    expect(container.textContent).not.toContain('октября');
    expect(newOverviewButton()).not.toBeUndefined();
    expect(newOverviewButton().classList).toContain('button-secondary');
    expect(overviewButton()).toBeUndefined();
    expect(container.querySelector('textarea')).not.toBeNull();
    expect(container.querySelector('.chat-starters')).toBeNull();
    expect(container.querySelector('.chat-month')).toBeNull();
    const box = container.querySelector('.askgpt-container');
    expect(box.classList).toContain('is-month-view');
    expect(box.classList).not.toContain('is-empty-chat');
    expect(posts()).toHaveLength(0);
  });

  test.each([['нет created_at', undefined], ['created_at = null', null], ['дата не разобралась', 'не дата']])(
    'дата — только подпись: %s — строки «Обзор от» нет, остальное на месте', async (_name, createdAt) => {
      authenticate();
      global.fetch.mockResolvedValueOnce(response([{ role: 'user', content: MONTH_TEXT, created_at: createdAt }, { role: 'gpt', content: 'Обзор без даты' }]));
      await monthChat();
      expect(container.textContent).toContain('Обзор без даты');
      expect(newOverviewButton()).not.toBeUndefined();
      expect(container.textContent).not.toContain('Обзор от');
      expect(container.textContent).not.toContain('Invalid Date');
    });

  test('уточнение под обзором — один POST даже при двойной отправке; подсказки модели приходят после ответа', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(MONTH_HISTORY));
    await monthChat();
    expect(messageTexts('user')).toEqual([MONTH_TEXT, 'Что с деньгами?']); // лента с обзора, а не вся переписка
    await typeQuestion('А что с работой?');
    let finish;
    global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => { const send = button('Спросить'); send.click(); send.click(); });
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ chart_id: 7, question: 'А что с работой?' });
    await act(async () => finish(response({ response: 'Ответ про работу', follow_up_suggestions: typedSuggestions })));
    expect(posts()).toHaveLength(1);
    expect(messageTexts('user')).toEqual([MONTH_TEXT, 'Что с деньгами?', 'А что с работой?']);
    expect(container.textContent).toContain('Ответ про работу');
    expect(container.textContent).toContain('Обзор от 14 ноября 2026');
    expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3);
  });

  test('«Собрать новый обзор»: один POST при двойном клике, всё заблокировано до конца ответа, затем лента с НОВОГО вопроса', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(MONTH_HISTORY));
    await monthChat();
    expect(newOverviewButton()).not.toBeUndefined();
    const stream = controlledStream();
    global.fetch.mockResolvedValueOnce(stream.response);
    await act(async () => { const again = newOverviewButton(); again.click(); again.click(); });
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ chart_id: 7, question: MONTH_TEXT });
    // пока идёт ответ: поле, «Спросить» и «Собрать новый обзор» заблокированы
    expect(container.querySelector('textarea').disabled).toBe(true);
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(newOverviewButton()?.disabled ?? true).toBe(true);
    await stream.event({ type: 'delta', text: 'Новый обзор: ' });
    expect(newOverviewButton()?.disabled ?? true).toBe(true);
    expect(container.querySelector('textarea').disabled).toBe(true);
    await stream.event({ type: 'done', response: 'Новый обзор: силы и самочувствие', follow_up_suggestions: typedSuggestions });
    expect(posts()).toHaveLength(1);
    expect(messageTexts('user')).toEqual([MONTH_TEXT]); // с нового вопроса: старый обзор и уточнения ушли из ленты
    expect(messageTexts('gpt').join('\n')).toContain('Новый обзор: силы и самочувствие');
    for (const hidden of ['Обзор: любовь и работа', 'Ответ про деньги', 'Что с деньгами?', 'Прошлый обзор месяца']) {
      expect(container.textContent).not.toContain(hidden);
    }
    expect(container.textContent).not.toContain('Обзор от 14 ноября'); // у нового вопроса даты пока нет
    expect(container.querySelector('textarea').disabled).toBe(false);
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true); // поле пустое
    expect(newOverviewButton().disabled).toBe(false);
    expect(container.querySelectorAll('.chat-follow-ups button')).toHaveLength(3);
  });
});

describe('MM6: отказы в режиме месяца — текст сервера у кнопки, один POST, без повтора', () => {
  const MONTH_LEGACY = 'Обзор месяца строится по транзитам, а для этой карты они не считаются: она построена в старой версии Lunaria, где часовой пояс рождения не проверялся. Постройте карту заново, выбрав место рождения из подсказок, и спросите о своём месяце в её чате.';
  const MONTH_DOWN = 'Сейчас не получилось рассчитать транзиты для обзора месяца. Квота не списана — попробуйте ещё раз через несколько минут.';

  // Порядок в документе: лента → [role=alert] → кнопка обзора; между alert и кнопкой нет других кнопок, полей и ленты.
  const expectAlertRightBefore = (alert, target) => {
    const all = [...container.querySelectorAll('*')];
    const [log, from, to] = [container.querySelector('[role="log"]'), all.indexOf(alert), all.indexOf(target)];
    expect(all.indexOf(log)).toBeLessThan(from); // не вверху чата (там ошибка других чатов)
    expect(from).toBeLessThan(to);
    expect(all.slice(from + 1, to).filter(el => el.matches('button, textarea, [role="log"], a, select'))).toEqual([]);
  };

  test.each([
    ['422 JSON (старая карта)', MONTH_LEGACY, 'json'],
    ['SSE error 503', MONTH_DOWN, 'sse'],
  ])('%s: текст как есть в [role=alert] прямо перед кнопкой; один POST; лента пуста', async (_name, text, kind) => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(OLD_EXCHANGE));
    await monthChat();
    expect(overviewButton()).not.toBeNull();
    if (kind === 'json') {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: text }) }).mockResolvedValueOnce(response(OLD_EXCHANGE));
      await click(overviewButton());
    } else {
      const stream = controlledStream();
      global.fetch.mockResolvedValueOnce(stream.response).mockResolvedValueOnce(response(OLD_EXCHANGE));
      await click(overviewButton());
      await stream.event({ type: 'error', status: 503, detail: text });
    }
    const alerts = container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(text);
    expect(overviewButton()).not.toBeNull();
    expectAlertRightBefore(alerts[0], overviewButton());
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body)).toEqual({ chart_id: 7, question: MONTH_TEXT });
    expect(messageTexts('user')).toEqual([]); // лента пуста: вопрос не остался висеть
    expect(container.textContent).not.toContain('Старый ответ');
    expect(overviewButton().disabled).toBe(false); // повторить может только человек
    expect(container.querySelector('textarea')).toBeNull();
  });

  test('отказ при «Собрать новый обзор» — ошибка прямо перед этой кнопкой, лента прежнего обзора на месте, один POST', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response(MONTH_HISTORY));
    await monthChat();
    expect(newOverviewButton()).not.toBeUndefined();
    global.fetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: MONTH_LEGACY }) }).mockResolvedValueOnce(response(MONTH_HISTORY));
    await click(newOverviewButton());
    const alerts = container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(MONTH_LEGACY);
    expectAlertRightBefore(alerts[0], newOverviewButton());
    expect(posts()).toHaveLength(1);
    expect(container.textContent).toContain('Обзор: любовь и работа');
    expect(messageTexts('user')).toEqual([MONTH_TEXT, 'Что с деньгами?']);
  });

  test('лимит вопросов — handleLimitError (окно тарифов), без текста ошибки и без повтора', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response([]));
    await monthChat();
    expect(overviewButton()).not.toBeNull();
    mockHandleLimitError.mockReturnValueOnce(true);
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ detail: { code: 'gpt_limit_reached', plan: 'free' } }) });
    await click(overviewButton());
    expect(mockHandleLimitError).toHaveBeenCalledTimes(1);
    expect(mockHandleLimitError.mock.calls[0][0].code).toBe('gpt_limit_reached');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(posts()).toHaveLength(1);
    expect(messageTexts('user')).toEqual([]);
    expect(overviewButton()).not.toBeNull();
  });

  test('401: «Сессия истекла. Войдите снова.» у кнопки, один POST', async () => {
    authenticate();
    global.fetch.mockResolvedValueOnce(response([]));
    await monthChat();
    expect(overviewButton()).not.toBeNull();
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Not authenticated' }) }).mockResolvedValueOnce(response([]));
    await click(overviewButton());
    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toBe('Сессия истекла. Войдите снова.');
    expectAlertRightBefore(alert, overviewButton());
    expect(posts()).toHaveLength(1);
  });
});
