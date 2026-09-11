import { login, verifyCode } from "./authApi";

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
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ email: "a@example.com", password: "password", guest_chart_id: 7 });
  expect(global.fetch.mock.calls[0][1].headers["X-Session-Token"]).toBe(guestToken);
  expect(data).toEqual(result);
});

test.each(flows)("%s ordinary auth does not reuse a cached chart ID", async (_, submit) => {
  localStorage.setItem("chart_id", "999");
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: "jwt", guest_chart_migration: { status: "not_requested", chart_id: null } }) });
  await submit();
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).not.toHaveProperty("guest_chart_id");
});
