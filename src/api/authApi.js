import { API_URL } from "../config/api";

const BASE_URL = API_URL;

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
export async function requestRegister(email, password) {

  const response = await fetch(`${BASE_URL}/auth/request-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(", ")
      : data.detail || "Ошибка регистрации";
    throw new Error(errorMessage);
  }
  return data;
}

/**
 * Подтверждает код и завершает регистрацию (возвращает токен)
 */
export async function verifyCode(code, email, password, guestChart = null) {
  const sessionToken = guestChart?.sessionToken || getSessionToken();

  const response = await fetch(`${BASE_URL}/auth/verify-code?code=${code}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ email, password, ...(guestChart ? { guest_chart_id: Number(guestChart.chartId) } : {}) }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(", ")
      : data.detail || "Ошибка регистрации";
    throw new Error(errorMessage);
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

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ email, password, ...(guestChart ? { guest_chart_id: Number(guestChart.chartId) } : {}) }),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join(", ")
      : data.detail || "Ошибка входа";
    throw new Error(errorMessage);
  }

  // Retain the token: other guest charts must not be migrated or lost here.
  localStorage.setItem("access_token", data.access_token);
  return data;
}

/**
 * Получение текущего пользователя по access_token
 */
export async function getMe(token) {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Ошибка получения пользователя");
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
      headers: { 'Content-Type': 'application/json', ...(guestChart ? { 'X-Session-Token': guestChart.sessionToken } : {}) },
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
