import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chartRequest } from '../api/chartsApi';
import NatalChart from '../components/NatalChart';
import AskGptForm from '../components/AskGptForm'; // Подключаем компонент чата

const NatalChartResultPage = () => {
  const { chartId: routeChartId } = useParams();
  const { user } = useAuth();
  const chartId = routeChartId || localStorage.getItem("chart_id") || (() => {
    try { return JSON.parse(localStorage.getItem("natalChart"))?.chart_id; }
    catch { return null; }
  })();
  const token = localStorage.getItem("access_token");
  const sessionToken = localStorage.getItem("session_token");
  const identityKey = `${token || ""}:${sessionToken || ""}:${user?.id || ""}`;
  const requestKey = `${identityKey}:${chartId}`;
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const chartData = loaded?.key === requestKey ? loaded.data : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setError(null);
    if (!/^[1-9]\d*$/.test(String(chartId))) {
      setError(new Error("Карта не выбрана. Создайте карту или откройте её в разделе «Мои карты»."));
      return () => controller.abort();
    }
    chartRequest(`/natal-chart/${chartId}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setLoaded({ key: requestKey, data }); })
      .catch(err => { if (!controller.signal.aborted) setError(err); });
    return () => controller.abort();
  }, [chartId, requestKey, reload]);

  if (error) {
    return <div style={{ padding: "40px", textAlign: "center" }}>
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
    <AskGptForm chartId={chartData.chart_id} />
  </div>
</NatalChart>

   
    </div>
  );
  
};

export default NatalChartResultPage;

