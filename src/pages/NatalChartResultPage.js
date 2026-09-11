import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { FREE_CHART_LIMIT } from '../config/plans';
import { useAuth } from '../context/AuthContext';
import { chartRequest } from '../api/chartsApi';
import NatalChart from '../components/NatalChart';
import AskGptForm from '../components/AskGptForm'; // Подключаем компонент чата

const NatalChartResultPage = () => {
  const { chartId: routeChartId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setActiveGuestChart } = useAuth();
  const chartId = routeChartId || localStorage.getItem("chart_id") || (() => {
    try { return JSON.parse(localStorage.getItem("natalChart"))?.chart_id; }
    catch { return null; }
  })();
  const token = localStorage.getItem("access_token");
  const sessionToken = localStorage.getItem("session_token");
  const chartAuth = String(location.state?.chartAuth?.chartId) === String(chartId) ? location.state.chartAuth : null;
  const unsaved = Boolean(chartAuth && chartAuth.status !== "migrated");
  const guestSessionToken = unsaved ? chartAuth.sessionToken : undefined;
  const migrationNotice = chartAuth?.status === "limit_reached" ? `Вы вошли в аккаунт, но карта не сохранена: достигнут лимит ${FREE_CHART_LIMIT} карт. Откройте «Мои карты», чтобы управлять сохранёнными картами.` :
    chartAuth?.status === "not_found" ? "Вход выполнен, но гостевую карту не удалось перенести. Она не считается сохранённой." :
    chartAuth?.status === "not_requested" ? "Вход выполнен. Перенос карты не выполнялся; карта не сохранена в аккаунт." :
    chartAuth?.status === "migrated" ? "Карта сохранена в вашем аккаунте." : "";
  const identityKey = `${token || ""}:${sessionToken || ""}:${user?.id || ""}:${guestSessionToken || ""}`;
  const requestKey = `${identityKey}:${chartId}`;
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const chartData = loaded?.key === requestKey ? loaded.data : null;

  useEffect(() => {
    if (chartData && !user && (!token || token === "null") && sessionToken) {
      setActiveGuestChart?.({ chartId: chartData.chart_id, sessionToken, pendingQuestion: "" });
    }
    return () => setActiveGuestChart?.(null);
  }, [chartData, user, token, sessionToken, setActiveGuestChart]);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setError(null);
    if (!/^[1-9]\d*$/.test(String(chartId))) {
      setError(new Error("Карта не выбрана. Создайте карту или откройте её в разделе «Мои карты»."));
      return () => controller.abort();
    }
    chartRequest(`/natal-chart/${chartId}`, { signal: controller.signal, ...(guestSessionToken ? { guestSessionToken } : {}) })
      .then(data => { if (!controller.signal.aborted) setLoaded({ key: requestKey, data }); })
      .catch(err => { if (!controller.signal.aborted) setError(err); });
    return () => controller.abort();
  }, [chartId, requestKey, reload, guestSessionToken]);

  const consumeQuestion = () => {
    if (chartAuth?.pendingQuestion) navigate(location.pathname, { replace: true, state: {
      ...location.state, chartAuth: { ...chartAuth, pendingQuestion: "" },
    } });
  };

  if (error) {
    return <div style={{ padding: "40px", textAlign: "center" }}>
      {migrationNotice && <p role="status">{migrationNotice}</p>}
      <p role="alert">{error.message}</p>
      <button onClick={() => setReload(value => value + 1)}>Повторить</button>
      <p><Link to="/my-charts">Мои карты</Link> · <Link to="/try-free">Создать карту</Link></p>
      {error.status === 401 && <Link to="/authorization">Войти</Link>}
    </div>;
  }

  if (!chartData) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Загрузка натальной карты...</div>;
  }

  return (
    <div style={{ padding: "40px 0" }}>
   {migrationNotice && <p role="status" style={{ textAlign: "center" }}>{migrationNotice} <Link to="/my-charts">Мои карты</Link></p>}
   <NatalChart
  key={requestKey}
  chartId={chartData.chart_id}
  bodies={chartData.bodies_for_circle}
  aspects={chartData.aspects_for_circle}
  pointsData={chartData.points_data}
  patterns={chartData.patterns_data}
  structuredAspects={chartData.aspects_structured}
  houses={chartData.houses}
>
  {/* ✅ Передаём чат как children */}
  <div style={{ marginTop: "40px", maxWidth: 640 }}>
    <h2 style={{ textAlign: "center", marginBottom: "16px",fontFamily: "'Montserrat', sans-serif" }}>Спросить у GPT</h2>
    <AskGptForm chartId={chartData.chart_id} unsaved={unsaved} initialQuestion={chartAuth?.pendingQuestion || ""}
      guestSessionToken={sessionToken} onQuestionConsumed={consumeQuestion} />
  </div>
</NatalChart>

   
    </div>
  );
  
};

export default NatalChartResultPage;
