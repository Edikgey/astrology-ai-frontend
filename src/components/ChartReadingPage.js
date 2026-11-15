import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState, PageHeading } from "./UI";

// The frame of a read-only «reading» page (Moon today, My year): sign-in, the person's chart list, ?chart= and a cancellable
// GET `/natal-chart/<id>/<endpoint>` with «Повторить». The server decides access and the result; a page supplies only its
// view (`View` gets `data` and `sentZone`) and texts. CSS classes come from `prefix`: `<prefix>-page`, `-note`, `-chart`.
function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

function SignInSection({ prefix, returnTo, texts }) {
  const navigate = useNavigate();
  return <section className={`${prefix}-note`}>
    <h2>{texts.signInHeading}</h2>
    <p>{texts.signInText}</p>
    <div className="button-row">
      <button type="button" onClick={() => navigate("/authorization", { state: { returnTo } })}>Войти</button>
      <Link className="button button-secondary" to="/try-free">Создать карту</Link>
    </div>
  </section>;
}

function Reading({ chartId, endpoint, View, ...frame }) {
  const { prefix, texts } = frame;
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const zone = deviceZone();
    const query = zone ? `?tz=${encodeURIComponent(zone)}` : "";
    setResult(null);
    chartRequest(`/natal-chart/${chartId}/${endpoint}${query}`, { authenticated: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ data, zone }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [chartId, endpoint, reload]);

  if (!result) return <LoadingState text={texts.loadingReading} />;
  if (result.error?.status === 401) return <SignInSection {...frame} />;
  if (result.error) {
    // A retry helps only when the calculation or the network failed; 403/404/422 need another action (the text says which).
    const retry = !result.error.status || result.error.status === 503;
    return <div className={`${prefix}-note`}>
      <p role="alert">{result.error.message}</p>
      {retry && <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить</button>}
    </div>;
  }
  return <View data={result.data} sentZone={result.zone} />;
}

function Charts({ user, ...frame }) {
  const { prefix, texts } = frame;
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
  if (result.error?.status === 401) return <SignInSection {...frame} />;
  if (result.error) return <div className={`${prefix}-note`}>
    <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
    <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>
  </div>;
  // The server lists new charts first; the page shows them in creation order, the oldest is the default.
  const charts = [...result.charts].sort((a, b) => a.chart_id - b.chart_id);
  if (charts.length === 0) return <section className={`${prefix}-note`}>
    <h2>Сначала создайте карту</h2>
    <p>{texts.emptyText}</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the server.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className={`${prefix}-chart`}>Карта: {labels[chart.chart_id]}</p> :
      <label className={`${prefix}-chart`}>Карта{" "}
        <select value={chart.chart_id} onChange={event => setSearchParams({ chart: event.target.value }, { replace: true })}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    <Reading key={chart.chart_id} chartId={chart.chart_id} {...frame} />
  </>;
}

export default function ChartReadingPage({ title, description, prefix, returnTo, endpoint, View, texts }) {
  const { user, loading, authError } = useAuth();
  const frame = { prefix, returnTo, endpoint, View, texts };
  let body;
  if (authError) body = null; // AuthNotice explains
  else if (loading) body = <LoadingState text="Проверка аккаунта..." />;
  else body = user ? <Charts user={user} {...frame} /> : <SignInSection {...frame} />;
  return <div className={`page ${prefix}-page`}>
    <PageHeading title={title}><p>{description}</p></PageHeading>
    {body}
  </div>;
}
