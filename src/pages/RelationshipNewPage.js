import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chartRequest } from "../api/chartsApi";
import { chartPresentation } from "../api/chartPresentation";
import { relationshipRequest } from "../api/relationshipsApi";
import { useUsage } from "../context/UsageContext";
import { EmptyState, LoadingState, OrbitMark, PageHeading } from "../components/UI";
import "./Relationships.css";

const labelFor = chart => chartPresentation(chart.chart_id).name || `Карта №${chart.chart_id}`;

export default function RelationshipNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usage, handleLimitError } = useUsage();
  const draft = location.state?.relationshipDraft || {};
  const createdChartId = Number(location.state?.createdChartId) || null;
  const [charts, setCharts] = useState(null);
  const [chartA, setChartA] = useState(draft.chartAId ? String(draft.chartAId) : "");
  const [chartB, setChartB] = useState(draft.chartBId ? String(draft.chartBId) : "");
  const [labelA, setLabelA] = useState(draft.labelA || "");
  const [labelB, setLabelB] = useState(draft.labelB || "");
  const [speaker, setSpeaker] = useState(draft.speaker || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    chartRequest("/natal-charts", { authenticated: true, signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setCharts(data.charts || []);
        const ids = new Set((data.charts || []).map(chart => chart.chart_id));
        const nextA = ids.has(Number(chartA)) ? Number(chartA) : null;
        const nextB = ids.has(createdChartId) && createdChartId !== nextA ? createdChartId :
          ids.has(Number(chartB)) && Number(chartB) !== nextA ? Number(chartB) : null;
        if (nextA) setChartA(String(nextA));
        if (nextB) setChartB(String(nextB));
        const a = data.charts?.find(chart => chart.chart_id === nextA);
        const b = data.charts?.find(chart => chart.chart_id === nextB);
        if (a && !labelA) setLabelA(labelFor(a));
        if (b && (!labelB || createdChartId === nextB)) setLabelB(labelFor(b));
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);

  const byId = useMemo(() => new Map((charts || []).map(chart => [String(chart.chart_id), chart])), [charts]);
  const choose = (person, value) => {
    const chart = byId.get(value);
    if (person === "A") {
      setChartA(value);
      if (chart) setLabelA(labelFor(chart));
      if (value === chartB) setChartB("");
    } else {
      setChartB(value);
      if (chart) setLabelB(labelFor(chart));
      if (value === chartA) setChartA("");
    }
    setError("");
  };
  const draftState = () => ({ chartAId: Number(chartA) || null, chartBId: Number(chartB) || null,
    labelA, labelB, speaker });
  const addPerson = () => {
    const limitReached = usage && usage.saved_charts_used >= usage.saved_charts_limit;
    if (limitReached) {
      handleLimitError({ code: "chart_limit_reached", detail: { used: usage.saved_charts_used,
        limit: usage.saved_charts_limit, plan: usage.plan } });
      return;
    }
    navigate("/try-free", { state: { returnTo: "/relationships/new", relationshipDraft: draftState() } });
  };
  const submit = async event => {
    event.preventDefault();
    if (!chartA || !chartB || chartA === chartB) { setError("Выберите две разные натальные карты."); return; }
    if (!labelA.trim() || !labelB.trim()) { setError("Укажите имена обоих участников."); return; }
    setLoading(true); setError("");
    try {
      const result = await relationshipRequest("", { method: "POST", body: {
        chart_a_id: Number(chartA), chart_b_id: Number(chartB), person_a_label: labelA.trim(),
        person_b_label: labelB.trim(), speaker_person: speaker || null,
      } });
      navigate(`/relationships/${result.id}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return <div className="relationship-page page">
    <PageHeading eyebrow="Lunaria для двоих" title="Разбор отношений">
      <p>Выберите две натальные карты, чтобы Lunaria помогла разобраться в динамике ваших отношений.</p>
    </PageHeading>
    {error && <p role="alert">{error}</p>}
    {!charts && !error && <LoadingState text="Загрузка ваших карт..." />}
    {charts && charts.length < 2 && <EmptyState title={charts.length ? "Нужна ещё одна карта" : "Сначала создайте две карты"}>
      <p>{charts.length ? "Добавьте обычную натальную карту второго человека — она останется в разделе «Мои карты»." : "Для разбора отношений нужны две сохранённые натальные карты."}</p>
      <button type="button" onClick={addPerson}>Добавить карту другого человека</button>
    </EmptyState>}
    {charts && charts.length >= 2 && <form className="relationship-create card" onSubmit={submit} aria-busy={loading}>
      <div className="relationship-selectors">
        {[["A", chartA, labelA], ["B", chartB, labelB]].map(([person, selected, label]) => <fieldset key={person}>
          <legend><OrbitMark /> Человек {person}</legend>
          <label htmlFor={`relationship-chart-${person}`}>Натальная карта</label>
          <select id={`relationship-chart-${person}`} value={selected} onChange={event => choose(person, event.target.value)} required>
            <option value="">Выберите карту</option>
            {charts.map(chart => <option key={chart.chart_id} value={chart.chart_id}
              disabled={(person === "A" ? chartB : chartA) === String(chart.chart_id)}>{labelFor(chart)}</option>)}
          </select>
          <label htmlFor={`relationship-label-${person}`}>Имя в разборе</label>
          <input id={`relationship-label-${person}`} value={label} maxLength={100} required
            onChange={event => person === "A" ? setLabelA(event.target.value) : setLabelB(event.target.value)} />
          <label className="speaker-choice"><input type="radio" name="speaker" checked={speaker === person}
            onChange={() => setSpeaker(person)} /> Это я</label>
        </fieldset>)}
      </div>
      <p className="field-hint">Имена помогают Lunaria различать участников. Личность определяется выбранной картой.</p>
      <div className="button-row"><button type="submit" disabled={loading}>{loading ? "Создаём разбор..." : "Начать разбор"}</button>
        <button type="button" className="button-secondary" onClick={addPerson}>Добавить карту другого человека</button></div>
    </form>}
  </div>;
}
