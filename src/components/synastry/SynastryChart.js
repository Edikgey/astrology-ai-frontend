import React, { memo, useId, useMemo, useState } from 'react';
import { Glyph, GlyphDefs } from '../natal/Glyphs';
import { SIGNS, longitudeText } from '../natal/model';
import { normalizeDegrees, ROMAN } from '../natal/geometry';
import { normalizeSynastry, orbText } from './model';
import { pointAt, layoutSynastry } from './geometry';
import './SynastryChart.css';

const activation = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
const line = (start, end) => ({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });

const Rings = memo(function Rings({ model, prefix }) {
  return <g className="synastry-rings" aria-hidden="true">
    <circle cx={360} cy={360} r={344} className="synastry-zodiac-surface" />
    <circle cx={360} cy={360} r={304} className="synastry-wheel-surface" />
    {[307, 230, 114].map(radius => <circle key={radius} cx={360} cy={360} r={radius} className="synastry-ring" />)}
    {SIGNS.map((name, index) => {
      const marker = pointAt(index * 30 + 15, model.reference, 324);
      return <g key={name} data-synastry-sign={index}>
        <line {...line(pointAt(index * 30, model.reference, 304), pointAt(index * 30, model.reference, 344))} />
        <Glyph id={`sign-${index}`} prefix={prefix} {...marker} size={26} />
      </g>;
    })}
    {model.cusps?.map((longitude, index) => {
      const span = normalizeDegrees(model.cusps[(index + 1) % 12] - longitude);
      const label = pointAt(longitude + span / 2, model.reference, 124);
      return <g key={index} data-synastry-cusp={index + 1}>
        <line className="synastry-cusp" {...line(pointAt(longitude, model.reference, 114), pointAt(longitude, model.reference, 304))} />
        <text {...label} className="synastry-house">{ROMAN[index]}</text>
      </g>;
    })}
    {Object.entries(model.angles).map(([body, longitude]) => <g key={body} data-synastry-angle={body}>
      <line className="synastry-angle" {...line(pointAt(longitude, model.reference, 114), pointAt(longitude, model.reference, 304))} />
      <text {...pointAt(longitude, model.reference, 101)} className="synastry-angle-label">{body === 'AS' ? 'ASC' : 'MC'}</text>
    </g>)}
  </g>;
});

export default function SynastryChart({ relationship }) {
  const model = useMemo(() => normalizeSynastry(relationship?.calculation), [relationship?.calculation]);
  const geometry = useMemo(() => model ? layoutSynastry(model) : null, [model]);
  const prefix = `synastry-${useId().replace(/:/g, '')}`;
  const [selection, setSelection] = useState(null);
  const selected = selection?.model === model && selection?.relationshipId === relationship?.id ? selection : null;
  const select = value => setSelection({ ...value, model, relationshipId: relationship?.id });
  const labels = { A: relationship?.person_a_label || 'Участник A', B: relationship?.person_b_label || 'Участник B' };
  const pointName = point => `${labels[point.person]} · ${point.name}`;
  const activeAspect = selected?.kind === 'aspect' ? model.aspects.find(aspect => aspect.id === selected.id) : null;
  const activeIds = activeAspect ? [activeAspect.from, activeAspect.to] : selected?.members || [];
  const pointDetail = point => <div key={point.id} className={`synastry-point-detail person-${point.person}`}>
    <p className="synastry-detail-person">{labels[point.person]}</p>
    <h3>{point.name}</h3><p>{longitudeText(point.longitude)}</p>
    {model.overlays[point.id] && <p className="synastry-overlay">{point.name} · {labels[point.person]} — {ROMAN[model.overlays[point.id].house - 1]} дом · {labels[model.overlays[point.id].person]}</p>}
  </div>;
  const aspectName = aspect => `${pointName(model.byId[aspect.from])} · ${aspect.type} ${aspect.name} · ${pointName(model.byId[aspect.to])} · орб ${orbText(aspect.orb)}`;

  return <section className="synastry-chart" aria-labelledby={`${prefix}-title`} onKeyDown={event => { if (event.key === 'Escape') setSelection(null); }}>
    <div className="synastry-heading"><span className="eyebrow">Две карты · один круг</span><h2 id={`${prefix}-title`}>Карта взаимодействия</h2></div>
    {!model || !model.points.length ? <p role="status">Для визуализации не хватает сохранённых положений планет. Разговор и доступные детали остаются ниже.</p> : <>
      <ul className="synastry-legend" aria-label="Участники карты">{['A', 'B'].map(person => <li key={person} className={`person-${person}`}>
        <span className="synastry-legend-marker" aria-hidden="true" /><span>{labels[person]}<small>{person === 'A' ? 'Внутренний круг · залитые маркеры' : 'Внешний круг · контурные маркеры'}</small></span>
      </li>)}</ul>
      <div className="synastry-layout">
        <div className="synastry-wheel">
          <svg viewBox="0 0 720 720" className="synastry-svg" role="group" aria-labelledby={`${prefix}-svg-title`}>
            <title id={`${prefix}-svg-title`}>Синастрия: {labels.A} и {labels.B}. Точки — точные положения; линии ведут к подписям.</title>
            <GlyphDefs prefix={prefix} /><Rings model={model} prefix={prefix} />
            <g className="synastry-aspects">{[...geometry.aspects].sort((a, b) => Number(a.id === activeAspect?.id) - Number(b.id === activeAspect?.id)).map(aspect => {
              const active = activeAspect ? aspect.id === activeAspect.id : activeIds.includes(aspect.from) || activeIds.includes(aspect.to);
              return <g key={aspect.id} data-synastry-aspect={aspect.id} className={`synastry-aspect ${aspect.family}${active ? ' is-selected' : selected ? ' is-dim' : ''}`}
                role="button" tabIndex={0} aria-label={aspectName(aspect)} aria-pressed={aspect.id === activeAspect?.id}
                onClick={() => select({ kind: 'aspect', id: aspect.id })} onKeyDown={activation(() => select({ kind: 'aspect', id: aspect.id }))}>
                <line {...line(aspect.start, aspect.end)} className="synastry-aspect-line" strokeDasharray={aspect.dash} />
                <line {...line(aspect.start, aspect.end)} className="synastry-aspect-hit" />
              </g>;
            })}</g>
            {geometry.labels.map(label => <g key={`leaders-${label.id}`} aria-hidden="true">{label.members.map(id => {
              const anchor = geometry.anchors.find(point => point.id === id);
              return <line key={id} {...line(label, anchor)} className={`synastry-leader person-${label.person}${activeIds.includes(id) ? ' is-selected' : ''}`} />;
            })}</g>)}
            {geometry.anchors.map(anchor => <g key={anchor.id} data-synastry-anchor={anchor.id} data-longitude={anchor.longitude}
              className={`synastry-anchor person-${anchor.person}${activeIds.includes(anchor.id) ? ' is-selected' : ''}`} aria-hidden="true">
              <circle cx={anchor.x} cy={anchor.y} r={activeIds.includes(anchor.id) ? 6 : 3} />
              {activeIds.includes(anchor.id) && <line {...line(pointAt(anchor.longitude, model.reference, 114), anchor)} className="synastry-exact-guide" />}
            </g>)}
            {geometry.labels.map(label => {
              const grouped = label.members.length > 1, active = label.members.some(id => activeIds.includes(id));
              const action = () => select({ kind: grouped ? 'group' : 'planet', members: label.members });
              return <g key={label.id} data-synastry-label={label.id} data-members={label.members.join(',')}
                transform={`translate(${label.x} ${label.y})`} className={`synastry-planet person-${label.person}${active ? ' is-selected' : ''}`}
                role="button" tabIndex={0} aria-pressed={active} aria-label={grouped ? `${labels[label.person]} · группа: ${label.members.map(id => model.byId[id].name).join(', ')}` : `${pointName(model.byId[label.id])} · ${longitudeText(model.byId[label.id].longitude)}`}
                onClick={action} onKeyDown={activation(action)}>
                <circle r={33} className="synastry-planet-hit" /><circle r={25} className="synastry-marker" />
                <Glyph id={model.byId[label.id].body} prefix={prefix} x={grouped ? -5 : 0} y={0} size={30} />
                {grouped && <text x={18} y={-18} className="synastry-group-count">{label.members.length}</text>}
              </g>;
            })}
          </svg>
          <p className="synastry-frame">{model.angles.AS !== undefined ? `ASC · ${labels.A} слева.` : 'ASC недоступен: 0° Овна слева.'} {model.cusps ? `Дома Placidus · ${labels.A}.` : 'Дома не показаны: нет полного reference участника A.'} Планеты обоих участников — по сохранённым долготам.</p>
        </div>
        <div className="synastry-detail" aria-label="Детали выбранного объекта" aria-live="polite" aria-atomic="true">
          {!selected && <><span className="eyebrow">Посмотрите ближе</span><h3>Что связывает ваши карты?</h3><p>Нажмите на планету или аспект, чтобы посмотреть детали взаимодействия.</p></>}
          {selected?.kind === 'planet' && pointDetail(model.byId[activeIds[0]])}
          {selected?.kind === 'group' && <><p className="synastry-detail-person">{labels[model.byId[activeIds[0]].person]}</p><h3>Близкие положения</h3><p>Точные точки всех участников группы подсвечены на круге.</p>
            <div className="synastry-group-members">{activeIds.map(id => <button type="button" key={id} onClick={() => select({ kind: 'planet', members: [id] })}>{model.byId[id].body} {model.byId[id].name}<small>{longitudeText(model.byId[id].longitude)}</small></button>)}</div>
          </>}
          {activeAspect && <><span className="eyebrow">Межкартовый аспект</span><h3>{activeAspect.type} {activeAspect.name}</h3>
            <p>{pointName(model.byId[activeAspect.from])}<br />{pointName(model.byId[activeAspect.to])}</p><p>Орб: {orbText(activeAspect.orb)}</p></>}
          {selected && <button type="button" className="synastry-clear" onClick={() => setSelection(null)}>Снять выделение</button>}
        </div>
      </div>
      {model.incomplete && <p role="status" className="synastry-frame">Часть положений планет отсутствует в сохранённых данных.</p>}
      <details className="synastry-aspect-picker"><summary>Межкартовые аспекты планет ({model.aspects.length})</summary>
        <p>Только связи между двумя картами. Список помогает выбрать линии, которые пересекаются на круге.</p>
        <div>{model.aspects.map(aspect => <button key={aspect.id} type="button" aria-pressed={activeAspect?.id === aspect.id} onClick={() => select({ kind: 'aspect', id: aspect.id })}>{aspectName(aspect)}</button>)}</div>
      </details>
    </>}
  </section>;
}
