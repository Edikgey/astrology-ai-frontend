import { API_URL } from "../config/api";

export async function chartRequest(path, { method = "GET", signal, authenticated = false } = {}) {
  const headers = {};
  const jwt = localStorage.getItem("access_token");
  if (jwt && jwt !== "null") {
    headers.Authorization = `Bearer ${jwt}`;
  } else if (!authenticated) {
    const sessionToken = localStorage.getItem("session_token");
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
  }
  const response = await fetch(`${API_URL}${path}`, { method, headers, signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(
      response.status === 401 ? "Войдите в аккаунт, чтобы продолжить." :
      response.status === 404 ? "Карта не найдена или недоступна." :
      typeof data.detail === "string" ? data.detail : "Не удалось выполнить запрос. Попробуйте ещё раз."
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
