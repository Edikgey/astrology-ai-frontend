import {analyticsHeaders} from '../analytics/productAnalytics';
import { API_URL } from "../config/api";
import { apiError, apiFetch, checkoutNetworkError, readJson } from "./apiError";
import { productRequest } from "./checkoutProduct";

export async function lavaRequest(action, token, product = "premium_month") {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const extra = action === "checkout" ? productRequest(product) : { headers: {} };
  const response = await apiFetch(`${API_URL}/payments/lava/${action}`, {
    method: "POST", headers: { ...analyticsHeaders(), ...extra.headers, Authorization: `Bearer ${token}` },
    ...(extra.body ? { body: extra.body } : {}),
  }).catch(error => { throw action === "checkout" ? checkoutNetworkError(error) : error; });
  // The status first: an error answer without JSON (HTML of a proxy) reads like one with JSON and no detail.
  const data = response.ok ? await readJson(response) : await response.json().catch(() => undefined);
  if (!response.ok) throw apiError(response.status, data);
  return data;
}

export function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Некорректный адрес оплаты.");
  return url.href;
}
