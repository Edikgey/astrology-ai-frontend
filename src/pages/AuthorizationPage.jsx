import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import "./AuthorizationPage.css";
import GoogleSignIn from "../components/GoogleSignIn";

const AuthorizationPage = () => {
  const { user, login, loginGoogle, registerEmail, verifyRegistration } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const submitting = useRef(false);
  const completed = useRef(false);
  const [busy, setBusy] = useState(false);
  // Only an explicit transition from the open chart carries migration intent.
  // Router state survives reload, but ordinary auth links never inherit old IDs.
  const guestChart = location.state?.guestChart || null;
  const returnPath = location.state?.returnTo || localStorage.getItem("redirect_after_login") || localStorage.getItem("returnTo") || "/";
  const ordinaryReturn = returnPath.startsWith("/") && !returnPath.startsWith("//") && !returnPath.startsWith("/authorization") ? returnPath : "/";

  const [step, setStep] = useState(location.state?.mode === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);

  useEffect(() => {
    if (user && !submitting.current && !completed.current) {
      navigate(ordinaryReturn, { replace: true });
    }
  }, [user, navigate, ordinaryReturn]);

  const finishAuth = (data) => {
    completed.current = true;
    localStorage.removeItem("redirect_after_login");
    localStorage.removeItem("returnTo");
    if (guestChart) {
      const result = data.guest_chart_migration;
      const migrated = result?.status === "migrated" && Number(result.chart_id) === Number(guestChart.chartId);
      navigate(`/natal-chart-result/${guestChart.chartId}`, {
        replace: true,
        state: {
          chartAuth: {
            chartId: guestChart.chartId,
            status: migrated ? "migrated" : (result?.status === "migrated" ? "not_found" : result?.status || "not_requested"),
            sessionToken: migrated ? null : guestChart.sessionToken,
            pendingQuestion: guestChart.pendingQuestion || "",
          },
        },
      });
    } else {
      navigate(ordinaryReturn, { replace: true });
    }
  };

  const extractErrorMessage = (err) => {
    if (Array.isArray(err?.message?.detail)) {
      return err.message.detail.map((d) => d.msg).join(", ");
    }
    return err.message || "Что-то пошло не так.";
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!isCodeSent) {
        if (!email.trim() || !password.trim()) {
          setError("Введите email и пароль");
          return;
        }
        await registerEmail(email, password);
        setIsCodeSent(true);
        setMessage("Код отправлен на почту. Введите его ниже для завершения регистрации.");
      } else {
        if (!code.trim()) {
          setError("Введите код из почты");
          return;
        }
        finishAuth(await verifyRegistration(code, email, password, guestChart));
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      finishAuth(await login(email, password, guestChart));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const resetAll = () => {
    setEmail("");
    setPassword("");
    setCode("");
    setError("");
    setMessage("");
    setIsCodeSent(false);
  };

  const handleGoogle = async (credential, nonce, confirmationPassword) => {
    if (submitting.current) throw new Error("Дождитесь завершения текущего входа.");
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try { finishAuth(await loginGoogle(credential, nonce, guestChart, confirmationPassword)); }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <div className="auth-page page">
      <aside className="auth-story"><p className="eyebrow">Ваше личное пространство</p><h2>Разговор,<br />к которому хочется<br /><span>вернуться.</span></h2>
        <p>Ваши карты, вопросы и открытия — вместе, в одном аккаунте.</p>
        <div className="auth-benefits"><p>01 <span>Сохранённая натальная карта</span></p><p>02 <span>AI, который помнит контекст</span></p><p>03 <span>История каждого разговора</span></p></div>
      </aside>
      <div className="auth-container card">
        <p className="eyebrow">Lunaria</p>
        <h1 className="auth-title">{step === "login" ? "Рады видеть вас снова" : isCodeSent ? "Проверьте почту" : "Начните свой разговор"}</h1>
        <p className="auth-description">{step === "login" ? "Войдите, чтобы продолжить с того, что важно для вас." : isCodeSent ? "Остался один шаг: введите код подтверждения." : "Бесплатный аккаунт: до 3 карт и 10 AI-вопросов за всё время."}</p>
        {guestChart && <p className="notice">После входа попробуем сохранить открытую карту в ваш аккаунт. Ваш вопрос останется с вами.</p>}
        <GoogleSignIn onSignIn={handleGoogle} disabled={busy} />
        <form onSubmit={step === "login" ? handleLogin : handleRegister} className="auth-form" aria-busy={busy}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <label htmlFor="auth-password">Пароль</label>
          <input id="auth-password" type="password" autoComplete={step === "login" ? "current-password" : "new-password"} placeholder="Ваш пароль" value={password} onChange={e => setPassword(e.target.value)} required />
          {step === "register" && isCodeSent && <><label htmlFor="auth-code">Код подтверждения</label><input id="auth-code" type="text" autoComplete="one-time-code" placeholder="Код из почты" value={code} onChange={e => setCode(e.target.value)} required /></>}
          {(error || message) && <div className="auth-message">{error && <p role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</div>}
          <button type="submit" disabled={busy} className="auth-submit">{busy ? "Подождите..." : step === "login" ? "Войти в Аккаунт" : isCodeSent ? "Завершить регистрацию" : "Получить код"}</button>
        </form>
        <div className="auth-secondary"><p>{step === "login" ? "Ещё нет аккаунта?" : "Уже зарегистрированы?"}</p>
          <button className="auth-switch-button" disabled={busy} onClick={() => { resetAll(); setStep(step === "login" ? "register" : "login"); }}>{step === "login" ? "Зарегистрироваться" : "Войти в аккаунт"}</button>
        </div>
      </div>
    </div>
  );
};
export default AuthorizationPage;
