import { API_URL } from "../config/api";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { apiError } from "../api/apiError";
import { readChatResponse } from "../api/chatStream";
import UsageSummary from "./UsageSummary";
import { DialogClose } from "./UI";
import "./AskGptChat.css";

export const CHAT_INTRO = "Карта готова. Давайте поговорим о том, что важно для вас: характере, отношениях, работе или сильных сторонах.";
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
  const { refreshUsage, handleLimitError } = useUsage();
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
  const history = useRef(null);
  const sending = useRef(null);
  const followBottom = useRef(true);
  const navigate = useNavigate();
  const canChat = authenticated && !unsaved;

  useEffect(() => () => sending.current?.abort(), []);
  useEffect(() => {
    if (history.current && followBottom.current) history.current.scrollTop = history.current.scrollHeight;
  }, [messages, loading]);
  useEffect(() => { if (gate) dialog.current?.showModal(); }, [gate]);
  useEffect(() => {
    const controller = new AbortController();
    setMessages([]);
    followBottom.current = true;
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
  const sendQuestion = async (suggestion) => {
    if (authLoading || unsaved) return;
    if (!authenticated) { openGate(); return; }
    const text = (suggestion ?? question).trim();
    if (sending.current || historyLoading || historyError || !text) return;
    // Never downgrade a failed/missing JWT to a guest GPT request.
    if (localStorage.getItem("access_token") !== token) return;
    const controller = new AbortController();
    sending.current = controller;
    followBottom.current = true;
    setLoading(true);
    setError("");
    if (suggestion) setQuestion(text);
    setMessages(previous => [...previous, { user: "Вы", text }, { user: "GPT", text: "", streaming: true }]);
    try {
      const response = await fetch(`${API_URL}/ask-gpt`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chart_id: Number(chartId), question: text }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json?.().catch(() => ({}));
        throw apiError(response.status, data, requestError(response.status));
      }
      const data = await readChatResponse(response, delta => {
        if (!controller.signal.aborted) setMessages(previous => previous.map(msg =>
          msg.streaming ? { ...msg, text: msg.text + delta } : msg));
      });
      refreshUsage();
      if (controller.signal.aborted) return;
      const candidates = data.follow_up_suggestions;
      const suggestions = Array.isArray(candidates) && candidates.length >= 3 && candidates.length <= 4 &&
        candidates.every(item => typeof item === "string" && item.trim() && item.length <= 100)
        ? [...new Set(candidates.map(item => item.trim()))] : [];
      setMessages(previous => previous.map(msg => msg.streaming ? {
        user: "GPT", text: data.response || "GPT не дал ответа.",
        suggestions: suggestions.length >= 3 ? suggestions : [],
      } : msg));
      setQuestion("");
      onQuestionConsumed?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setMessages(previous => previous.filter(msg => !msg.streaming).slice(0, -1));
        if (handleLimitError(err)) return; // Keep the draft/history; never retry a denied POST.
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
  const latestSuggestions = !loading && messages[messages.length - 1]?.user === "GPT" ? messages[messages.length - 1].suggestions || [] : [];
  const starters = <div className="predefined-questions">
    {QUESTIONS.map(preset => <button key={preset} type="button" className="preset-btn" disabled={blocked}
      onClick={() => authenticated ? setQuestion(preset) : openGate(preset)}>{preset}</button>)}
    <button type="button" className="preset-btn" disabled={blocked} onClick={() => authenticated ? input.current?.focus() : openGate()}>Задать свой вопрос</button>
  </div>;
  return <div className={`askgpt-container${canChat ? " is-chat-active" : ""}`}>
    <div className="chat-heading"><div><p className="eyebrow">Ваш персональный AI-астролог</p><h2>Поговорим о вас</h2><p>Задайте вопрос по карте или продолжите предыдущую мысль.</p></div><span className="badge badge-accent">AI · по вашей карте</span></div>
    {authenticated && <details className="chat-usage"><summary>Ваш план и доступные вопросы</summary><UsageSummary /></details>}
    {authLoading && <p role="status">Проверка авторизации...</p>}
    {canChat && historyLoading && <p role="status">Загрузка истории...</p>}
    {historyError && <p role="alert">{historyError} <button onClick={() => setReload(value => value + 1)}>Повторить загрузку</button></p>}
    {error && <p role="alert">{error}</p>}
    <div ref={history} className="chat-messages" role="log" tabIndex={0} aria-label="История разговора" aria-live="polite" aria-relevant="additions"
      onScroll={event => { const el = event.currentTarget; followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; }}>
      {(!authenticated || (canChat && !historyLoading && !historyError && messages.length === 0)) && <div className="message gpt"><strong>Lunaria</strong><div>{CHAT_INTRO}</div></div>}
      {canChat && messages.map((msg, index) => <div key={index} className={`message ${msg.user === "Вы" ? "user" : "gpt"}`}>
        <strong>{msg.user === "Вы" ? "Вы" : "Lunaria"}{msg.streaming && <span className="stream-indicator" role="status" aria-label="Lunaria отвечает"> ···</span>}</strong>
        <div>{msg.text || (msg.streaming ? "Обдумываю вашу карту и вопрос..." : "")}</div>
      </div>)}
    </div>
    {latestSuggestions.length > 0 && <div className="chat-follow-ups" role="group" aria-label="Следующие вопросы">
      {latestSuggestions.map(suggestion => <button key={suggestion} type="button" className="preset-btn"
        disabled={blocked} onClick={() => sendQuestion(suggestion)}><span aria-hidden="true">→ </span>{suggestion}</button>)}
    </div>}
    {unsaved && <p>Карта не сохранена в аккаунт. Для AI-чата откройте сохранённую карту в разделе «Мои карты».</p>}
    {canChat && messages.length > 0 ? <details className="chat-starters"><summary>Другие темы для разговора</summary>{starters}</details> : starters}
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); sendQuestion(); }}>
      <textarea ref={input} aria-label="Ваш вопрос" rows={2} maxLength={4000} className="chat-input" value={question} disabled={blocked}
        onFocus={() => { if (!authenticated && !authLoading && !gate) openGate(); }}
        onClick={() => { if (!authenticated && !authLoading && !gate) openGate(); }}
        onChange={event => authenticated ? setQuestion(event.target.value) : openGate(event.target.value)} placeholder="Что вам хотелось бы понять о себе?" />
      <button type="submit" className="chat-send" disabled={blocked || (authenticated && !question.trim())}>{loading ? "Отправка..." : "Спросить"}</button>
    </form>

    {gate && <dialog ref={dialog} className="chart-auth-gate" aria-labelledby="chart-auth-title" onCancel={() => setGate(false)}>
      <DialogClose onClose={() => setGate(false)} />
      <h3 id="chart-auth-title">Сохраните карту и продолжите разбор</h3>
      <p>Создайте бесплатный аккаунт, чтобы сохранить эту натальную карту и начать персональный AI-чат.</p>
      <button type="button" className="chat-send" onClick={() => startAuth("register")}>Продолжить бесплатно</button>
      <button type="button" className="preset-btn" onClick={() => startAuth("login")}>У меня уже есть аккаунт</button>
      <button type="button" onClick={() => setGate(false)}>Вернуться к карте</button>
    </dialog>}
  </div>;
};
export default AskGptForm;
