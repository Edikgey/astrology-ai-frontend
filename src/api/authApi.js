import {analyticsHeaders, productAnalytics} from '../analytics/productAnalytics';
import { API_URL } from "../config/api";
import { apiFetch, stripLeadingEmoji, UNEXPECTED_RESPONSE_TEXT } from "./apiError";

const BASE_URL = API_URL;

function authError(message, response) {
  const error = new Error(message);
  const retry = Number(response.headers?.get?.('Retry-After'));
  error.retryAfter = response.status === 429 && Number.isFinite(retry) ? Math.min(86400, Math.max(1, retry)) : 0;
  return error;
}

// Тело ответа: не JSON (например, HTML вместо API) — понятный текст, а не «Unexpected token '<'».
async function readAuthBody(response) {
  const data = await response.json().catch(() => null);
  if (data !== null) return data;
  if (response.ok) throw new Error(UNEXPECTED_RESPONSE_TEXT);
  return { detail: UNEXPECTED_RESPONSE_TEXT };
}

const detailText = (detail, fallback) => Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") :
  (typeof detail === "string" ? stripLeadingEmoji(detail) : detail) || fallback;

// Вспомогательная функция получения session_token
function getSessionToken() {
  let token = localStorage.getItem("session_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("session_token", token);
  }
  return token;
}

/**
 * Запрашивает отправку кода подтверждения на email и пароль
 */
export async function requestRegister(email, password, confirmation) {
  productAnalytics.emit('registration_started', {method: 'email'});

  const response = await apiFetch(`${BASE_URL}/auth/request-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, ...(confirmation !== undefined ? { password_confirmation: confirmation } : {}) }),
  });

  const data = await readAuthBody(response);
  if (!response.ok) {
    const errorMessage = detailText(data.detail, "Ошибка регистрации");
    throw authError(errorMessage, response);
  }
  return data;
}

/**
 * Подтверждает код и завершает регистрацию (возвращает токен)
 */
export async function verifyCode(code, email, password, guestChart = null, confirmation) {
  const sessionToken = guestChart?.sessionToken || getSessionToken();

  const response = await apiFetch(`${BASE_URL}/auth/verify-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", ...analyticsHeaders(),
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ email, password, code: String(code).replace(/\s+/g, ""), ...(confirmation !== undefined ? { password_confirmation: confirmation } : {}), ...(guestChart ? { guest_chart_id: Number(guestChart.chartId) } : {}) }),
  });

  const data = await readAuthBody(response);
  if (!response.ok) {
    const errorMessage = detailText(data.detail, "Ошибка регистрации");
    throw authError(errorMessage, response);
  }

  // Keep guest access when no transfer occurred (including a full account).
  localStorage.setItem("access_token", data.access_token);
  return data;
}

/**
 * Логин по email и паролю
 */
export async function login(email, password, guestChart = null) {
  const sessionToken = guestChart?.sessionToken || getSessionToken();

  const response = await apiFetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", ...analyticsHeaders(),
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ email, password, ...(guestChart ? { guest_chart_id: Number(guestChart.chartId) } : {}) }),
  });

  const data = await readAuthBody(response);
  if (!response.ok) {
    const errorMessage = detailText(data.detail, "Ошибка входа");
    throw authError(errorMessage, response);
  }

  // Retain the token: other guest charts must not be migrated or lost here.
  localStorage.setItem("access_token", data.access_token);
  return data;
}

/**
 * Получение текущего пользователя по access_token
 */
export async function getMe(token) {
  const response = await apiFetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", ...analyticsHeaders(),
    },
  });

  const data = await readAuthBody(response);
  if (!response.ok) {
    throw new Error(detailText(data.detail, "Ошибка получения пользователя"));
  }
  return {
    id: data.id,
    email: data.email,
    photoURL: data.photoURL || null,
  };
}

// Google ID token stays in memory and is exchanged only for our application JWT.
export async function googleLogin(credential, nonce, guestChart = null, password) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...analyticsHeaders(), ...(guestChart ? { 'X-Session-Token': guestChart.sessionToken } : {}) },
      body: JSON.stringify({ credential, nonce, ...(password ? { password } : {}),
        ...(guestChart ? { guest_chart_id: Number(guestChart.chartId) } : {}) }),
    });
  } catch { throw new Error('Не удалось связаться с сервером. Повторите вход Google.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.detail;
    const error = new Error(response.status >= 500 ? 'Вход Google временно недоступен. Попробуйте снова или войдите по email.' :
      typeof detail === 'string' ? detail : detail?.message || 'Не удалось подтвердить вход Google. Попробуйте снова.');
    error.code = typeof detail?.code === 'string' ? detail.code : '';
    throw error;
  }
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Сервер не подтвердил вход. Повторите попытку.');
  return data;
}

async function recoveryRequest(endpoint, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${BASE_URL}/auth/${endpoint}`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: {'Content-Type': 'application/json', ...analyticsHeaders()}, body: JSON.stringify(body), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail;
      throw authError(Array.isArray(detail) ? detail.map(e => e.msg).join(' ') :
        typeof detail === 'string' ? detail : 'Не удалось выполнить запрос. Попробуйте позже.', response);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('Не удалось связаться с сервером. Попробуйте ещё раз.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export const requestPasswordReset = email => recoveryRequest('request-password-reset', {email});
export const resetPassword = (token, password, passwordConfirmation) => recoveryRequest('reset-password', {
  token, password, password_confirmation: passwordConfirmation,
});
