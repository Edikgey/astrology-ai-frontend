import {productAnalytics} from '../analytics/productAnalytics';
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { billingRequest, getStripe, stripeConfigured, stripeSessionPrefix } from "../api/stripe";
import { lavaRequest, checkoutUrl } from "../api/lava";
import { canManageStripe } from '../utils/billingEligibility';
import { providersFor, packBalance } from '../utils/offers';
import { PACK_SIZE, PRODUCT_IDS } from '../config/plans';

import StripeCheckout from "../components/StripeCheckout";
import {clarityAnalytics,newAnalyticsFlow,trackEvent} from '../analytics/clarity';

const BillingContext = createContext({ configured: false, busy: false, checkoutVisible: false });
export const useBilling = () => useContext(BillingContext);

export function BillingProvider({ children, refreshUsage, usage }) {
  const { user, token, loading } = useAuth();
  const identity = `${user?.id || "guest"}:${token || ""}`;
  const current = useRef(identity);
  current.current = identity;
  const active = useRef(false);
  const inFlight = useRef(false);
  const [checkout, setCheckout] = useState(null);
  const pollRef = useRef(null);
  // A pack in progress is confirmed by the pack balance, never by the plan: {baseline} is the balance before the payment.
  const pack = useRef(null);
  const timer = useRef(null);
  const refresh = useRef(refreshUsage);
  refresh.current = refreshUsage;
  const [busy, setBusy] = useState(false);
  const [checkoutVisible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feedbackProvider, setFeedbackProvider] = useState(null);

  useEffect(() => {
    active.current = true;
    setBusy(false); setVisible(false); setError(""); setMessage(""); inFlight.current = false;
    setFeedbackProvider(null); setCheckout(null); pack.current = null;
    const valid = () => active.current && current.current === identity && localStorage.getItem("access_token") === token;
    const poll = async attempt => {
      if (!valid()) return;
      const usage = await refresh.current();
      if (!valid()) return;
      if (usage?.pack_pending === true && !pack.current) pack.current = { baseline: packBalance(usage) };
      if (pack.current) {
        if (usage && usage.pack_pending !== true && packBalance(usage) > pack.current.baseline) { setMessage(`Пакет добавлен: +${PACK_SIZE} вопросов.`); return; }
      } else if (usage?.plan === "premium") { setMessage(usage.payment_provider === "stripe" ? "Premium активирован." : "Premium подтверждён сервером. Проверьте выбранный способ оплаты в аккаунте."); return; }
      if (attempt < 20) timer.current = setTimeout(() => poll(attempt + 1), 3000);
      else setMessage("Подтверждение оплаты ещё обрабатывается. Обновите лимиты чуть позже.");
    };
    pollRef.current = poll;
    // Return status is navigation only. Only /account/usage can confirm access.
    if (token && new URLSearchParams(window.location.search).get("billing") === "lava") {
      setFeedbackProvider("lava");
      const returned = new URLSearchParams(window.location.search).get("status");
      if (returned === "failed" || returned === "cancelled") {
        setMessage("Оплата не завершена. Можно снова открыть Lava; доступность другого способа проверит сервер.");
        refresh.current();
      } else {
        setMessage("Ожидаем подтверждение оплаты от сервера…");
        poll(0);
      }
    }
    if (token && new URLSearchParams(window.location.search).get("billing") === "stripe") {
      setFeedbackProvider("stripe"); setMessage("Ожидаем подтверждение Premium от сервера…"); poll(0);
    }
    return () => {
      active.current = false; clearTimeout(timer.current); pollRef.current = null;
    };
  }, [identity, token]);

  const startLavaCheckout = async (product = "premium_month") => {
    if (!PRODUCT_IDS.includes(product)) product = "premium_month"; // onClick may hand over an event
    if (inFlight.current || !user || !token || loading || !providersFor(usage, product).lava) return;
    const analyticsFlow=newAnalyticsFlow();trackEvent('lava_selected',analyticsFlow);
    productAnalytics.emit('offer_option_selected', {option: product});
    pack.current = product === "question_pack" ? { baseline: packBalance(usage) } : null;
    setFeedbackProvider("lava"); setError(""); setMessage("");
    const origin = identity;
    const valid = () => active.current && current.current === origin && localStorage.getItem("access_token") === token;
    // Keep the current conversation/draft in its tab, as with the billing portal.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    if (!tab) { trackEvent('checkout_failed',analyticsFlow);setError("Разрешите всплывающие окна и попробуйте снова."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await lavaRequest("checkout", token, product);
      if (!valid()) { tab.close(); return; }
      tab.location.href = checkoutUrl(result.url);
      trackEvent('checkout_initiated',analyticsFlow);clarityAnalytics.beginCheckout(analyticsFlow);
      setMessage("Оплата открыта в новой вкладке. После оплаты обновите лимиты аккаунта.");
    } catch (err) {
      tab.close();
      if (valid()) {trackEvent('checkout_failed',analyticsFlow);setError(err.message || "Не удалось открыть оплату.");}
    } finally {
      if (valid()) { setBusy(false); inFlight.current = false; }
    }
  };

  const cancelLavaSubscription = async () => {
    if (inFlight.current || !user || !token || loading || usage?.payment_provider !== "lava") return;
    if (!window.confirm("Отключить продление подписки? Оплаченный доступ сохранится до даты, подтверждённой Lava.")) return;
    setFeedbackProvider("lava"); setMessage("");
    const origin = identity;
    const valid = () => active.current && current.current === origin && localStorage.getItem("access_token") === token;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await lavaRequest("cancel", token);
      if (!valid()) return;
      setMessage("Запрос на отмену продления отправлен. Ожидаем подтверждение Lava.");
      await refresh.current();
    } catch (err) {
      if (valid()) setError(err.message || "Не удалось запросить отмену.");
    } finally {
      if (valid()) { setBusy(false); inFlight.current = false; }
    }
  };

  const closeCheckout = useCallback(() => {
    setVisible(false); setCheckout(null); setBusy(false); inFlight.current = false;
    refresh.current();
  }, []);
  const checkoutComplete = useCallback(() => {
    if (!active.current || current.current !== identity || localStorage.getItem("access_token") !== token) return;
    setMessage(pack.current ? "Проверяем оплату пакета. Не оплачивайте повторно — обновите страницу через минуту." : "Оплата обрабатывается. Ожидаем подтверждение Premium от сервера…");
    clearTimeout(timer.current); pollRef.current?.(0);
    setVisible(false); setCheckout(null); setBusy(false); inFlight.current = false;
  }, [identity, token]);
  const startCheckout = async (product = "premium_month") => {
    if (!PRODUCT_IDS.includes(product)) product = "premium_month"; // onClick may hand over an event
    if (inFlight.current || !user || !token || loading || !stripeConfigured || !providersFor(usage, product).stripe) return;
    const analyticsFlow=newAnalyticsFlow();trackEvent('stripe_selected',analyticsFlow);
    productAnalytics.emit('offer_option_selected', {option: product});
    pack.current = product === "question_pack" ? { baseline: packBalance(usage) } : null;
    setFeedbackProvider("stripe");
    const origin = identity;
    const valid = () => active.current && current.current === origin && localStorage.getItem("access_token") === token;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const stripe = await getStripe();
      if (!valid()) return;
      const result = await billingRequest("checkout", token, product);
      if (!valid()) return;
      if (!result.session_id?.startsWith(stripeSessionPrefix) || typeof result.client_secret !== "string" || !result.client_secret.startsWith(result.session_id + "_secret_")) {
        throw new Error("Не удалось подтвердить параметры оплаты.");
      }
      document.querySelector("dialog.usage-modal[open]")?.close();
      trackEvent('checkout_initiated',analyticsFlow);clarityAnalytics.beginCheckout(analyticsFlow);
      setCheckout({ stripe, clientSecret: result.client_secret, identity: origin, product }); setVisible(true); setBusy(false);
    } catch (err) {
      if (valid()) { trackEvent('checkout_failed',analyticsFlow);setError(err.message || "Не удалось открыть оплату."); setVisible(false); setBusy(false); inFlight.current = false; }
    }
  };

  const manageSubscription = async () => {
    if (inFlight.current || !user || !token || loading || !canManageStripe(usage)) return;
    setFeedbackProvider("stripe"); setMessage("");
    const origin = identity;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    if (!tab) { setError("Разрешите всплывающие окна и попробуйте снова."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await billingRequest("portal", token);
      if (!active.current || current.current !== origin || localStorage.getItem("access_token") !== token) { tab?.close(); return; }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com" || url.username || url.password || url.port) throw new Error("Некорректный адрес Stripe Portal.");
      tab.location.href = url.href;
      productAnalytics.emit('billing_portal_opened', {provider: 'stripe'});
      setMessage("Управление подпиской открыто в новой вкладке. После возвращения данные аккаунта обновятся.");
    } catch (err) {
      tab?.close();
      if (active.current && current.current === origin) setError(err.message || "Не удалось открыть управление подпиской.");
    } finally {
      if (active.current && current.current === origin) { setBusy(false); inFlight.current = false; }
    }
  };

  return <BillingContext.Provider value={{ configured: stripeConfigured && Boolean(usage?.stripe_checkout_available), busy, checkoutVisible,
    message, error, feedbackProvider, startCheckout, manageSubscription, startLavaCheckout, cancelLavaSubscription,
    lavaConfigured: Boolean(usage?.lava_checkout_available), stripeConfigured }}>{children}
    {checkoutVisible && checkout?.identity === identity && <StripeCheckout key={identity} product={checkout.product} freeBetaEnabled={usage?.free_beta_enabled === true} stripe={checkout.stripe} clientSecret={checkout.clientSecret} onComplete={checkoutComplete} onClose={closeCheckout} />}
  </BillingContext.Provider>;
}
