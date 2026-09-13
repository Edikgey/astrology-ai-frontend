import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import { useUsage } from "../context/UsageContext";
import { PageHeading, LoadingState, EmptyState, OrbitMark } from "../components/UI";
import { chartPresentation } from "../api/chartPresentation";
import UsageSummary from "../components/UsageSummary";
import "./MyCharts.css"; // Стили

const MyCharts = () => {
  const { user } = useAuth();
  const { usage, refreshUsage, handleLimitError } = useUsage();
  const token = localStorage.getItem("access_token");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  const hasToken = token && token !== "null";
  const currentResult = result?.token === token ? result.data : null;
  const savedCount = usage?.saved_charts_used ?? currentResult?.count;
  const savedLimit = usage?.saved_charts_limit ?? currentResult?.limit;
  const chartLimitReached = savedCount >= savedLimit;

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(null);
    if (hasToken) {
      chartRequest("/natal-charts", { authenticated: true, signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) { setResult({ token, data }); refreshUsage(); } })
        .catch(err => { if (!controller.signal.aborted) setError(err); });
    }
    return () => controller.abort();
  }, [token, hasToken, user?.id, reload, refreshUsage]);

  const deleteChart = async (chartId) => {
    if (deleting !== null || !window.confirm(`Удалить карту №${chartId} и всю её GPT-историю? Это действие нельзя отменить.`)) return;
    setDeleting(chartId);
    setError(null);
    try {
      await chartRequest(`/natal-chart/${chartId}`, { method: "DELETE", authenticated: true });
      refreshUsage();
      if (localStorage.getItem("chart_id") === String(chartId)) {
        localStorage.removeItem("chart_id");
        localStorage.removeItem("natalChart");
      }
      setReload(value => value + 1);
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(null);
    }
  };

  const formatTime = (hour) => {
    if (hour == null) return "Не указано";
    const totalMinutes = Math.round(hour * 60);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  };
  const [formData, setFormData] = useState({
    name: "",
    birthDate: "",
    birthTime: "",
    birthPlace: "",
  });

  const navigate = useNavigate();

  // Загружаем данные из localStorage при загрузке страницы
  useEffect(() => {
    const savedData = localStorage.getItem("userData");
    if (savedData) {
      try { setFormData(JSON.parse(savedData)); } catch { /* Ignore a malformed optional local profile. */ }
    }
  }, []);

  // Обновляем state при изменении полей
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Сохранение данных в localStorage
  const handleSave = () => {
    localStorage.setItem("userData", JSON.stringify(formData));
    alert("Данные сохранены!");
  };

  return (
    <div className="charts-container page">
      <PageHeading eyebrow="Личное пространство" title="Мои карты"><p>Знакомые истории. Новые открытия. Выберите карту, чтобы продолжить разговор.</p></PageHeading>
      {!hasToken || error?.status === 401 ? (
        <p>Войдите в аккаунт, чтобы увидеть свои карты. <Link to="/authorization">Войти</Link></p>
      ) : (
        <>
          {user && <details className="account-plan"><summary>Ваш план и использование аккаунта</summary><UsageSummary /></details>}
          {error && <p role="alert">{error.message}</p>}
          {error && <button onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>}
          {!currentResult && !error && <LoadingState text="Загрузка карт..." />}
          {currentResult && (
            <>
              <div className="charts-toolbar"><div><strong>Ваша коллекция</strong><p>Сохранено карт: {savedCount} / {savedLimit} <span className="badge badge-accent">Свободных мест: {Math.max(0, savedLimit - savedCount)}</span></p></div><button disabled={chartLimitReached} onClick={() => navigate("/try-free")}>Создать карту</button></div>
              {chartLimitReached && <p>Лимит сохранённых карт: {savedLimit}. Удалите одну из карт, чтобы создать новую.
                <button type="button" onClick={() => handleLimitError({ code: "chart_limit_reached", detail: {
                  used: savedCount, limit: savedLimit, plan: usage?.plan,
                } })}>Лимиты плана</button>
              </p>}
              {currentResult.charts.length === 0 && <EmptyState title="Первая карта — начало разговора"><p>У вас пока нет сохранённых карт. Создайте первую с помощью кнопки выше.</p></EmptyState>}
              <ul className="saved-charts-list">
                {currentResult.charts.map(chart => (
                  <li key={chart.chart_id}>
                    <div className="saved-chart-heading"><OrbitMark /><span className="badge">№ {chart.chart_id}</span></div>
                    <h3>{chartPresentation(chart.chart_id).name || `Карта №${chart.chart_id}`}</h3>
                    <p>Дата рождения: {chart.day && chart.month && chart.year ? `${String(chart.day).padStart(2, "0")}.${String(chart.month).padStart(2, "0")}.${chart.year}` : "Не указана"}</p>
                    <p>Время: {formatTime(chart.hour)}</p>
                    <p>Город: {chart.city || "Не указан"}</p>
                    <div className="saved-chart-actions"><button onClick={() => navigate(`/natal-chart-result/${chart.chart_id}`)}>Открыть</button>
                    <button className="button-danger" disabled={deleting !== null} onClick={() => deleteChart(chart.chart_id)}>
                      {deleting === chart.chart_id ? "Удаление..." : "Удалить"}
                    </button></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <details className="local-chart-profile">
      <summary>Локальные данные профиля</summary>
      <p className="muted">Подсказки для следующего создания карты на этом устройстве. Сохранённые карты в аккаунте не изменятся.</p>
      <form>
        <input type="text" aria-label="Имя" name="name" placeholder="Имя" value={formData.name} onChange={handleChange} />
        <input type="date" aria-label="Дата рождения" name="birthDate" value={formData.birthDate} onChange={handleChange} />
        <input type="time" aria-label="Время рождения" name="birthTime" value={formData.birthTime} onChange={handleChange} />
        <input type="text" aria-label="Место рождения" name="birthPlace" placeholder="Место рождения" value={formData.birthPlace} onChange={handleChange} />
        <button type="button" onClick={handleSave}>Сохранить изменения</button>
      </form>
      </details>
      <Link className="back-home" to="/">Вернуться на главную</Link>
    </div>
  );
};

export default MyCharts;
