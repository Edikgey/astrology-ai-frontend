import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import "./AuthorizationPage.css";

const AuthorizationPage = () => {
  const { user, login, registerEmail, verifyRegistration } = useAuth();
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

  return (
    <div className="auth-container">
      <img src="img/logo/Frame6.png" alt="Logo" className="logo-img" />
      <h2 className="auth-title">Войдите в свою учетную запись</h2>

      <button className="auth-button-shadow auth-google-button">Continue with Google</button>

      <div className="auth-divider">
        <span>Или войти с помощью электронной почты</span>
      </div>

      <form onSubmit={step === "login" ? handleLogin : handleRegister} className="auth-form">
        <label className="auth-label">Email</label>
        <input
          type="email"
          placeholder="example@yandex.ru"
          className="auth-input auth-button-shadow"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="auth-label">Password</label>
        <input
          type="password"
          placeholder="******"
          className="auth-input auth-button-shadow"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {step === "register" && isCodeSent && (
          <input
            type="text"
            placeholder="Код из почты"
            className="auth-input auth-button-shadow"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        )}
        <button type="submit" disabled={busy} className="auth-submit auth-button-shadow">
          {step === "login" ? "Войти в Аккаунт" : isCodeSent ? "Завершить регистрацию" : "Получить код"}
        </button>
      </form>

      <div className="auth-divider">
        <span>или</span>
      </div>

      <div className="auth-secondary">
        <button
          className="auth-switch-button auth-button-shadow"
          disabled={busy}
          onClick={() => {
            resetAll();
            setStep(step === "login" ? "register" : "login");
          }}
        >
          {step === "login" ? "Зарегистрироваться" : "Войти в аккаунт"}
        </button>
      </div>

      {(error || message) && (
        <div className={`auth-message ${error ? "error" : "success"}`}>
          {error && <p>{error}</p>}
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
};

export default AuthorizationPage;
