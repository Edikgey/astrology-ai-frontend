import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { useBilling } from "../context/BillingContext";
import { chartRequest } from "../api/chartsApi";
import { relationshipRequest } from "../api/relationshipsApi";
import { LoadingState, OrbitMark, PageHeading } from "../components/UI";
import { chartPresentation } from "../api/chartPresentation";
import "./MyCharts.css";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const chartTitle = chart => chartPresentation(chart.chart_id).name || "Натальная карта";

const formatDate = chart => {
  if (!chart.day || !chart.month || !chart.year || !MONTHS[chart.month - 1]) return "Дата рождения не указана";
  return `${chart.day} ${MONTHS[chart.month - 1]} ${chart.year}`;
};

const formatTime = hour => {
  if (hour == null) return null;
  const totalMinutes = Math.round(hour * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
};

function AccountStatus() {
  const { usage, usageLoading, usageError, refreshUsage, openUpgrade } = useUsage();
  const billing = useBilling();

  if (usageError) return <aside className="dashboard-plan dashboard-plan-error" aria-label="Статус аккаунта">
    <div><p className="dashboard-kicker">Статус аккаунта</p><p role="alert">
      {usageError.status === 401 ? "Сессия истекла. Войдите снова." : "Не удалось обновить данные плана."}
    </p></div>
    {usageError.status === 401 ? <Link to="/authorization">Войти</Link> :
      <button type="button" className="button-secondary" onClick={refreshUsage}>Повторить</button>}
  </aside>;

  if (!usage) return usageLoading ? <aside className="dashboard-plan" aria-label="Статус аккаунта" aria-busy="true">
    <div><p className="dashboard-kicker">Статус аккаунта</p><p role="status">Загрузка данных плана…</p></div>
  </aside> : null;

  const premium = usage.plan === "premium";
  const hasAvailable = Number.isFinite(usage.gpt_messages_available) && Number.isFinite(usage.gpt_messages_limit);
  return <aside className="dashboard-plan" aria-label="Статус аккаунта" aria-busy={usageLoading}>
    <div className="dashboard-plan-copy">
      <p className="dashboard-kicker">{premium ? "Premium" : "Free"}</p>
      <strong>{premium ? "Premium" : "Бесплатный план"}</strong>
      {hasAvailable && <p>Осталось {usage.gpt_messages_available} из {usage.gpt_messages_limit} AI-вопросов
        {usage.gpt_limit_type === "billing_period" ? " в текущем периоде" : " за всё время аккаунта"}.</p>}
      {!hasAvailable && Number.isFinite(usage.gpt_messages_used) && Number.isFinite(usage.gpt_messages_limit) &&
        <p>Использовано {usage.gpt_messages_used} из {usage.gpt_messages_limit} AI-вопросов.</p>}
      {premium && !usage.gpt_period_valid && <p className="dashboard-plan-note">Доступ к AI возобновится после обновления расчётного периода.</p>}
      {usage.cancel_at_period_end && <p className="dashboard-plan-note">Продление подписки отключено.</p>}
      {usage.subscription_status === "past_due" && <p className="dashboard-plan-note">Нужно обновить способ оплаты.</p>}
      {billing.message && <p role="status" className="dashboard-plan-note">{billing.message}</p>}
      {billing.error && <p role="alert">{billing.error}</p>}
    </div>
    {!premium && <button type="button" className="button-secondary" onClick={openUpgrade}>Перейти на Premium</button>}
    {premium && usage.can_manage_subscription && <button type="button" className="button-secondary"
      disabled={billing.busy} onClick={billing.manageSubscription}>Управление подпиской</button>}
  </aside>;
}

function CardMenu({ label, deleting, onDelete, deleteLabel }) {
  return <details className="dashboard-card-menu">
    <summary aria-label={label}><span className="dashboard-menu-dots" aria-hidden="true"><span /><span /><span /></span></summary>
    <div className="dashboard-card-menu-popover">
      <button type="button" className="button-danger" disabled={deleting} onClick={onDelete}>
        {deleting ? "Удаление…" : deleteLabel}
      </button>
    </div>
  </details>;
}

export default function MyCharts() {
  const { user } = useAuth();
  const { usage, refreshUsage, handleLimitError } = useUsage();
  const token = localStorage.getItem("access_token");
  const hasToken = Boolean(token && token !== "null");
  const [result, setResult] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingRelationship, setDeletingRelationship] = useState(null);
  const [actionError, setActionError] = useState("");
  const [reload, setReload] = useState(0);
  const [formData, setFormData] = useState({ name: "", birthDate: "", birthTime: "", birthPlace: "" });
  const navigate = useNavigate();
  const currentResult = result?.token === token ? result : null;
  const charts = currentResult?.charts?.charts || [];
  const relationships = currentResult?.relationships?.relationships || [];
  const savedCount = usage?.saved_charts_used ?? currentResult?.charts?.count;
  const savedLimit = usage?.saved_charts_limit ?? currentResult?.charts?.limit;
  const chartLimitReached = Number.isFinite(savedCount) && Number.isFinite(savedLimit) && savedCount >= savedLimit;

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setActionError("");
    if (hasToken) {
      Promise.allSettled([
        chartRequest("/natal-charts", { authenticated: true, signal: controller.signal }),
        relationshipRequest("", { signal: controller.signal }),
      ]).then(([chartsResult, relationshipsResult]) => {
        if (controller.signal.aborted) return;
        setResult({
          token,
          charts: chartsResult.status === "fulfilled" ? chartsResult.value : null,
          chartError: chartsResult.status === "rejected" ? chartsResult.reason : null,
          relationships: relationshipsResult.status === "fulfilled" ? relationshipsResult.value : null,
          relationshipError: relationshipsResult.status === "rejected" ? relationshipsResult.reason : null,
        });
        refreshUsage();
      });
    }
    return () => controller.abort();
  }, [token, hasToken, user?.id, reload, refreshUsage]);

  useEffect(() => {
    const savedData = localStorage.getItem("userData");
    if (savedData) {
      try { setFormData(JSON.parse(savedData)); } catch { /* Optional device data may be malformed. */ }
    }
  }, []);

  const retry = () => setReload(value => value + 1);
  const createChart = () => {
    if (chartLimitReached) {
      handleLimitError({ code: "chart_limit_reached", detail: { used: savedCount, limit: savedLimit, plan: usage?.plan } });
      return;
    }
    navigate("/try-free");
  };

  const deleteChart = async chart => {
    const title = chartTitle(chart);
    if (deleting !== null || !window.confirm(`Удалить карту «${title}» и всю историю разговора? Это действие нельзя отменить.`)) return;
    setDeleting(chart.chart_id);
    setActionError("");
    try {
      await chartRequest(`/natal-chart/${chart.chart_id}`, { method: "DELETE", authenticated: true });
      refreshUsage();
      if (localStorage.getItem("chart_id") === String(chart.chart_id)) {
        localStorage.removeItem("chart_id");
        localStorage.removeItem("natalChart");
      }
      setReload(value => value + 1);
    } catch (error) {
      if (error.code === "relationship_dependencies_exist") {
        setActionError("Эта карта используется в разборе отношений. Сначала удалите связанный разбор отношений.");
      } else setActionError(error.message);
    } finally { setDeleting(null); }
  };

  const deleteRelationship = async relationship => {
    if (deletingRelationship !== null || !window.confirm(
      `Удалить разбор «${relationship.person_a_label} + ${relationship.person_b_label}» и всю историю разговора? Исходные натальные карты сохранятся.`
    )) return;
    setDeletingRelationship(relationship.id);
    setActionError("");
    try {
      await relationshipRequest(`/${relationship.id}`, { method: "DELETE" });
      setReload(value => value + 1);
    } catch (error) { setActionError(error.message); }
    finally { setDeletingRelationship(null); }
  };

  const handleProfileChange = event => setFormData(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const saveProfile = () => {
    localStorage.setItem("userData", JSON.stringify(formData));
    window.alert("Данные сохранены на этом устройстве.");
  };

  return <div className="charts-container dashboard-page page">
    <PageHeading eyebrow="Личное пространство" title="Ваше пространство">
      <p>Ваши карты, разговоры и разборы отношений — в одном месте.</p>
    </PageHeading>

    {!hasToken || currentResult?.chartError?.status === 401 ? <section className="dashboard-sign-in">
      <h2>Войдите в аккаунт</h2>
      <p>После входа здесь появятся ваши карты и разборы отношений.</p>
      <Link className="button" to="/authorization">Войти</Link>
    </section> : <>
      <section className="dashboard-next" aria-labelledby="dashboard-next-title">
        <div>
          <p className="dashboard-kicker">Следующий шаг</p>
          <h2 id="dashboard-next-title">Что вы хотите исследовать?</h2>
          <p>Создайте новую карту или посмотрите динамику отношений по уже сохранённым данным.</p>
        </div>
        <div className="dashboard-next-actions">
          <button type="button" onClick={createChart}>{chartLimitReached ? "Лимит карт достигнут" : "Создать новую карту"}</button>
          {charts.length > 0 && <Link className="button button-secondary" to="/relationships/new">Разобрать отношения</Link>}
        </div>
      </section>

      <AccountStatus />
      {actionError && <p className="dashboard-action-error" role="alert">{actionError}</p>}
      {!currentResult && <LoadingState text="Загрузка вашего пространства…" />}

      {currentResult && <>
        <section className="dashboard-section" aria-labelledby="dashboard-charts-title">
          <header className="dashboard-section-heading">
            <div><p className="dashboard-kicker">Натальные карты</p><h2 id="dashboard-charts-title">Мои карты</h2>
              {Number.isFinite(savedCount) && Number.isFinite(savedLimit) && <p>{savedCount} из {savedLimit} сохранено</p>}</div>
            <button type="button" className="button-secondary" onClick={createChart}>+ Новая карта</button>
          </header>

          {currentResult.chartError ? <div className="dashboard-section-error">
            <p role="alert">Не удалось загрузить карты. Попробуйте ещё раз.</p>
            <button type="button" className="button-secondary" onClick={retry}>Повторить загрузку</button>
          </div> : charts.length === 0 ? <div className="dashboard-empty dashboard-empty-primary">
            <OrbitMark /><h3>Начните с первой карты</h3>
            <p>Создайте натальную карту, чтобы поговорить с Lunaria о себе, отношениях, работе и важных решениях.</p>
            <button type="button" onClick={createChart}>Создать мою карту</button>
          </div> : <ul className="dashboard-card-grid saved-charts-list">
            {charts.map(chart => {
              const title = chartTitle(chart);
              const time = formatTime(chart.hour);
              return <li key={chart.chart_id}>
                <div className="dashboard-card-type"><OrbitMark /><span>Натальная карта</span></div>
                <h3>{title}</h3>
                <p className="dashboard-card-meta">{formatDate(chart)}{time ? ` · ${time}` : ""}</p>
                {chart.city && <p className="dashboard-card-place">{chart.city}</p>}
                <div className="dashboard-card-actions">
                  <Link className="dashboard-card-link" to={`/natal-chart-result/${chart.chart_id}`}>Открыть карту <span aria-hidden="true">→</span></Link>
                  <CardMenu label={`Действия с картой «${title}»`} deleting={deleting === chart.chart_id}
                    deleteLabel="Удалить карту" onDelete={() => deleteChart(chart)} />
                </div>
              </li>;
            })}
          </ul>}
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-relationships-title">
          <header className="dashboard-section-heading">
            <div><p className="dashboard-kicker">Для двоих</p><h2 id="dashboard-relationships-title">Разборы отношений</h2>
              <p>Исследуйте общение, притяжение и сложные моменты.</p></div>
            {charts.length > 0 && <Link className="button button-secondary" to="/relationships/new">+ Новый разбор</Link>}
          </header>

          {currentResult.relationshipError ? <div className="dashboard-section-error">
            <p role="alert">Не удалось загрузить разборы отношений. Ваши карты по-прежнему доступны.</p>
            <button type="button" className="button-secondary" onClick={retry}>Повторить загрузку</button>
          </div> : relationships.length === 0 ? <div className="dashboard-empty dashboard-empty-compact">
            <h3>{charts.length === 0 ? "Для разбора отношений понадобятся две карты" :
              charts.length === 1 ? "Добавьте карту второго человека" : "Посмотрите на отношения с новой стороны"}</h3>
            <p>{charts.length === 0 ? "Начните с собственной натальной карты. Карту второго человека можно будет добавить позже." :
              charts.length === 1 ? "Сохраните карту второго человека, чтобы посмотреть динамику ваших отношений." :
              "Выберите две сохранённые карты, чтобы создать отдельный разбор отношений."}</p>
            {charts.length > 0 && <Link className="button button-secondary" to="/relationships/new">Создать разбор отношений</Link>}
          </div> : <ul className="dashboard-card-grid relationship-cards">
            {relationships.map(relationship => {
              const title = `${relationship.person_a_label} + ${relationship.person_b_label}`;
              return <li key={relationship.id}>
                <div className="dashboard-card-type"><OrbitMark /><span>Отношения</span></div>
                <h3>{title}</h3>
                <p className="dashboard-card-meta">Карта взаимодействия</p>
                <div className="dashboard-card-actions">
                  <Link className="dashboard-card-link" to={`/relationships/${relationship.id}`}>Открыть разбор <span aria-hidden="true">→</span></Link>
                  <CardMenu label={`Действия с разбором «${title}»`} deleting={deletingRelationship === relationship.id}
                    deleteLabel="Удалить разбор" onDelete={() => deleteRelationship(relationship)} />
                </div>
              </li>;
            })}
          </ul>}
        </section>
      </>}
    </>}

    <details className="local-chart-profile">
      <summary>Данные для следующей карты</summary>
      <p className="muted">Сохраняются только на этом устройстве и не изменяют готовые карты.</p>
      <form>
        <input type="text" aria-label="Имя" name="name" placeholder="Имя" value={formData.name} onChange={handleProfileChange} />
        <input type="date" aria-label="Дата рождения" name="birthDate" value={formData.birthDate} onChange={handleProfileChange} />
        <input type="time" aria-label="Время рождения" name="birthTime" value={formData.birthTime} onChange={handleProfileChange} />
        <input type="text" aria-label="Место рождения" name="birthPlace" placeholder="Место рождения" value={formData.birthPlace} onChange={handleProfileChange} />
        <button type="button" onClick={saveProfile}>Сохранить на устройстве</button>
      </form>
    </details>
    <Link className="back-home" to="/">Вернуться на главную</Link>
  </div>;
}
