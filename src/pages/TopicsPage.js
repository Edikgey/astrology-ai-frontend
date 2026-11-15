import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState, PageHeading } from "../components/UI";
import AskGptForm from "../components/AskGptForm";
import "./MyMonthPage.css";
import "./TopicsPage.css";

// TOPICS-1 DESIGN §3.1: the page picks the chart and the topic; the reading itself lives in AskGptForm view="topic".
// The question texts are the server's markers (DESIGN §2.1, TOPIC_QUESTIONS): change them only together with the backend.
// shortcut: the chart choice is copied a third time (MyMonthPage, MoonTodayPage, TopicsPage); extract a shared component
// with the fourth page or when the choice itself changes.
const DESCRIPTION = "Готовый разбор вашей натальной карты по одной теме — по планетам и домам. Разбор сохраняется, его можно перечитать.";
const TOPICS = [
  { key: "career", label: "Призвание и работа", question: "Призвание и работа: разбор моей карты",
    line: "Какие занятия и условия работы вам подходят, ваши сильные стороны и что может мешать." },
  { key: "money", label: "Деньги", question: "Деньги: разбор моей карты",
    line: "Как вы зарабатываете, тратите и бережёте деньги — склонности и стиль, без советов по вложениям." },
  { key: "love", label: "Любовь", question: "Любовь: разбор моей карты",
    line: "Что для вас важно в любви, как вы проявляете чувства и каким видите партнёра." },
];
const CHAT_TEXTS = {
  subtitle: "Разбор сохраняется в разговоре этой карты.",
  intro: "Соберу разбор вашей карты по этой теме — по планетам, домам и аспектам.",
};

function SignInSection() {
  const navigate = useNavigate();
  return <section className="my-month-note">
    <h2>Войдите, чтобы получить разбор</h2>
    <p>Разбор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.</p>
    <div className="button-row">
      <button type="button" onClick={() => navigate("/authorization", { state: { returnTo: "/topics" } })}>Войти</button>
      <Link className="button button-secondary" to="/try-free">Создать карту</Link>
    </div>
  </section>;
}

function TopicCharts({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    chartRequest("/natal-charts", { authenticated: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ charts: data?.charts || [] }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [user.id, reload]);

  if (!result) return <LoadingState text="Загрузка карт..." />;
  if (result.error?.status === 401) return <SignInSection />;
  if (result.error) return <div className="my-month-note">
    <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
    <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>
  </div>;
  // The server lists new charts first; the page shows them in creation order, the oldest is the default.
  const charts = [...result.charts].sort((a, b) => a.chart_id - b.chart_id);
  if (charts.length === 0) return <section className="my-month-note">
    <h2>Сначала создайте карту</h2>
    <p>Разбор строится по вашей натальной карте — это займёт минуту.</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the chat; only one of the three topics reaches the server.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const topic = TOPICS.find(item => item.key === searchParams.get("topic")) || TOPICS[0];
  const choose = (chartId, topicKey) => setSearchParams({ chart: String(chartId), topic: topicKey }, { replace: true });
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className="my-month-chart">Карта: {labels[chart.chart_id]}</p> :
      <label className="my-month-chart">Карта{" "}
        <select value={chart.chart_id} onChange={event => choose(event.target.value, topic.key)}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    <div className="topics-choice" role="group" aria-label="Тема разбора">
      {TOPICS.map(item => <button key={item.key} type="button" aria-pressed={item.key === topic.key}
        onClick={() => choose(chart.chart_id, item.key)}>{item.label}</button>)}
    </div>
    <p className="topics-line">{topic.line}
      {topic.key === "love" && <> <Link to="/relationships/new">Совместимость с конкретным человеком — в разборе отношений</Link></>}
    </p>
    <p className="topics-accuracy">Дома карты зависят от точного времени рождения. Если время было примерным, части о домах могут не совпасть.</p>
    <AskGptForm chartId={chart.chart_id} view="topic" topicQuestion={topic.question} heading={topic.label} {...CHAT_TEXTS} />
  </>;
}

export default function TopicsPage() {
  const { user, loading, authError } = useAuth();
  let body;
  if (authError) body = null; // AuthNotice explains
  else if (loading) body = <LoadingState text="Проверка аккаунта..." />;
  else body = user ? <TopicCharts user={user} /> : <SignInSection />;
  return <div className="page my-month-page topics-page">
    <PageHeading title="Разборы по темам"><p>{DESCRIPTION}</p></PageHeading>
    {body}
  </div>;
}
