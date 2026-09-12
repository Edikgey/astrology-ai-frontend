import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { billingRequest, getPaddle, onPaddleEvent, paddleConfigured, PREMIUM_PRICE_ID } from "../api/paddle";

const BillingContext = createContext({ configured: false, busy: false, checkoutVisible: false });
export const useBilling = () => useContext(BillingContext);

export function BillingProvider({ children, refreshUsage }) {
  const { user, token, loading } = useAuth();
  const identity = `${user?.id || "guest"}:${token || ""}`;
  const current = useRef(identity);
  current.current = identity;
  const active = useRef(false);
  const inFlight = useRef(false);
  const checkoutRef = useRef(null);
  const timer = useRef(null);
  const refresh = useRef(refreshUsage);
  refresh.current = refreshUsage;
  const [busy, setBusy] = useState(false);
  const [checkoutVisible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    active.current = true;
    setBusy(false); setVisible(false); setError(""); setMessage(""); inFlight.current = false;
    const valid = () => active.current && current.current === identity && localStorage.getItem("access_token") === token;
    const poll = async attempt => {
      if (!valid()) return;
      const usage = await refresh.current();
      if (!valid()) return;
      if (usage?.plan === "premium") { setMessage("Premium активирован."); return; }
      if (attempt < 20) timer.current = setTimeout(() => poll(attempt + 1), 3000);
      else setMessage("Подтверждение оплаты ещё обрабатывается. Обновите лимиты чуть позже.");
    };
    const unsubscribe = onPaddleEvent(event => {
      if (!valid() || !checkoutRef.current) return;
      if (event.name === "checkout.completed") {
        setMessage("Оплата получена. Ожидаем подтверждение Premium от сервера…");
        clearTimeout(timer.current); poll(0);
      }
      if (event.name === "checkout.closed") {
        setVisible(false); setBusy(false); inFlight.current = false;
        checkoutRef.current = null;
        refresh.current();
      }
      if (event.name === "checkout.error") setError("Paddle не смог завершить оплату. Проверьте данные в checkout.");
    });
    return () => {
      active.current = false; unsubscribe(); clearTimeout(timer.current);
      checkoutRef.current?.Checkout.close(); checkoutRef.current = null;
    };
  }, [identity, token]);

  const startCheckout = async () => {
    if (inFlight.current || !user || !token || loading || !paddleConfigured) return;
    const origin = identity;
    const valid = () => active.current && current.current === origin && localStorage.getItem("access_token") === token;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const paddle = await getPaddle();
      if (!valid()) return;
      const result = await billingRequest("checkout", token);
      if (!valid()) return;
      if (result.price_id !== PREMIUM_PRICE_ID || !/^txn_[a-z0-9]{26}$/.test(result.transaction_id || "")) {
        throw new Error("Конфигурация оплаты не совпадает. Обратитесь в поддержку.");
      }
      checkoutRef.current = paddle;
      setVisible(true);
      // Native modal dialogs occupy the top layer; hide ours before Paddle's overlay.
      document.querySelector("dialog.usage-modal[open]")?.close();
      paddle.Checkout.open({ transactionId: result.transaction_id,
        ...(user.email ? { customer: { email: user.email } } : {}),
        settings: { displayMode: "overlay", allowLogout: false },
      });
    } catch (err) {
      if (valid()) {
        setError(err.message || "Не удалось открыть оплату."); setVisible(false);
        setBusy(false); inFlight.current = false; checkoutRef.current = null;
      }
    }
  };

  const manageSubscription = async () => {
    if (inFlight.current || !user || !token || loading) return;
    const origin = identity;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await billingRequest("portal", token);
      if (!active.current || current.current !== origin || localStorage.getItem("access_token") !== token) { tab?.close(); return; }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".paddle.com")) throw new Error("Некорректный адрес Paddle Portal.");
      if (!tab) throw new Error("Разрешите всплывающие окна и попробуйте снова.");
      tab.location.href = url.href;
    } catch (err) {
      tab?.close();
      if (active.current && current.current === origin) setError(err.message || "Не удалось открыть управление подпиской.");
    } finally {
      if (active.current && current.current === origin) { setBusy(false); inFlight.current = false; }
    }
  };

  return <BillingContext.Provider value={{ configured: paddleConfigured, busy, checkoutVisible,
    message, error, startCheckout, manageSubscription }}>{children}</BillingContext.Provider>;
}
