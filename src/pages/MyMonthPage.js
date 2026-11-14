import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState, PageHeading } from "../components/UI";
import AskGptForm from "../components/AskGptForm";
import "./MyMonthPage.css";

// MY-MONTH-PAGE DESIGN §3: the page picks the chart; the month chat itself lives in AskGptForm view="month".
const DESCRIPTION = "Ближайшие 30 дней по вашей карте: любовь, работа, силы и то, на что стоит обратить внимание.";
const CHAT_TEXTS = {
  heading: "Обзор месяца",
  subtitle: "Строится по транзитам — тому, как планеты сейчас стоят относительно вашей карты. Обзор и ответы сохраняются в разговоре этой карты.",
  intro: "Соберу обзор ваших ближайших 30 дней: любовь и отношения, работа и деньги, силы и самочувствие, на что обратить внимание. Потом можно спросить подробнее.",
};

function SignInSection() {
  const navigate = useNavigate();
  return <section className="my-month-note">
    <h2>Войдите, чтобы увидеть свой месяц</h2>
    <p>Обзор строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.</p>
    <div className="button-row">
      <button type="button" onClick={() => navigate("/authorization", { state: { returnTo: "/my-month" } })}>Войти</button>
      <Link className="button button-secondary" to="/try-free">Создать карту</Link>
    </div>
  </section>;
}

function MonthCharts({ user }) {
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
    <p>Обзор месяца строится по вашей натальной карте — это займёт минуту.</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the chat.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className="my-month-chart">Карта: {labels[chart.chart_id]}</p> :
      <label className="my-month-chart">Карта{" "}
        <select value={chart.chart_id} onChange={event => setSearchParams({ chart: event.target.value }, { replace: true })}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    <AskGptForm chartId={chart.chart_id} view="month" {...CHAT_TEXTS} />
  </>;
}

export default function MyMonthPage() {
  const { user, loading, authError } = useAuth();
  let body;
  if (authError) body = null; // AuthNotice explains
  else if (loading) body = <LoadingState text="Проверка аккаунта..." />;
  else body = user ? <MonthCharts user={user} /> : <SignInSection />;
  return <div className="page my-month-page">
    <PageHeading title="Мой месяц"><p>{DESCRIPTION}</p></PageHeading>
    {body}
  </div>;
}
