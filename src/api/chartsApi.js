import { API_URL } from "../config/api";
import { apiError } from "./apiError";

export async function chartRequest(path, { method = "GET", signal, authenticated = false, guestSessionToken } = {}) {
  const headers = {};
  const jwt = localStorage.getItem("access_token");
  if (guestSessionToken && !authenticated) {
    headers["X-Session-Token"] = guestSessionToken;
  } else if (jwt && jwt !== "null") {
    headers.Authorization = `Bearer ${jwt}`;
  } else if (!authenticated) {
    const sessionToken = localStorage.getItem("session_token");
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
  }
  const response = await fetch(`${API_URL}${path}`, { method, headers, signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw apiError(response.status, data, response.status === 404
      ? "Карта не найдена или недоступна."
      : "Не удалось выполнить запрос. Попробуйте ещё раз.");
  }
  return response.status === 204 ? null : response.json();
}
