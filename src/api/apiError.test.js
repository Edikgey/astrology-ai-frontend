import { apiError } from "./apiError";
import { chartRequest } from "./chartsApi";
import { relationshipRequest } from "./relationshipsApi";

const NETWORK = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
const UNEXPECTED = "Сервер ответил неожиданно. Обновите страницу и попробуйте ещё раз.";
const FALLBACK = "Карта не найдена или недоступна.";

describe("apiError", () => {
  test("strips leading emoji and spaces from a Russian string detail", () => {
    expect(apiError(404, { detail: "❌ Карта не найдена" }, FALLBACK).message).toBe("Карта не найдена");
    expect(apiError(403, { detail: "⛔ Недоступно: карта не принадлежит пользователю" }, FALLBACK).message)
      .toBe("Недоступно: карта не принадлежит пользователю");
  });
  test("uses the Russian fallback for an English or empty detail", () => {
    expect(apiError(400, { detail: "Not found" }, FALLBACK).message).toBe(FALLBACK);
    expect(apiError(400, { detail: "❌" }, FALLBACK).message).toBe(FALLBACK);
    expect(apiError(400, { detail: "  " }, FALLBACK).message).toBe(FALLBACK);
  });
  test("keeps 401 text and structured detail untouched", () => {
    expect(apiError(401, { detail: "❌ Not authenticated" }, FALLBACK).message).toBe("Сессия истекла. Войдите снова.");
    const detail = { code: "GPT_LIMIT_REACHED", message: "Лимит вопросов исчерпан", limit: 3 };
    const error = apiError(403, { detail }, FALLBACK);
    expect(error.message).toBe("Лимит вопросов исчерпан");
    expect(error.detail).toBe(detail);
    expect(error.code).toBe("gpt_limit_reached");
    expect(error.status).toBe(403);
  });
  test("a status hint beats a string detail only when the caller asks for it", () => {
    expect(apiError(403, { detail: "⛔ Недоступно" }, "Подсказка", true).message).toBe("Подсказка");
    expect(apiError(403, { detail: { code: "X", message: "Из структуры" } }, "Подсказка", true).message).toBe("Из структуры");
  });
});

describe.each([
  ["chartRequest", () => chartRequest("/charts/1")],
  ["relationshipRequest", () => relationshipRequest("/1")],
])("%s", (_, call) => {
  let originalFetch;
  beforeEach(() => { localStorage.clear(); originalFetch = global.fetch; global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; });

  test("a network failure becomes a Russian text, not Failed to fetch", async () => {
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(call()).rejects.toThrow(NETWORK);
  });
  test("HTML in a 200 response becomes a Russian text", async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
    await expect(call()).rejects.toThrow(UNEXPECTED);
  });
  test("HTML in an error response keeps the status and shows the Russian text", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
    await expect(call()).rejects.toMatchObject({ message: UNEXPECTED, status: 502 });
  });
  test("an expired session still reads as 401 even with an HTML body", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => { throw new SyntaxError("x"); } });
    await expect(call()).rejects.toMatchObject({ message: "Сессия истекла. Войдите снова.", status: 401 });
  });
  test("an emoji detail is cleaned and the request is sent once", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: "❌ Карта не найдена" }) });
    await expect(call()).rejects.toThrow(/^Карта не найдена$/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  test("an aborted request is not reported as a network failure", async () => {
    const abort = new DOMException("aborted", "AbortError");
    global.fetch.mockRejectedValue(abort);
    await expect(call()).rejects.toBe(abort);
  });
});
