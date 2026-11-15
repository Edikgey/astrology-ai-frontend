import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState, PageHeading } from "../components/UI";
import { ASPECT_TYPES, SIGNS, SIGNS_IN } from "../components/natal/model";
import {
  ASCENDANT_TONES, ASPECT_TONES, HOUSE_SPHERES, MOON_SIGN_PHRASES, POINT_GENITIVES, SUN_HOUSE_PHRASES,
} from "../components/solar/meanings";
import "./MyYearPage.css";

// SOLAR-1 DESIGN §6: the frame (sign-in, chart list, ?chart=) is a copy of MoonTodayPage; the year itself is a read-only
// GET without AI or quota (§3). The server decides access and the year; the page only turns codes into words.
// shortcut: third copy of the «sign-in + chart list» block (MyMonthPage, MoonTodayPage) — a shared component is its own R1 task.
const DESCRIPTION = "Карта года от вашего дня рождения: когда начался год и какие темы в нём главные.";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

// "2027-03-10" + "11:30" → «10 марта 2027 в 11:30». Built from the string: new Date("…") would shift the day by the browser zone.
function moment({ date, time }) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year} в ${time}`;
}

function SignInSection() {
  const navigate = useNavigate();
  return <section className="year-note">
    <h2>Войдите, чтобы увидеть свой год</h2>
    <p>Карта года строится по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.</p>
    <div className="button-row">
      <button type="button" onClick={() => navigate("/authorization", { state: { returnTo: "/my-year" } })}>Войти</button>
      <Link className="button button-secondary" to="/try-free">Создать карту</Link>
    </div>
  </section>;
}

// The Sun goes the whole circle and comes back to the point where it stood at birth: that return opens the year.
function SunReturn() {
  return <svg className="year-orbit" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle className="year-orbit-track" cx="60" cy="60" r="46" />
    <path className="year-orbit-path" d="M64.8 14.25A46 46 0 1 1 55.2 14.25" />
    <path className="year-orbit-head" d="M51 10.5L57.2 14.25L51.6 18.8" />
    <circle className="year-orbit-sun" cx="60" cy="14" r="7" />
    <circle className="year-orbit-birth" cx="60" cy="60" r="3" />
    <line className="year-orbit-ray" x1="60" y1="57" x2="60" y2="24" />
  </svg>;
}

const aspectLine = item => `${ASPECT_TYPES[item.aspect].name} ${POINT_GENITIVES[item.a]} и ${POINT_GENITIVES[item.b]}`;

function YearView({ year, sentZone }) {
  const first = year.aspects[0];
  const overview = [
    ASCENDANT_TONES[year.ascendant_sign],
    SUN_HOUSE_PHRASES[year.sun_house - 1],
    MOON_SIGN_PHRASES[year.moon_sign],
    first && ASPECT_TONES[ASPECT_TYPES[first.aspect].family],
  ].filter(Boolean).join(" ");
  return <div className="year-view">
    <section className="year-span">
      <SunReturn />
      <p className="year-span-text">
        <span className="year-span-start">Ваш год начался <time dateTime={year.start.date}>{moment(year.start)}</time>.</span>{" "}
        <span className="year-span-next">Следующий начнётся <time dateTime={year.next.date}>{moment(year.next)}</time>.</span>
      </p>
    </section>
    <section className="year-themes">
      <h2>Главные темы</h2>
      <ul className="year-theme-list">
        <li><b>Асцендент года — {SIGNS[year.ascendant_sign]}</b> <span>{ASCENDANT_TONES[year.ascendant_sign]}</span></li>
        <li><b>Солнце года — в {year.sun_house}-м доме:</b> {HOUSE_SPHERES[year.sun_house - 1]}</li>
        <li><b>Луна года — в {SIGNS_IN[year.moon_sign]}, в {year.moon_house}-м доме:</b> {HOUSE_SPHERES[year.moon_house - 1]}</li>
      </ul>
      <h3>Сильные аспекты</h3>
      {year.aspects.length ? <ol className="year-aspects">
        {year.aspects.map(item => <li key={`${item.a}${item.aspect}${item.b}`}>{aspectLine(item)}</li>)}
      </ol> : <p className="year-quiet">В этом году тесных аспектов нет.</p>}
    </section>
    <section className="year-overview">
      <h2>Обзор года</h2>
      <p>{overview}</p>
    </section>
    <div className="year-footnotes">
      <p>{sentZone && year.timezone === sentZone ? "Время — по часовому поясу вашего устройства." : "Время — по часовому поясу места рождения."}</p>
      <p>Карта года построена для места рождения.</p>
      <p>Асцендент, дома и аспекты к Асценденту и Середине неба зависят от точного времени рождения.</p>
      <p>Год начинается, когда Солнце возвращается туда, где было при вашем рождении, — на день раньше или позже дня рождения это нормально.</p>
    </div>
  </div>;
}

function SolarYear({ chartId }) {
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const zone = deviceZone();
    const query = zone ? `?tz=${encodeURIComponent(zone)}` : "";
    setResult(null);
    chartRequest(`/natal-chart/${chartId}/solar-return${query}`, { authenticated: true, signal: controller.signal })
      .then(year => { if (!controller.signal.aborted) setResult({ year, zone }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [chartId, reload]);

  if (!result) return <LoadingState text="Строим карту года..." />;
  if (result.error?.status === 401) return <SignInSection />;
  if (result.error) {
    // A retry helps only when the calculation or the network failed; 403/404/422 need another action (the text says which).
    const retry = !result.error.status || result.error.status === 503;
    return <div className="year-note">
      <p role="alert">{result.error.message}</p>
      {retry && <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить</button>}
    </div>;
  }
  return <YearView year={result.year} sentZone={result.zone} />;
}

function YearCharts({ user }) {
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
  if (result.error) return <div className="year-note">
    <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
    <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>
  </div>;
  // The server lists new charts first; the page shows them in creation order, the oldest is the default.
  const charts = [...result.charts].sort((a, b) => a.chart_id - b.chart_id);
  if (charts.length === 0) return <section className="year-note">
    <h2>Сначала создайте карту</h2>
    <p>Карта года строится по вашей натальной карте — это займёт минуту.</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the server.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className="year-chart">Карта: {labels[chart.chart_id]}</p> :
      <label className="year-chart">Карта{" "}
        <select value={chart.chart_id} onChange={event => setSearchParams({ chart: event.target.value }, { replace: true })}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    <SolarYear key={chart.chart_id} chartId={chart.chart_id} />
  </>;
}

export default function MyYearPage() {
  const { user, loading, authError } = useAuth();
  let body;
  if (authError) body = null; // AuthNotice explains
  else if (loading) body = <LoadingState text="Проверка аккаунта..." />;
  else body = user ? <YearCharts user={user} /> : <SignInSection />;
  return <div className="page year-page">
    <PageHeading title="Мой год"><p>{DESCRIPTION}</p></PageHeading>
    {body}
  </div>;
}
