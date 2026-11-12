import {analyticsHeaders} from '../analytics/productAnalytics';
import { API_URL } from "../config/api";
import { apiFetch, errorFromResponse, readJson } from "./apiError";

export async function relationshipRequest(path = "", { method = "GET", body, signal } = {}) {
  const token = localStorage.getItem("access_token");
  const response = await apiFetch(`${API_URL}/relationships${path}`, {
    method,
    signal,
    headers: {
      ...analyticsHeaders(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token && token !== "null" ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    throw await errorFromResponse(response, response.status === 404
      ? "Разбор отношений не найден или недоступен."
      : "Не удалось выполнить запрос. Попробуйте ещё раз.");
  }
  return response.status === 204 ? null : readJson(response);
}
