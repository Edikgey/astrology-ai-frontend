import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ChartWheel from "./natal/ChartWheel";
import { normalizeChart } from "./natal/model";
import "./AspectsList.css";
import "./NatalChart.css";

const NatalChart = ({ bodies, aspects, houses, patterns, structuredAspects, houseSystem, zodiacMode, children, preview = false }) => {
  const model = useMemo(() => normalizeChart({ bodies, aspects, houses, patterns, structuredAspects, houseSystem, zodiacMode }), [bodies, aspects, houses, patterns, structuredAspects, houseSystem, zodiacMode]);
  const [referenceTarget, setReferenceTarget] = useState(null);
  const [summaryTarget, setSummaryTarget] = useState(null);
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 700px)').matches || false);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 700px)');
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  if (preview) return <div className="chart-preview"><ChartWheel model={model} preview /></div>;
  const placements = Object.values(bodies || {});
  const bigThree = [{ symbol: "☉", label: "Солнце", hint: "Идентичность и стремления" }, { symbol: "☽", label: "Луна", hint: "Чувства и внутренний мир" }, { symbol: "AS", label: "Асцендент", hint: "Как вы встречаете мир" }];
  const summary = <div className="chart-summary"><p className="eyebrow">Три опоры вашей карты</p><h2>Разные стороны<br />одного человека.</h2>
        {bigThree.map(item => { const body = placements.find(b => b.symbol === item.symbol); return <div className="placement" key={item.symbol}>
          <span className="placement-symbol" aria-hidden="true">{item.symbol === 'AS' ? '↗' : item.symbol}</span>
          <div><span className="placement-label">{item.label}</span><strong className="placement-sign">{body?.sign?.toLowerCase() || 'Нет данных'}</strong><p>{item.hint}{body?.house != null ? ` · Дом ${body.house}` : ''}</p></div>
        </div>; })}
        <p className="chart-system">Положения из сохранённого расчёта. Дома: {model.houseSystem || "система не передана API"}.</p>
      </div>;
  return <div className="natal-experience">
    <section className="chart-layout card" aria-label="Натальная карта и основные положения">
      <div className="chart-wrapper"><ChartWheel model={model} referenceTarget={referenceTarget} /></div>
      {mobile && summaryTarget ? createPortal(summary, summaryTarget) : summary}
    </section>
    {children}
    <div className="mobile-chart-summary card" ref={setSummaryTarget} />
    <section className="chart-details" aria-label="Подробности карты"><div className="details-heading"><p className="eyebrow">Для любопытных</p><h2>Посмотреть глубже</h2><p>Все положения и связи — в деталях вашей карты.</p></div>
      <div className="chart-reference-controls" ref={setReferenceTarget} />
      <details><summary>Планеты и дома</summary><div className="placements-grid">{placements.map((body, index) => <div className="placement-detail" key={index}><strong title={body.label}>{body.symbol}</strong><span>{body.sign || '—'}</span><span>{body.roundedDegree != null ? String(body.roundedDegree).replace(/°?$/, '°') : '—'}</span><span>{body.house != null ? `Дом ${body.house}` : 'Дом не указан'}</span></div>)}</div>
        {houses?.length > 0 && <div className="house-cusps"><h3>Куспиды домов</h3><div className="cusps-grid">{houses.map((house, index) => <p key={index}><span>Дом {house.symbol || index + 1}</span><strong>{Number.isFinite(house.degree) ? `${house.degree.toFixed(2)}°` : '—'}</strong></p>)}</div></div>}
      </details>
      <details><summary>Аспекты</summary><div className="aspects-columns">{[['major', 'Мажорные'], ['minor', 'Минорные']].map(([key, label]) => <div className="aspects-column" key={key}><h3>{label}</h3>{structuredAspects?.[key]?.length ? <ul>{structuredAspects[key].map((asp, i) => <li key={i}>{asp}</li>)}</ul> : <p className="muted">Нет сохранённых аспектов.</p>}</div>)}</div></details>
      <details><summary>Конфигурации планет</summary>{patterns?.length ? <div className="pattern-source-list">{patterns.map((pattern, index) => <p key={index}><strong>{pattern.type}</strong> · {(pattern.bodies || []).map(body => body.label || body.symbol).join(", ")}</p>)}<p>Выберите конфигурацию в управлении картой, чтобы выделить её участников.</p></div> : <p className="detail-empty">В этой карте нет сохранённых конфигураций.</p>}</details>
    </section>
  </div>;
};
export default NatalChart;
