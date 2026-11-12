import {productAnalytics} from '../analytics/productAnalytics';
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from "react";
import {clarityAnalytics} from '../analytics/clarity';
import {
  requestRegister,
  verifyCode,
  login,
  getMe,
  googleLogin,
} from "../api/authApi";

const AuthContext = createContext();

// Not measured: the same bound as the feedback GET; revisit with the p99 of GET /auth/me (DESIGN §3.1).
const CHECK_TIMEOUT_MS = 15000;

// Another tab may leave "" or "null" behind; both mean "no token".
const storedToken = () => {
  const value = localStorage.getItem("access_token");
  return value && value !== "null" && value !== "undefined" ? value : null;
};

// FE-LOCAL-DATA: birth data earlier versions left in the browser; nothing reads it.
const RETIRED_KEYS = ["tempUserData", "natalChart"];
const forget = (keys) => keys.forEach((key) => localStorage.removeItem(key));

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(storedToken);
  const [loading, setLoading] = useState(Boolean(token));
  // A failed check keeps the token and loading=true: identity is unconfirmed, the person is not signed out.
  const [authError, setAuthError] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [signedOutReason, setSignedOutReason] = useState(null); // 'expired' | 'elsewhere' | null
  const [activeGuestChart, setActiveGuestChart] = useState(null);
  const current = useRef({ token, user });
  current.current = { token, user };
  const inFlight = useRef(false);

  useEffect(() => forget(RETIRED_KEYS), []); // once per page load; repeating it is harmless

  const adoptToken = useCallback((next, reason = null) => {
    inFlight.current = false;
    setAuthChecking(false);
    setAuthError(false);
    setSignedOutReason(reason);
    setUser(null);
    setToken(next);
    setLoading(Boolean(next));
    setAttempt((value) => value + 1); // re-checks even if a new sign-in returned the same token
  }, []);

  const signOut = useCallback((reason) => {
    productAnalytics.reset();
    clarityAnalytics.clearJourney();
    localStorage.removeItem("access_token");
    // The last chart built on this device belongs to the person leaving.
    forget(["chart_id", ...RETIRED_KEYS]);
    adoptToken(null, reason);
  }, [adoptToken]);

  // The shared storage is the truth between tabs; this tab follows it without writing to it.
  const syncWithStorage = useCallback(() => {
    const stored = storedToken();
    if (stored === current.current.token) return;
    if (current.current.user) {
      productAnalytics.reset();
      clarityAnalytics.clearJourney();
    }
    adoptToken(stored, stored ? null : 'elsewhere');
  }, [adoptToken]);

  useEffect(() => {
    if (!token) return undefined;
    let settled = false;
    const controller = new AbortController();
    const finish = (outcome, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller.abort();
      inFlight.current = false;
      setAuthChecking(false);
      // An answer for a token another tab has already replaced is not applied and erases nothing.
      if (storedToken() !== token) { syncWithStorage(); return; }
      if (outcome === 'refused') { signOut('expired'); return; }
      if (outcome === 'ok') {
        setUser(data);
        setAuthError(false);
        setLoading(false);
      } else {
        setUser(null);
        setAuthError(true);
      }
    };
    const timer = setTimeout(() => finish('failed'), CHECK_TIMEOUT_MS);
    inFlight.current = true;
    setAuthChecking(true);
    getMe(token, controller.signal)
      .then((data) => finish(data?.id == null ? 'failed' : 'ok', data))
      .catch((error) => finish(error?.status === 401 || error?.status === 404 ? 'refused' : 'failed'));
    return () => { settled = true; clearTimeout(timer); controller.abort(); };
  }, [token, attempt, signOut, syncWithStorage]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") syncWithStorage(); };
    window.addEventListener("storage", syncWithStorage);
    window.addEventListener("pageshow", syncWithStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", syncWithStorage);
      window.removeEventListener("pageshow", syncWithStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncWithStorage]);

  // Manual only: no automatic retries.
  const retryAuth = useCallback(() => {
    if (!current.current.token || inFlight.current) return;
    inFlight.current = true;
    setAuthChecking(true);
    setAttempt((value) => value + 1);
  }, []);

  const signIn = (data) => {
    localStorage.setItem("access_token", data.access_token);
    adoptToken(data.access_token);
    return data;
  };

  const loginUser = async (email, password, guestChart) => signIn(await login(email, password, guestChart));

  const registerEmail = async (email, password, confirmation) => {
    return await requestRegister(email, password, confirmation);
  };

  const loginGoogle = async (credential, nonce, guestChart, password) =>
    signIn(await googleLogin(credential, nonce, guestChart, password));

  const verifyRegistration = async (code, email, password, guestChart, confirmation) =>
    signIn(await verifyCode(code, email, password, guestChart, confirmation));

  const logout = () => signOut(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        authChecking,
        retryAuth,
        signedOutReason,
        activeGuestChart,
        setActiveGuestChart,
        login: loginUser,
        loginGoogle,
        logout,
        registerEmail,
        verifyRegistration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
