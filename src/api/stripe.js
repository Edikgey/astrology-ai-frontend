import {analyticsHeaders} from '../analytics/productAnalytics';
import { loadStripe } from "@stripe/stripe-js";
import { API_URL } from "../config/api";
import { apiError } from "./apiError";

const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
export const stripeConfigured = Boolean(key?.startsWith("pk_live_"));
let instance;
export function getStripe() {
  if (!stripeConfigured) throw new Error("Оплата пока не настроена.");
  if (!instance) instance = loadStripe(key).then(result => {
    if (!result) throw new Error("Не удалось загрузить оплату.");
    return result;
  }).catch(error => { instance = null; throw error; });
  return instance;
}
export async function billingRequest(path, token) {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const response = await fetch(`${API_URL}/payments/stripe/${path}`, {
    method: "POST", headers: { ...analyticsHeaders(), Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw apiError(response.status, data);
  return data;
}
