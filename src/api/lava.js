import {analyticsHeaders} from '../analytics/productAnalytics';
import { API_URL } from "../config/api";
import { apiError, apiFetch, readJson } from "./apiError";
import { productRequest } from "./checkoutProduct";

export async function lavaRequest(action, token, product = "premium_month") {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const extra = action === "checkout" ? productRequest(product) : { headers: {} };
  const response = await apiFetch(`${API_URL}/payments/lava/${action}`, {
    method: "POST", headers: { ...analyticsHeaders(), ...extra.headers, Authorization: `Bearer ${token}` },
    ...(extra.body ? { body: extra.body } : {}),
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(response.status, data);
  return data;
}

export function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Некорректный адрес оплаты.");
  return url.href;
}
