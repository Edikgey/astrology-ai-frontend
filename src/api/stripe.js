import {analyticsHeaders} from '../analytics/productAnalytics';
import { loadStripe } from "@stripe/stripe-js";
import { API_URL } from "../config/api";
import { apiError, apiFetch, checkoutNetworkError, readJson, STRIPE_UNCONFIGURED_TEXT } from "./apiError";
import { productRequest } from "./checkoutProduct";

const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
// A publishable key of one mode (live or test) opens only sessions of the same mode.
const mode = key?.startsWith("pk_live_") ? "live" : key?.startsWith("pk_test_") ? "test" : null;
export const stripeConfigured = mode !== null;
export const stripeSessionPrefix = mode ? `cs_${mode}_` : null;
let instance;
export function getStripe() {
  if (!stripeConfigured) throw new Error(STRIPE_UNCONFIGURED_TEXT);
  if (!instance) instance = loadStripe(key).then(result => {
    if (!result) throw new Error("Не удалось загрузить оплату.");
    return result;
  }).catch(error => { instance = null; throw error; });
  return instance;
}
export async function billingRequest(path, token, product = "premium_month") {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const extra = path === "checkout" ? productRequest(product) : { headers: {} };
  const response = await apiFetch(`${API_URL}/payments/stripe/${path}`, {
    method: "POST", headers: { ...analyticsHeaders(), ...extra.headers, Authorization: `Bearer ${token}` },
    ...(extra.body ? { body: extra.body } : {}),
  }).catch(error => { throw path === "checkout" ? checkoutNetworkError(error) : error; });
  // The status first: an error answer without JSON (HTML of a proxy) reads like one with JSON and no detail.
  const data = response.ok ? await readJson(response) : await response.json().catch(() => undefined);
  if (!response.ok) throw apiError(response.status, data);
  return data;
}
