import {reportSiteError} from "../analytics/reporting";

export const NETWORK_ERROR_TEXT = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
export const UNEXPECTED_RESPONSE_TEXT = "Сервер ответил неожиданно. Обновите страницу и попробуйте ещё раз.";

// Backend texts may start with an emoji ("❌ Карта не найдена").
export const stripLeadingEmoji = text => text.replace(/^[\s\p{Extended_Pictographic}️‍]+/u, "").trim();

// fetch rejects with TypeError when there is no connection; an abort must stay an abort.
export async function apiFetch(url, options) {
  try {
    const response = await fetch(url, options);
    if (response.status >= 500) reportSiteError("request");
    return response;
  } catch (error) {
    if (error instanceof TypeError) reportSiteError("request");
    throw error instanceof TypeError ? new Error(NETWORK_ERROR_TEXT) : error;
  }
}

// HTML (or any non-JSON body) where the API answer is expected.
export async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw error instanceof SyntaxError ? new Error(UNEXPECTED_RESPONSE_TEXT) : error;
  }
}

// Keep the backend's structured detail; callers decide how to present limits.
// A string detail is shown only when it is Russian text; preferFallback lets a caller
// with its own status hints (chat) win over any string detail.
export function apiError(status, data, fallback = "Не удалось выполнить запрос. Попробуйте ещё раз.", preferFallback = false) {
  const detail = data?.detail;
  const text = typeof detail === "string" ? stripLeadingEmoji(detail) : "";
  const error = new Error(status === 401 ? "Сессия истекла. Войдите снова." :
    typeof detail === "string" ? (!preferFallback && /[а-яё]/i.test(text) ? text : fallback) : detail?.message || fallback);
  error.status = status;
  error.detail = detail;
  error.code = typeof detail?.code === "string" ? detail.code.toLowerCase() : "";
  return error;
}

// Error for a !ok response; an unreadable body is reported as an unexpected answer.
export async function errorFromResponse(response, fallback, preferFallback = false) {
  let data;
  try { data = await response.json(); } catch { /* unreadable body */ }
  return apiError(response.status, data, data === undefined && !preferFallback ? UNEXPECTED_RESPONSE_TEXT : fallback, preferFallback);
}

// Text for a failure caught around a stream/JSON read.
export const errorText = error => error instanceof SyntaxError ? UNEXPECTED_RESPONSE_TEXT : error.message;
