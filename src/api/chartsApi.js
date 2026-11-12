import {analyticsHeaders} from '../analytics/productAnalytics';
import { API_URL } from "../config/api";
import { apiFetch, errorFromResponse, readJson } from "./apiError";

export async function chartRequest(path, { method = "GET", signal, authenticated = false, guestSessionToken } = {}) {
  const headers = {...analyticsHeaders()};
  const jwt = localStorage.getItem("access_token");
  if (guestSessionToken && !authenticated) {
    headers["X-Session-Token"] = guestSessionToken;
  } else if (jwt && jwt !== "null") {
    headers.Authorization = `Bearer ${jwt}`;
  } else if (!authenticated) {
    const sessionToken = localStorage.getItem("session_token");
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
  }
  const response = await apiFetch(`${API_URL}${path}`, { method, headers, signal });
  if (!response.ok) {
    throw await errorFromResponse(response, response.status === 404
      ? "Карта не найдена или недоступна."
      : "Не удалось выполнить запрос. Попробуйте ещё раз.");
  }
  return response.status === 204 ? null : readJson(response);
}
