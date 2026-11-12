import { login, verifyCode, requestRegister, getMe, requestPasswordReset, resetPassword } from "./authApi";

const guestToken = "12345678-1234-4234-8234-123456789abc";
const flows = [
  ["verification", () => verifyCode("123456", "new@example.com", "test-password-only")],
  ["login", () => login("existing@example.com", "test-password-only")],
];
let originalFetch;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("session_token", guestToken);
  originalFetch = global.fetch;
  global.fetch = jest.fn();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test.each(flows)("%s keeps the guest token until the backend succeeds", async (_, submit) => {
  let completeRequest;
  global.fetch.mockImplementation(() => new Promise(resolve => { completeRequest = resolve; }));
  const request = submit();
  expect(localStorage.getItem("session_token")).toBe(guestToken);
  expect(global.fetch.mock.calls[0][1].headers["X-Session-Token"]).toBe(guestToken);
  completeRequest({ ok: true, json: async () => ({ access_token: "test-jwt", token_type: "bearer" }) });
  await request;
  expect(localStorage.getItem("session_token")).toBe(guestToken);
  expect(localStorage.getItem("access_token")).toBe("test-jwt");
});

test.each(flows)("%s keeps guest access when the backend rejects the request", async (_, submit) => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ detail: "Request rejected" }) });
  await expect(submit()).rejects.toThrow("Request rejected");
  expect(localStorage.getItem("session_token")).toBe(guestToken);
  expect(localStorage.getItem("access_token")).toBeNull();
});

test.each(flows)("%s keeps guest access on a network error", async (_, submit) => {
  global.fetch.mockRejectedValue(new Error("Network unavailable"));
  await expect(submit()).rejects.toThrow("Network unavailable");
  expect(localStorage.getItem("session_token")).toBe(guestToken);
  expect(localStorage.getItem("access_token")).toBeNull();
});

test.each(["login", "verification"])("%s sends only the explicitly selected ID and its original token", async flow => {
  localStorage.setItem("chart_id", "999");
  const context = { chartId: 7, sessionToken: guestToken };
  const result = { access_token: "jwt", guest_chart_migration: { status: "migrated", chart_id: 7 } };
  global.fetch.mockResolvedValue({ ok: true, json: async () => result });
  const data = await (flow === "login" ? login("a@example.com", "password", context) : verifyCode("123456", "a@example.com", "password", context));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ email: "a@example.com", password: "password", ...(flow==='verification'?{code:'123456'}:{}), guest_chart_id: 7 });
  expect(global.fetch.mock.calls[0][1].headers["X-Session-Token"]).toBe(guestToken);
  expect(data).toEqual(result);
});

test.each(flows)("%s ordinary auth does not reuse a cached chart ID", async (_, submit) => {
  localStorage.setItem("chart_id", "999");
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: "jwt", guest_chart_migration: { status: "not_requested", chart_id: null } }) });
  await submit();
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).not.toHaveProperty("guest_chart_id");
});

test('verification code is sent in JSON rather than request URL',async()=>{
  global.fetch.mockResolvedValue({ok:true,json:async()=>({access_token:'jwt'})});
  await verifyCode('123456','new@example.com','Abcdef1!');
  const [url,options]=global.fetch.mock.calls[0];expect(url).not.toContain('123456');expect(url).not.toContain('?');
  expect(JSON.parse(options.body).code).toBe('123456');
});

test('recovery requests never add token to URL, headers or browser storage',async()=>{
  global.fetch.mockResolvedValue({ok:true,json:async()=>({message:'OK'})});
  await requestPasswordReset('owner@example.com');await resetPassword('x'.repeat(43),'Abcdef1!','Abcdef1!');
  for(const [url,options] of global.fetch.mock.calls){expect(url).not.toContain('owner@example.com');expect(url).not.toContain('x'.repeat(43));expect(options.referrerPolicy).toBe('no-referrer');expect(options.cache).toBe('no-store');}
  expect(localStorage.getItem('access_token')).toBeNull();expect(localStorage.getItem('session_token')).toBe(guestToken);
});

test('429 exposes Retry-After to recovery UI without unhandled response data',async()=>{
  global.fetch.mockResolvedValue({ok:false,status:429,headers:{get:()=> '60'},json:async()=>({detail:'Слишком много запросов. Попробуйте позже.'})});
  await expect(requestPasswordReset('owner@example.com')).rejects.toMatchObject({retryAfter:60,message:'Слишком много запросов. Попробуйте позже.'});
});

describe("auth network, non-JSON and code handling", () => {
  const NETWORK = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
  const UNEXPECTED = "Сервер ответил неожиданно. Обновите страницу и попробуйте ещё раз.";
  const html = status => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => { throw new SyntaxError("Unexpected token '<'"); } });
  const calls = [
    ["requestRegister", () => requestRegister("a@example.com", "test-password-only")],
    ["verifyCode", () => verifyCode("123456", "a@example.com", "test-password-only")],
    ["login", () => login("a@example.com", "test-password-only")],
    ["getMe", () => getMe("jwt")],
  ];
  test.each(calls)("%s turns a network failure into Russian text", async (_, call) => {
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(call()).rejects.toThrow(NETWORK);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  test.each(calls)("%s turns HTML in success and error answers into Russian text", async (_, call) => {
    global.fetch.mockResolvedValueOnce(html(200));
    await expect(call()).rejects.toThrow(UNEXPECTED);
    global.fetch.mockResolvedValueOnce(html(502));
    await expect(call()).rejects.toThrow(UNEXPECTED);
    expect(localStorage.getItem("access_token")).toBeNull();
  });
  test("a rate-limited HTML answer keeps Retry-After", async () => {
    global.fetch.mockResolvedValue({ ...html(429), headers: { get: () => "30" } });
    await expect(login("a@example.com", "test-password-only")).rejects.toMatchObject({ message: UNEXPECTED, retryAfter: 30 });
  });
  test("emoji prefix of a registration detail is removed", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, headers: { get: () => null },
      json: async () => ({ detail: "❌ Пользователь с таким email уже зарегистрирован. Попробуйте войти." }) });
    await expect(requestRegister("a@example.com", "test-password-only")).rejects.toThrow(/^Пользователь с таким email/);
  });
  test("verification code is sent without spaces", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: "jwt" }) });
    await verifyCode(" 123 456 ", "a@example.com", "test-password-only");
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).code).toBe("123456");
  });
});
