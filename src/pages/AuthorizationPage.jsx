import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./AuthorizationPage.css";

const AuthorizationPage = () => {
  const { user, login, registerEmail, verifyRegistration } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.removeItem("session_token");
      const redirectPath = localStorage.getItem("redirect_after_login") || "/";
      localStorage.removeItem("redirect_after_login");
      navigate(redirectPath);
    }
  }, [user, navigate]);

  const extractErrorMessage = (err) => {
    if (Array.isArray(err?.message?.detail)) {
      return err.message.detail.map((d) => d.msg).join(", ");
    }
    return err.message || "Что-то пошло не так.";
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const sessionToken = localStorage.getItem("session_token");

      if (!isCodeSent) {
        if (!email.trim() || !password.trim()) {
          setError("Введите email и пароль");
          return;
        }
        await registerEmail(email, password, sessionToken);
        setIsCodeSent(true);
        setMessage("Код отправлен на почту. Введите его ниже для завершения регистрации.");
      } else {
        if (!code.trim()) {
          setError("Введите код из почты");
          return;
        }
        await verifyRegistration(code, email, password, sessionToken);
        setMessage("Регистрация завершена и выполнен вход.");
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const sessionToken = localStorage.getItem("session_token");
      await login(email, password, sessionToken);
      setMessage("Вы успешно вошли.");
    } catch (err) {
      setError(extractErrorMessage(err));
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
        <button type="submit" className="auth-submit auth-button-shadow">
          {step === "login" ? "Войти в Аккаунт" : isCodeSent ? "Завершить регистрацию" : "Получить код"}
        </button>
      </form>

      <div className="auth-divider">
        <span>или</span>
      </div>

      <div className="auth-secondary">
        <button
          className="auth-switch-button auth-button-shadow"
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
