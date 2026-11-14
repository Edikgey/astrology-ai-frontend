import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BillingProvider } from "./BillingContext";
import { useAuth } from "./AuthContext";
import { API_URL } from "../config/api";
import { apiError } from "../api/apiError";
import UsageModal from "../components/UsageModal";
import {clarityAnalytics} from '../analytics/clarity';
import {productAnalytics} from '../analytics/productAnalytics';

const UsageContext = createContext({ usage: null, usageLoading: false, usageError: null,
  refreshUsage: async () => null, handleLimitError: () => false, openUpgrade: () => {}, noteOffer: () => {} });
export const useUsage = () => useContext(UsageContext);

export function UsageProvider({ children }) {
  const { user, token, loading } = useAuth();
  const authenticated = Boolean(user && token && !loading);
  const key = authenticated ? `${user.id}:${token}` : "guest";
  const identity = useRef(key);
  identity.current = key;
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState(null);
  const [modalRecord, setModal] = useState(null);
  // Mask the old account synchronously, without remounting auth/pages or losing a draft.
  const usage = record?.key === key ? record.data : null;
  const usageLoading = status?.key === key ? status.loading : authenticated;
  const usageError = status?.key === key ? status.error : null;
  const modal = modalRecord?.key === key ? modalRecord : null;
  const request = useRef(null);
  const active = useRef(false);
  // Each offer moment is reported once per account session in this tab, however often it is shown again.
  const reported = useRef(new Set());
  const noteOffer = useCallback(moment => {
    if (reported.current.has(moment)) return;
    reported.current.add(moment);
    productAnalytics.emit('offer_moment_shown', { moment });
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!authenticated || !active.current || identity.current !== key || localStorage.getItem("access_token") !== token) return null;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus({ key, loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/account/usage`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw apiError(response.status, data);
      if (!controller.signal.aborted && active.current && identity.current === key && localStorage.getItem("access_token") === token) {
        setRecord({ key, data });
        clarityAnalytics.confirmPremium(data);
        // A fresh server plan also replaces any older plan in a limit response.
        setModal(previous => previous?.key === key ? { ...previous, plan: data.plan } : null);
        return data;
      }
    } catch (error) {
      if (!controller.signal.aborted && active.current && identity.current === key) {
        setRecord(null);
        setStatus({ key, loading: false, error });
      }
    } finally {
      if (!controller.signal.aborted && active.current && identity.current === key) {
        setStatus(previous => ({ ...previous, key, loading: false }));
      }
    }
    return null; // A usage refresh failure must not undo a successful chart/chat action.
  }, [token, key, authenticated]);

  useEffect(() => {
    active.current = true;
    reported.current = new Set();
    setRecord(null);
    setModal(null);
    setStatus(null);
    refreshUsage();
    const onFocus = () => { if (document.visibilityState !== "hidden") refreshUsage(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active.current = false;
      request.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshUsage]);

  const handleLimitError = useCallback(error => {
    const code = (error?.code || error?.detail?.code || "").toLowerCase();
    if (!authenticated || !active.current || identity.current !== key || localStorage.getItem("access_token") !== token ||
        !["gpt_limit_reached", "chart_limit_reached", "gpt_period_invalid"].includes(code)) return false;
    setModal({ ...error.detail, key, plan: error.detail?.plan, codeNormalized: code,
      moment: code === "gpt_limit_reached" ? "question_limit" : code === "chart_limit_reached" ? "chart_limit" : undefined });
    refreshUsage();
    return true;
  }, [token, key, authenticated, refreshUsage]);
  // The argument is a moment name or "pack"; anything else (a click event) opens the plain offer.
  const openUpgrade = arg => {
    if (usage?.plan === "free") setModal({ key, plan: "free", moment: arg === "last_free_question" ? arg : undefined });
    else if (usage?.plan === "premium" && arg === "pack") setModal({ key, plan: "premium" });
  };

  return <UsageContext.Provider value={{ usage, usageLoading, usageError, refreshUsage, handleLimitError, openUpgrade, noteOffer }}>
    <BillingProvider refreshUsage={refreshUsage} usage={usage}>
    {children}
    {modal && <UsageModal state={modal} usage={usage} noteOffer={noteOffer} onClose={() => setModal(null)} />}
    </BillingProvider>
  </UsageContext.Provider>;
}
