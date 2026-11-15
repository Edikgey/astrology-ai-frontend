import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { chartLabels } from "../api/chartPresentation";
import { LoadingState } from "./UI";

// Shared by the pages that work on one of the person's own charts (My month, Topics, Moon today, My year): account check,
// sign-in, the person's chart list with «Повторить загрузку», the empty list, ?chart= and the chart select. The server decides
// access; a page supplies only its texts and `children(chart)`. CSS classes come from `prefix`: `<prefix>-note`, `-chart`.
// `params` — other query parameters the select keeps when the chart changes (Topics: the topic).
export function SignInSection({ prefix, returnTo, texts }) {
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

function Charts({ user, prefix, params, children, ...frame }) {
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
  if (result.error?.status === 401) return <SignInSection prefix={prefix} {...frame} />;
  if (result.error) return <div className={`${prefix}-note`}>
    <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
    <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>
  </div>;
  // The server lists new charts first; the page shows them in creation order, the oldest is the default.
  const charts = [...result.charts].sort((a, b) => a.chart_id - b.chart_id);
  if (charts.length === 0) return <section className={`${prefix}-note`}>
    <h2>Сначала создайте карту</h2>
    <p>{frame.texts.emptyText}</p>
    <Link className="button" to="/try-free">Создать карту</Link>
  </section>;
  // Only an id from the person's own list reaches the page.
  const wanted = /^\d+$/.test(searchParams.get("chart") || "") ? Number(searchParams.get("chart")) : null;
  const chart = charts.find(item => item.chart_id === wanted) || charts[0];
  const labels = chartLabels(charts);
  return <>
    {charts.length === 1 ? <p className={`${prefix}-chart`}>Карта: {labels[chart.chart_id]}</p> :
      <label className={`${prefix}-chart`}>Карта{" "}
        <select value={chart.chart_id}
          onChange={event => setSearchParams({ chart: event.target.value, ...params }, { replace: true })}>
          {charts.map(item => <option key={item.chart_id} value={item.chart_id}>{labels[item.chart_id]}</option>)}
        </select>
      </label>}
    {children(chart)}
  </>;
}

export default function OwnChartPicker({ children, params, ...frame }) {
  const { user, loading, authError } = useAuth();
  if (authError) return null; // AuthNotice explains
  if (loading) return <LoadingState text="Проверка аккаунта..." />;
  return user ? <Charts user={user} params={params} {...frame}>{children}</Charts> : <SignInSection {...frame} />;
}
