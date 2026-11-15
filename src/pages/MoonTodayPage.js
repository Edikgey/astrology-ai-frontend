import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState, PageHeading } from "../components/UI";
import { ASPECT_TYPES, SIGNS_IN } from "../components/natal/model";
import { PHASE_TEXTS, POINT_MEANINGS, SIGN_ADVICE, TONE_ADVICE } from "../components/moon/meanings";
import "./MoonTodayPage.css";

// LUNAR-1 DESIGN §6: chart choice as on MyMonthPage; the day itself is a read-only GET without AI (§3),
// the server decides access and the day; the page only turns codes into words.
const DESCRIPTION = "Фаза и знак Луны на сегодня и то, как она касается вашей карты.";
const WAXING = new Set(["new_moon", "waxing_crescent", "first_quarter", "waxing_gibbous"]);
// Main aspect of the day: the point of the smallest group wins, then the earlier time (ai_chart_context.py POINT_GROUPS).
const POINT_GROUP = { "☉": 0, "☽": 0, AS: 0, MC: 0, "☿": 1, "♀": 1, "♂": 1, "♃": 2, "♄": 2, "♅": 3, "♆": 3, "♇": 3 };
const percent = value => `${value} %`;

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

function SignInSection() {
  const navigate = useNavigate();
  return <section className="moon-note">
    <h2>Войдите, чтобы увидеть свою Луну</h2>
    <p>Лунный день считается по натальной карте, сохранённой в аккаунте. Аккаунт бесплатный.</p>
    <div className="button-row">
      <button type="button" onClick={() => navigate("/authorization", { state: { returnTo: "/moon" } })}>Войти</button>
      <Link className="button button-secondary" to="/try-free">Создать карту</Link>
    </div>
  </section>;
}

// Lit part of the disc as seen from the Northern hemisphere: a waxing Moon is lit on the right.
function MoonPicture({ code, illumination, label }) {
  const lit = Math.min(Math.max(illumination / 100, 0), 1);
  const waxing = WAXING.has(code);
  const rx = (50 * Math.abs(1 - 2 * lit)).toFixed(2);
  const terminatorSweep = waxing === (lit > 0.5) ? 1 : 0;
  const path = `M60 10A50 50 0 0 ${waxing ? 1 : 0} 60 110A${rx} 50 0 0 ${terminatorSweep} 60 10Z`;
  return <svg className="moon-picture" viewBox="0 0 120 120" role="img" aria-label={label}>
    <circle className="moon-picture-dark" cx="60" cy="60" r="50" />
    {lit >= 0.995 ? <circle className="moon-picture-lit" cx="60" cy="60" r="50" /> :
      lit > 0.005 && <path className="moon-picture-lit" d={path} />}
    <circle className="moon-picture-rim" cx="60" cy="60" r="50" />
  </svg>;
}

function mainAspect(aspects) {
  return aspects.reduce((best, item) => {
    if (!best) return item;
    const [group, bestGroup] = [POINT_GROUP[item.point] ?? 9, POINT_GROUP[best.point] ?? 9];
    return group < bestGroup || (group === bestGroup && item.at < best.at) ? item : best;
  }, null);
}

function DayView({ day, sentZone }) {
  const phase = PHASE_TEXTS[day.phase.code];
  const { index, ingress } = day.sign;
  // Advice follows the sign at local noon: a change before 12:00 already counts.
  const noonSign = ingress && ingress.at < "12:00" ? ingress.index : index;
  const main = mainAspect(day.aspects);
  const signLine = `Луна в ${SIGNS_IN[index]}${ingress ? `, с ${ingress.at} — в ${SIGNS_IN[ingress.index]}` : ""}`;
  return <div className="moon-day">
    <section className="moon-sky">
      <MoonPicture code={day.phase.code} illumination={day.phase.illumination}
        label={`${phase.name}, освещено ${percent(day.phase.illumination)}`} />
      <div className="moon-sky-text">
        <h2>{day.phase.exact_at ? `${phase.name} в ${day.phase.exact_at}` : phase.name}</h2>
        <p className="moon-light">Освещено {percent(day.phase.illumination)}</p>
        <p className="moon-sign">{signLine}</p>
      </div>
    </section>
    <section className="moon-advice">
      <h2>Совет на день</h2>
      <p>{phase.advice} {SIGN_ADVICE[noonSign]}</p>
      {main && <p>{POINT_MEANINGS[main.point].theme} {TONE_ADVICE[ASPECT_TYPES[main.aspect].family]}</p>}
    </section>
    <section className="moon-aspects">
      <h2>Луна и ваша карта</h2>
      {day.aspects.length ? <ol>
        {day.aspects.map(item => <li key={`${item.at}${item.aspect}${item.point}`}>
          <time>{item.at}</time> — {ASPECT_TYPES[item.aspect].name} Луны и {POINT_MEANINGS[item.point].genitive}
        </li>)}
      </ol> : <p>Сегодня Луна не образует аспектов к вашей карте.</p>}
    </section>
    <div className="moon-footnotes">
      <p>{sentZone && day.timezone === sentZone ? "Время — по часовому поясу вашего устройства." : "Время — по часовому поясу места рождения."}</p>
      <p>Аспекты к Луне, Асценденту и Середине неба зависят от точного времени рождения.</p>
    </div>
  </div>;
}

function MoonDay({ chartId }) {
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const zone = deviceZone();
    const query = zone ? `?tz=${encodeURIComponent(zone)}` : "";
    setResult(null);
    chartRequest(`/natal-chart/${chartId}/moon-day${query}`, { authenticated: true, signal: controller.signal })
      .then(day => { if (!controller.signal.aborted) setResult({ day, zone }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [chartId, reload]);

  if (!result) return <LoadingState text="Считаем Луну..." />;
  if (result.error?.status === 401) return <SignInSection />;
  if (result.error) {
    // A retry helps only when the calculation or the network failed; 403/404/422 need another action (the text says which).
    const retry = !result.error.status || result.error.status === 503;
    return <div className="moon-note">
      <p role="alert">{result.error.message}</p>
      {retry && <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить</button>}
    </div>;
  }
  return <DayView day={result.day} sentZone={result.zone} />;
}

function MoonCharts({ user }) {
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
  if (result.error) return <div className="moon-note">
    <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
    <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>
  </div>;
  // The server lists new charts first; the page shows them in creation order, the oldest is the default.
  const charts = [...result.charts].sort((a, b) => a.chart_id - b.chart_id);
  if (charts.length === 0) return <section className="moon-note">
    <h2>Сначала создайте карту</h2>
    <p>Лунный день считается по вашей натальной карте — это займёт минуту.</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the server.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className="moon-chart">Карта: {labels[chart.chart_id]}</p> :
      <label className="moon-chart">Карта{" "}
        <select value={chart.chart_id} onChange={event => setSearchParams({ chart: event.target.value }, { replace: true })}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    <MoonDay key={chart.chart_id} chartId={chart.chart_id} />
  </>;
}

export default function MoonTodayPage() {
  const { user, loading, authError } = useAuth();
  let body;
  if (authError) body = null; // AuthNotice explains
  else if (loading) body = <LoadingState text="Проверка аккаунта..." />;
  else body = user ? <MoonCharts user={user} /> : <SignInSection />;
  return <div className="page moon-page">
    <PageHeading title="Луна сегодня"><p>{DESCRIPTION}</p></PageHeading>
    {body}
  </div>;
}
