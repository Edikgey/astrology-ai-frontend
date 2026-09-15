import { API_URL } from "../config/api";
import { apiError } from "./apiError";

export async function relationshipRequest(path = "", { method = "GET", body, signal } = {}) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_URL}/relationships${path}`, {
    method,
    signal,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token && token !== "null" ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw apiError(response.status, data, response.status === 404
      ? "Разбор отношений не найден или недоступен."
      : "Не удалось выполнить запрос. Попробуйте ещё раз.");
  }
  return response.status === 204 ? null : response.json();
}
