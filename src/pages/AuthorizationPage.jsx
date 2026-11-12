import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import "./AuthorizationPage.css";
import GoogleSignIn from "../components/GoogleSignIn";
import PasswordRequirements from "../components/PasswordRequirements";
import { validNewPassword } from "../utils/passwordPolicy";
import { LANDING_RELATIONSHIP_INTENT, isLandingRelationshipIntent } from "./landingIntent";
import {newAnalyticsFlow,trackEvent} from '../analytics/clarity';
import {requestPasswordReset} from '../api/authApi';
import { useServiceConfig } from "../context/ServiceConfigContext";

// Only a path on this site: no other origin, no sign-in or reset page, and query and fragment are dropped,
// so neither a foreign address nor a token or code travels with it.
const safeReturnPath = value => {
  if (typeof value !== "string" || value[0] !== "/" || value[1] === "/" ||
    [...value].some(ch => ch === "\\" || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || /^\/(authorization|reset-password)(\/|$)/i.test(url.pathname)) return null;
    return url.pathname;
  } catch {
    return null;
  }
};

const AuthorizationPage = () => {
  const { user, login, loginGoogle, registerEmail, verifyRegistration } = useAuth();
  // Флаг беты показывает сервер; фронтенд только отображает его.
  const { freeBetaEnabled: beta } = useServiceConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const submitting = useRef(false);
  const completed = useRef(false);
  const [busy, setBusy] = useState(false);
  // Only an explicit transition from the open chart carries migration intent.
  // Router state survives reload, but ordinary auth links never inherit old IDs.
  const guestChart = location.state?.guestChart || null;
  const ordinaryReturn = safeReturnPath(location.state?.returnTo) || "/";

  const [step, setStep] = useState(['register','recover'].includes(location.state?.mode) ? location.state.mode : 'login');
  const recovery = step === 'recover';
  const [cooldown, setCooldown] = useState(0);
  const [verificationBlocked, setVerificationBlocked] = useState(false);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  const registrationFlow=useRef(null);
  useEffect(()=>{
    if(step==='register'){
      if(!registrationFlow.current)registrationFlow.current=newAnalyticsFlow();
      trackEvent('registration_started',registrationFlow.current);
    }
  },[step]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const passwordValid = validNewPassword(password);
  const confirmationValid = passwordConfirmation === password && passwordConfirmation.length > 0;
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
    if (guestChart) {
      const result = data.guest_chart_migration;
      const migrated = result?.status === "migrated" && Number(result.chart_id) === Number(guestChart.chartId);
      navigate(`/natal-chart-result/${guestChart.chartId}`, {
        replace: true,
        state: {
          ...(isLandingRelationshipIntent(guestChart.landingRelationshipIntent) ?
            { landingRelationshipIntent: LANDING_RELATIONSHIP_INTENT } : {}),
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
    if (cooldown && (!isCodeSent || verificationBlocked)) return;
    if (!passwordValid || !confirmationValid) {
      setError(!passwordValid ? "Пароль не соответствует указанным требованиям." : "Пароли не совпадают.");
      return;
    }
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
        await registerEmail(email, password, passwordConfirmation);
        setIsCodeSent(true);
        setCooldown(60);
        setMessage("Код отправлен на почту. Введите его ниже для завершения регистрации.");
      } else {
        if (!code.trim()) {
          setError("Введите код из почты");
          return;
        }
        const result=await verifyRegistration(code, email, password, guestChart, passwordConfirmation);
        trackEvent('registration_completed',registrationFlow.current);
        finishAuth(result);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
      if(err.retryAfter){setCooldown(err.retryAfter);setVerificationBlocked(isCodeSent);}
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    if (cooldown) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      finishAuth(await login(email, password, guestChart));
    } catch (err) {
      setError(extractErrorMessage(err));
      if(err.retryAfter)setCooldown(err.retryAfter);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const resetAll = () => {
    setCooldown(0);
    setVerificationBlocked(false);
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
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

  const handleRecovery = async e => {
    e.preventDefault();
    if(submitting.current || cooldown) return;
    submitting.current=true;setBusy(true);setError('');setMessage('');
    try {
      const result=await requestPasswordReset(email);
      setMessage(result.message);setCooldown(60);
    } catch(err) {setError(err.message);if(err.retryAfter)setCooldown(err.retryAfter);}
    finally {submitting.current=false;setBusy(false);}
  };

  const resendCode = async () => {
    if(submitting.current || cooldown || !passwordValid || !confirmationValid)return;
    submitting.current=true;setBusy(true);setError('');
    try {await registerEmail(email,password,passwordConfirmation);setCooldown(60);setMessage('Новый код отправлен на почту.');}
    catch(err){setError(err.message);if(err.retryAfter)setCooldown(err.retryAfter);}
    finally{submitting.current=false;setBusy(false);}
  };

  return (
    <div className="auth-page page">
      <aside className="auth-story"><p className="eyebrow">Ваше личное пространство</p><h2>Разговор,<br />к которому хочется<br /><span>вернуться.</span></h2>
        <p>Ваши карты, вопросы и открытия — вместе, в одном аккаунте.</p>
        <div className="auth-benefits"><p>01 <span>Сохранённая натальная карта</span></p><p>02 <span>AI, который помнит контекст</span></p><p>03 <span>История каждого разговора</span></p></div>
      </aside>
      <div className="auth-container card">
        <p className="eyebrow">Lunaria</p>
        <h1 className="auth-title">{recovery ? 'Восстановление пароля' : step === "login" ? "Рады видеть вас снова" : isCodeSent ? "Проверьте почту" : "Начните свой разговор"}</h1>
        <p className="auth-description">{recovery ? 'Укажите email аккаунта. Мы отправим ссылку для создания нового пароля.' : step === "login" ? "Войдите, чтобы продолжить с того, что важно для вас." : isCodeSent ? "Остался один шаг: введите код подтверждения." : beta ? "Бесплатный аккаунт: карты и AI-вопросы без лимита на время бета-теста." : "Бесплатный аккаунт: до 3 карт и 10 AI-вопросов за всё время."}</p>
        {guestChart && <p className="notice">После входа попробуем сохранить открытую карту в ваш аккаунт. Ваш вопрос останется с вами.</p>}
        {!recovery && <GoogleSignIn onSignIn={handleGoogle} disabled={busy} />}
        <form onSubmit={recovery ? handleRecovery : step === "login" ? handleLogin : handleRegister} className="auth-form" aria-busy={busy}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          {!recovery && <><label htmlFor="auth-password">Пароль</label>
          <input id="auth-password" type="password" autoComplete={step === "login" ? "current-password" : "new-password"} placeholder="Ваш пароль" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} required
            aria-describedby={step === "register" ? "password-requirements" : undefined}
            aria-invalid={step === "register" && password.length > 0 && !passwordValid} /></>}
          {step === "register" && <>
            <PasswordRequirements password={password} />
            <label htmlFor="auth-password-confirmation">Повторите пароль</label>
            <input id="auth-password-confirmation" type="password" autoComplete="new-password" value={passwordConfirmation}
              onChange={e => { setPasswordConfirmation(e.target.value); setError(""); }} required
              aria-describedby="password-confirmation-status" aria-invalid={passwordConfirmation.length > 0 && !confirmationValid} />
            <p id="password-confirmation-status" className={`password-confirmation ${confirmationValid ? "is-valid" : "is-unmet"}`} aria-live="polite">
              {passwordConfirmation ? (confirmationValid ? "Пароли совпадают." : "Пароли не совпадают.") : "Введите пароль ещё раз."}
            </p>
          </>}
          {step === "register" && isCodeSent && <><label htmlFor="auth-code">Код подтверждения</label><input id="auth-code" type="text" autoComplete="one-time-code" placeholder="Код из почты" value={code} onChange={e => setCode(e.target.value)} required /></>}
          {(error || message) && <div className="auth-message">{error && <p role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</div>}
          <button type="submit" disabled={busy || (cooldown>0 && (step!=='register' || !isCodeSent || verificationBlocked)) || (step === "register" && (!passwordValid || !confirmationValid))} className="auth-submit">{busy ? "Подождите..." : recovery ? 'Отправить ссылку' : step === "login" ? "Войти в аккаунт" : isCodeSent ? "Завершить регистрацию" : "Получить код"}</button>
        </form>
        {cooldown>0 && <p className="auth-retry" role="status">Повторный запрос через {cooldown} сек.</p>}
        {step==='register' && isCodeSent && <button type="button" className="auth-recovery-link" disabled={busy || cooldown>0 || !passwordValid || !confirmationValid} onClick={resendCode}>Отправить код повторно</button>}
        {step==='login' && <button type="button" className="auth-recovery-link" disabled={busy} onClick={()=>{resetAll();setCooldown(0);setStep('recover');}}>Забыли пароль?</button>}
        <div className="auth-secondary"><p>{recovery ? 'Вспомнили пароль?' : step === "login" ? "Ещё нет аккаунта?" : "Уже зарегистрированы?"}</p>
          <button className="auth-switch-button" disabled={busy} onClick={() => { resetAll(); setStep(step === "login" ? "register" : "login"); }}>{step === "login" ? "Зарегистрироваться" : "Войти в аккаунт"}</button>
        </div>
      </div>
    </div>
  );
};
export default AuthorizationPage;
