import { API_URL } from "../config/api";
import { apiError } from "./apiError";

export async function lavaRequest(action, token) {
  if (!token || localStorage.getItem("access_token") !== token) throw new Error("Войдите в аккаунт снова.");
  const response = await fetch(`${API_URL}/payments/lava/${action}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw apiError(response.status, data);
  return data;
}

export function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Некорректный адрес оплаты.");
  return url.href;
}
