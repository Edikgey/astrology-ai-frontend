import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chartRequest } from "../api/chartsApi";
import "./MyCharts.css"; // Стили

const MyCharts = () => {
  const { user } = useAuth();
  const token = localStorage.getItem("access_token");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  const hasToken = token && token !== "null";
  const currentResult = result?.token === token ? result.data : null;

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(null);
    if (hasToken) {
      chartRequest("/natal-charts", { authenticated: true, signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setResult({ token, data }); })
        .catch(err => { if (!controller.signal.aborted) setError(err); });
    }
    return () => controller.abort();
  }, [token, hasToken, user?.id, reload]);

  const deleteChart = async (chartId) => {
    if (deleting !== null || !window.confirm(`Удалить карту №${chartId} и всю её GPT-историю? Это действие нельзя отменить.`)) return;
    setDeleting(chartId);
    setError(null);
    try {
      await chartRequest(`/natal-chart/${chartId}`, { method: "DELETE", authenticated: true });
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
      setFormData(JSON.parse(savedData));
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
    <div className="charts-container">
      <h2>Мои карты</h2>
      {!hasToken || error?.status === 401 ? (
        <p>Войдите в аккаунт, чтобы увидеть свои карты. <Link to="/authorization">Войти</Link></p>
      ) : (
        <>
          {error && <p role="alert">{error.message}</p>}
          {error && <button onClick={() => setReload(value => value + 1)}>Повторить загрузку</button>}
          {!currentResult && !error && <p role="status">Загрузка карт...</p>}
          {currentResult && (
            <>
              <p>Сохранено карт: {currentResult.count} / {currentResult.limit}</p>
              <button disabled={currentResult.count >= currentResult.limit} onClick={() => navigate("/try-free")}>Создать карту</button>
              {currentResult.count >= currentResult.limit && <p>Можно сохранить максимум 3 карты. Удалите одну из карт, чтобы создать новую.</p>}
              {currentResult.charts.length === 0 && <p>У вас пока нет сохранённых карт.</p>}
              <ul className="saved-charts-list">
                {currentResult.charts.map(chart => (
                  <li key={chart.chart_id}>
                    <h3>Карта №{chart.chart_id}</h3>
                    <p>Дата рождения: {chart.day && chart.month && chart.year ? `${String(chart.day).padStart(2, "0")}.${String(chart.month).padStart(2, "0")}.${chart.year}` : "Не указана"}</p>
                    <p>Время: {formatTime(chart.hour)}</p>
                    <p>Город: {chart.city || "Не указан"}</p>
                    <button onClick={() => navigate(`/natal-chart-result/${chart.chart_id}`)}>Открыть</button>
                    <button disabled={deleting !== null} onClick={() => deleteChart(chart.chart_id)}>
                      {deleting === chart.chart_id ? "Удаление..." : "Удалить"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <details className="local-chart-profile">
      <summary>Локальные данные профиля</summary>
      <h2>Редактирование данных натальной карты</h2>
      <form>
        <input type="text" name="name" placeholder="Имя" value={formData.name} onChange={handleChange} />
        <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} />
        <input type="time" name="birthTime" value={formData.birthTime} onChange={handleChange} />
        <input type="text" name="birthPlace" placeholder="Место рождения" value={formData.birthPlace} onChange={handleChange} />
        <button type="button" onClick={handleSave}>Сохранить изменения</button>
      </form>
      </details>
      <button onClick={() => navigate("/")}>Вернуться на главную</button>
    </div>
  );
};

export default MyCharts;
