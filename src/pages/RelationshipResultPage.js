import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { relationshipRequest } from "../api/relationshipsApi";
import AskGptForm from "../components/AskGptForm";
import { LoadingState, PageHeading } from "../components/UI";
import SynastryChart from "../components/synastry/SynastryChart";
import "./Relationships.css";

const aspectNames = { "☌": "соединение", "⚹": "секстиль", "□": "квадрат", "△": "тригон", "☍": "оппозиция" };
const bodyNames = { "☉": "Солнце", "☽": "Луна", "☿": "Меркурий", "♀": "Венера", "♂": "Марс",
  "♃": "Юпитер", "♄": "Сатурн", "♅": "Уран", "♆": "Нептун", "♇": "Плутон", AS: "ASC", MC: "MC" };
const unavailable = reason => reason === "unsupported_or_missing_house_system"
  ? "Дома недоступны: в сохранённых данных нет поддерживаемой системы домов."
  : "Дома недоступны: в сохранённой карте не хватает проверенных куспидов.";

export default function RelationshipResultPage() {
  const { relationshipId } = useParams();
  const navigate = useNavigate();
  const [relationship, setRelationship] = useState(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRelationship(null); setError("");
    if (!/^[1-9]\d*$/.test(String(relationshipId))) { setError("Разбор отношений не выбран."); return () => controller.abort(); }
    relationshipRequest(`/${relationshipId}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRelationship(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [relationshipId, reload]);

  const remove = async () => {
    if (deleting || !window.confirm("Удалить этот разбор и всю историю разговора? Обе натальные карты останутся в вашем аккаунте.")) return;
    setDeleting(true); setError("");
    try { await relationshipRequest(`/${relationshipId}`, { method: "DELETE" }); navigate("/my-charts", { replace: true }); }
    catch (err) { setError(err.message); setDeleting(false); }
  };

  if (error && !relationship) return <div className="relationship-page page result-error">
    <h1>Разбор отношений недоступен</h1><p role="alert">{error}</p>
    <div className="button-row"><button onClick={() => setReload(value => value + 1)}>Повторить</button><Link className="button button-secondary" to="/my-charts">В личное пространство</Link></div>
  </div>;
  if (!relationship) return <div className="relationship-page page"><LoadingState text="Загрузка разбора отношений..." /></div>;

  const calculation = relationship.calculation || {};
  const aspects = Array.isArray(calculation.aspects) ? calculation.aspects : [];
  const overlays = Array.isArray(calculation.house_overlays) ? calculation.house_overlays : [];
  const label = person => person === "A" ? relationship.person_a_label : relationship.person_b_label;
  const angles = aspects.filter(row => [row.body_a, row.body_b].some(body => body === "AS" || body === "MC"));

  return <div className="relationship-page relationship-result page">
    <PageHeading eyebrow="Разбор отношений" title={`${relationship.person_a_label} + ${relationship.person_b_label}`}>
      <p>Почему вас так тянет друг к другу — и почему вам бывает сложно вместе? Исследуйте динамику бережно, без оценок и предсказаний.</p>
    </PageHeading>
    {error && <p role="alert">{error}</p>}
    <SynastryChart key={relationship.id} relationship={relationship} />
    <section className="relationship-chat" aria-label="Разговор о ваших отношениях">
      <AskGptForm subjectType="relationship" relationshipId={relationship.id}
        heading={<>Поговорите с Lunaria <span>о ваших отношениях</span></>}
        subtitle={`Разговор ${relationship.person_a_label} + ${relationship.person_b_label} хранится отдельно от ваших натальных чатов.`}
        intro="Разбор готов. С чего начнём: с притяжения, общения, эмоциональных потребностей или сложных моментов?" />
    </section>
    <section className="relationship-details" aria-labelledby="relationship-details-title">
      <div className="relationship-section-heading"><div><span className="eyebrow">Сохранённые факты</span><h2 id="relationship-details-title">Детали разбора</h2></div>
        <span className="badge">Правила: {relationship.ruleset_version}</span></div>
      <details><summary>Основные аспекты между картами ({aspects.length})</summary>
        {aspects.length ? <ul className="relationship-facts">{aspects.map((row, index) => <li key={`${row.participant_a}-${row.body_a}-${row.participant_b}-${row.body_b}-${row.aspect}-${index}`}>
          <strong>{label(row.participant_a)} · {bodyNames[row.body_a] || row.body_a}</strong>
          <span>{aspectNames[row.aspect] || row.aspect}</span>
          <strong>{label(row.participant_b)} · {bodyNames[row.body_b] || row.body_b}</strong>
          {Number.isFinite(row.orb_deg) && <small>орб {row.orb_deg.toFixed(2)}°</small>}
        </li>)}</ul> : <p className="relationship-detail-empty">В сохранённых данных нет межкарточных мажорных аспектов.</p>}
      </details>
      <details><summary>ASC и MC ({angles.length})</summary>
        {angles.length ? <ul className="relationship-facts">{angles.map((row, index) => <li key={`angle-${index}`}>
          <strong>{label(row.participant_a)} · {bodyNames[row.body_a] || row.body_a}</strong><span>{aspectNames[row.aspect] || row.aspect}</span>
          <strong>{label(row.participant_b)} · {bodyNames[row.body_b] || row.body_b}</strong></li>)}</ul>
          : <p className="relationship-detail-empty">Доступных взаимодействий с ASC или MC нет.</p>}
      </details>
      <details><summary>Планеты в домах партнёра</summary>
        <div className="relationship-overlays">{overlays.map((overlay, index) => <section key={`${overlay.planet_participant}-${overlay.house_participant}-${index}`}>
          <h3>{label(overlay.planet_participant)} в домах {label(overlay.house_participant)}</h3>
          {overlay.available ? <ul>{(overlay.placements || []).map(row => <li key={row.body}>{bodyNames[row.body] || row.body} — дом {row.house}</li>)}</ul>
            : <p>{unavailable(overlay.reason)}</p>}
        </section>)}</div>
      </details>
      <p className="relationship-limitation">Это структурированные астрологические данные, а не оценка совместимости или предсказание будущего пары.</p>
    </section>
    <div className="relationship-result-actions"><Link className="button button-secondary" to="/my-charts">Все карты и разборы</Link>
      <button type="button" className="button-danger" disabled={deleting} onClick={remove}>{deleting ? "Удаление..." : "Удалить разбор"}</button></div>
  </div>;
}
