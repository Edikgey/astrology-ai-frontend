import { API_URL } from "../config/api";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AskGptChat.css";

export const CHAT_INTRO = "Я уже посмотрел вашу карту. Могу помочь разобрать характер, отношения, карьеру или сильные стороны.";
const QUESTIONS = ["Какие у меня сильные стороны?", "Что у меня с отношениями?", "Какая карьера мне подходит?"];
const requestError = status => status === 401 ? "Сессия истекла. Войдите снова." :
  status === 403 || status === 404 ? "Чат этой карты недоступен для вашего аккаунта." :
  status === 409 ? "Запрос сейчас недоступен. Попробуйте позже." : "Не удалось выполнить запрос. Попробуйте ещё раз.";

// A keyed session isolates in-flight responses when the chart or user changes.
const AskGptForm = (props) => {
  const { user, loading: authLoading } = useAuth();
  const token = localStorage.getItem("access_token");
  const authenticated = Boolean(user && token && token !== "null" && !authLoading);
  return <ChatSession key={`${props.chartId}:${user?.id || "guest"}:${token || ""}:${props.unsaved || false}`}
    {...props} authenticated={authenticated} authLoading={authLoading} token={token} />;
};

const ChatSession = ({ chartId, authenticated, authLoading, token, unsaved = false, initialQuestion = "", onQuestionConsumed, guestSessionToken }) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [reload, setReload] = useState(0);
  const [gate, setGate] = useState(false);
  const dialog = useRef(null);
  const input = useRef(null);
  const sending = useRef(null);
  const navigate = useNavigate();
  const canChat = authenticated && !unsaved;

  useEffect(() => () => sending.current?.abort(), []);
  useEffect(() => { if (gate) dialog.current?.showModal(); }, [gate]);
  useEffect(() => {
    const controller = new AbortController();
    setMessages([]);
    setHistoryError("");
    setHistoryLoading(canChat);
    if (canChat && chartId) {
      (async () => {
        try {
          const response = await fetch(`${API_URL}/gpt-messages?chart_id=${chartId}`, {
            headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
          });
          if (!response.ok) throw new Error(requestError(response.status));
          const data = await response.json();
          if (!controller.signal.aborted) setMessages(data.map(msg => ({ user: msg.role === "user" ? "Вы" : "GPT", text: msg.content })));
        } catch (err) {
          if (!controller.signal.aborted) setHistoryError(err.message);
        } finally {
          if (!controller.signal.aborted) setHistoryLoading(false);
        }
      })();
    }
    return () => controller.abort();
  }, [canChat, chartId, token, reload]);

  const openGate = (pending = question) => { setQuestion(pending); setGate(true); };
  const startAuth = mode => {
    navigate("/authorization", { state: {
      mode, returnTo: `/natal-chart-result/${chartId}`,
      guestChart: { chartId: Number(chartId), sessionToken: guestSessionToken || localStorage.getItem("session_token"), pendingQuestion: question },
    } });
  };
  const sendQuestion = async () => {
    if (authLoading || unsaved) return;
    if (!authenticated) { openGate(); return; }
    if (sending.current || historyLoading || historyError || !question.trim()) return;
    // Never downgrade a failed/missing JWT to a guest GPT request.
    if (localStorage.getItem("access_token") !== token) return;
    const controller = new AbortController();
    sending.current = controller;
    setLoading(true);
    setError("");
    const text = question.trim();
    try {
      const response = await fetch(`${API_URL}/ask-gpt`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chart_id: Number(chartId), question: text }), signal: controller.signal,
      });
      if (!response.ok) throw new Error(requestError(response.status));
      const data = await response.json();
      if (controller.signal.aborted) return;
      setMessages(previous => [...previous, { user: "Вы", text }, { user: "GPT", text: data.response || "GPT не дал ответа." }]);
      setQuestion("");
      onQuestionConsumed?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message);
        // A failed response may follow a persisted user message. Reload history;
        // never retry POST automatically.
        setReload(value => value + 1);
      }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); sending.current = null; }
    }
  };
  const blocked = Boolean(authLoading || unsaved || (canChat && (loading || historyLoading || historyError)));
  return <div className="askgpt-container">
    <h4>Чат с GPT</h4>
    {authLoading && <p role="status">Проверка авторизации...</p>}
    {canChat && historyLoading && <p role="status">Загрузка истории...</p>}
    {historyError && <p role="alert">{historyError} <button onClick={() => setReload(value => value + 1)}>Повторить загрузку</button></p>}
    {error && <p role="alert">{error}</p>}
    <div className="chat-messages">
      {!authenticated && <div className="message gpt"><strong>AI:</strong> {CHAT_INTRO}</div>}
      {canChat && messages.map((msg, index) => <div key={index} className={`message ${msg.user === "Вы" ? "user" : "gpt"}`}><strong>{msg.user}:</strong> {msg.text}</div>)}
      {loading && <div className="message gpt"><em>GPT печатает...</em></div>}
    </div>
    {unsaved && <p>Карта не сохранена в аккаунт. Для AI-чата откройте сохранённую карту в разделе «Мои карты».</p>}
    <div className="predefined-questions">
      {QUESTIONS.map(preset => <button key={preset} type="button" className="preset-btn" disabled={blocked}
        onClick={() => authenticated ? setQuestion(preset) : openGate(preset)}>{preset}</button>)}
      <button type="button" className="preset-btn" disabled={blocked} onClick={() => authenticated ? input.current?.focus() : openGate()}>Задать свой вопрос</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); sendQuestion(); }}>
      <textarea ref={input} aria-label="Ваш вопрос" rows={2} className="chat-input" value={question} disabled={blocked}
        onFocus={() => { if (!authenticated && !authLoading && !gate) openGate(); }}
        onClick={() => { if (!authenticated && !authLoading && !gate) openGate(); }}
        onChange={event => authenticated ? setQuestion(event.target.value) : openGate(event.target.value)} placeholder="Введите вопрос..." />
      <button type="submit" className="chat-send" disabled={blocked || (authenticated && !question.trim())}>{loading ? "Отправка..." : "Спросить"}</button>
    </form>
    {gate && <dialog ref={dialog} className="chart-auth-gate" aria-labelledby="chart-auth-title" onCancel={() => setGate(false)}>
      <h3 id="chart-auth-title">Сохраните карту и продолжите разбор</h3>
      <p>Создайте бесплатный аккаунт, чтобы сохранить эту натальную карту и начать персональный AI-чат.</p>
      <button type="button" className="chat-send" onClick={() => startAuth("register")}>Продолжить бесплатно</button>
      <button type="button" className="preset-btn" onClick={() => startAuth("login")}>У меня уже есть аккаунт</button>
      <button type="button" onClick={() => setGate(false)}>Вернуться к карте</button>
    </dialog>}
  </div>;
};
export default AskGptForm;
