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
  expect(localStorage.getItem("session_token")).toBeNull();
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
