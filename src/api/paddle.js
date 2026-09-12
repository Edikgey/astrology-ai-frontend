import { initializePaddle } from "@paddle/paddle-js";
import { API_URL } from "../config/api";
import { apiError } from "./apiError";

export const PREMIUM_PRICE_ID = process.env.REACT_APP_PADDLE_PREMIUM_PRICE_ID;
const clientToken = process.env.REACT_APP_PADDLE_CLIENT_TOKEN;
export const paddleConfigured = Boolean(clientToken?.startsWith("test_") && /^pri_[a-z0-9]{26}$/.test(PREMIUM_PRICE_ID || ""));
let instance;
const listeners = new Set();
export function onPaddleEvent(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
export function getPaddle() {
  if (!paddleConfigured) return Promise.reject(new Error("Оплата пока не настроена."));
  if (!instance) {
    instance = initializePaddle({ environment: "sandbox", token: clientToken,
      eventCallback: event => listeners.forEach(callback => callback(event)),
    }).then(paddle => {
      if (!paddle) throw new Error("Не удалось загрузить Paddle Checkout.");
      return paddle;
    }).catch(error => { instance = null; throw error; });
  }
  return instance;
}

export async function billingRequest(path, token) {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const response = await fetch(`${API_URL}/payments/paddle/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw apiError(response.status, data);
  return data;
}
