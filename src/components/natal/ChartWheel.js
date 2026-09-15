import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RADII, ROMAN, project, buildHouseSectors, buildPlanetAnchors, layoutPlanetLabels, buildAspectEndpoints, arcPath, sectorPath } from './geometry';
import { ANGLES, ANGLE_LABELS, SIGNS, longitudeText } from './model';
import { Glyph, GlyphDefs } from './Glyphs';
import './ChartWheel.css';

const keyActivate = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
const pointLabel = point => `${point.name} · ${longitudeText(point.longitude)} · ${point.house != null ? `дом ${point.house}` : 'дом не передан'}${point.retrograde ? ' · ретроградная' : ''}`;

export default function ChartWheel({ model, preview = false, referenceTarget = null }) {
  const container = useRef(null);
  const prefix = useId().replace(/:/g, '');
  const [compact, setCompact] = useState(false);
  const [aspectMode, setAspectMode] = useState('major');
  const [showHouses, setShowHouses] = useState(true);
  const [degrees, setDegrees] = useState(true);
  const [layers, setLayers] = useState({ node: true, chiron: true, extra: false });
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!container.current) return;
    const update = () => setCompact(container.current.getBoundingClientRect().width < 440);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update); observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const clearOutside = event => { if (!container.current?.contains(event.target) && !referenceTarget?.contains(event.target)) { setSelected(null); setHover(null); } };
    document.addEventListener('pointerdown', clearOutside);
    return () => document.removeEventListener('pointerdown', clearOutside);
  }, [referenceTarget]);
  useEffect(() => { setSelected(null); setHover(null); }, [model]);
  const focus = selected || hover;
  const activePattern = focus?.kind === 'pattern' ? model.patterns.find(p => p.id === focus.id) : null;
  const activeAspect = focus?.kind === 'aspect' ? model.aspects.find(a => a.id === focus.id) : null;
  const activePoint = focus?.kind === 'point' ? model.byId[focus.id] : null;
  const focusIds = useMemo(() => {
    if (focus?.kind === 'group') return focus.members;
    if (activePattern) return activePattern.members;
    if (activeAspect) return [activeAspect.from, activeAspect.to];
    if (activePoint) return [activePoint.id, ...model.aspects.filter(a => a.from === activePoint.id || a.to === activePoint.id).flatMap(a => [a.from, a.to])];
    return [];
  }, [activePattern, activeAspect, activePoint, model.aspects, focus]);
  const visiblePoints = useMemo(() => model.points.filter(point => point.kind === 'planet' || point.kind === 'angle' || layers[point.kind] || activePattern?.members.includes(point.id) || activeAspect && [activeAspect.from, activeAspect.to].includes(point.id) || activePoint?.id === point.id), [model.points, layers, activePattern, activeAspect, activePoint]);
  const planets = useMemo(() => visiblePoints.filter(p => p.kind !== 'angle'), [visiblePoints]);
  const anchors = useMemo(() => model.ready ? buildPlanetAnchors(planets, model.asc) : [], [planets, model.asc, model.ready]);
  const sectors = useMemo(() => model.ready ? buildHouseSectors(model.cusps, model.asc) : [], [model]);
  const labels = useMemo(() => layoutPlanetLabels(anchors, model.asc, { compact, degrees, obstacles: showHouses ? sectors.map(house => ({ left: house.label.x - (compact ? 15 : 10), right: house.label.x + (compact ? 15 : 10), top: house.label.y - (compact ? 12 : 9), bottom: house.label.y + (compact ? 12 : 9) })) : [] }), [anchors, model.asc, compact, degrees, showHouses, sectors]);
  const endpoints = useMemo(() => model.ready ? buildAspectEndpoints(model.aspects, model.byId, model.asc) : [], [model]);
  const visibleIds = new Set(visiblePoints.map(p => p.id));
  const visibleAspects = endpoints.filter(a => aspectMode !== 'none' && visibleIds.has(a.from) && visibleIds.has(a.to) && (aspectMode === 'all' || a.major || activePattern?.aspects.includes(a.id)));
  const select = value => { setSelected(value); setHover(null); };
  const clear = () => { setSelected(null); setHover(null); };
  const interaction = (value, label) => preview ? {} : { role: 'button', tabIndex: 0, 'aria-label': label,
    'aria-pressed': selected?.kind === value.kind && selected?.id === value.id,
    onClick: event => { event.stopPropagation(); select(value); },
    onKeyDown: keyActivate(() => select(value)),
    onMouseEnter: () => setHover(value), onMouseLeave: () => setHover(null),
    onFocus: () => setHover(value), onBlur: () => setHover(null) };
  const pointDim = id => focusIds.length && !focusIds.includes(id) ? ' is-dim' : '';
  const aspectDim = aspect => activePattern ? !activePattern.aspects.includes(aspect.id) : activeAspect ? activeAspect.id !== aspect.id : activePoint ? aspect.from !== activePoint.id && aspect.to !== activePoint.id : focus?.kind === 'group' ? !focusIds.includes(aspect.from) && !focusIds.includes(aspect.to) : false;
  const selectedHouse = focus?.kind === 'house' ? model.cusps.find(h => h.id === focus.id) : null;
  const group = focus?.kind === 'group' ? labels.find(label => label.id === focus.id) : null;
  const aspectLabel = aspect => `${model.byId[aspect.from]?.name || aspect.from} — ${aspect.name} — ${model.byId[aspect.to]?.name || aspect.to}. Орбис: ${aspect.orb || 'не передан'}`;

  if (!model.ready) return <div className="notice" role="status">Точные данные для круга неполны. {model.issues.join(' ')} Доступные положения перечислены ниже.</div>;
  const referenceDetails = <>
      <details className="wheel-text-details"><summary>Положения и аспекты списком</summary>
        <div className="wheel-point-list">{model.points.map(point => <button type="button" key={point.id} className="button-secondary" onClick={() => select({ kind: 'point', id: point.id })}>{pointLabel(point)}</button>)}</div>
        <div className="wheel-house-list">{model.cusps.map(house => <button type="button" className="button-secondary" key={house.id} onClick={() => select({ kind: 'house', id: house.id })}>Дом {ROMAN[house.number - 1]} · {longitudeText(house.longitude)}</button>)}</div>
        <div className="wheel-aspect-list">{model.aspects.map(aspect => <button type="button" className="button-secondary" key={aspect.id} onClick={() => { setAspectMode('all'); select({ kind: 'aspect', id: aspect.id }); }}>{aspectLabel(aspect)}{!aspect.drawable && ' · нет долготы участника'}</button>)}</div>
      </details>
      {model.patterns.length > 0 && <details className="wheel-text-details"><summary>Конфигурации · {model.patterns.length}</summary><div className="pattern-focus-list">{model.patterns.map(pattern => <button className="button-secondary" type="button" key={pattern.id} disabled={!pattern.members.length} onClick={() => select({ kind: 'pattern', id: pattern.id })}>{pattern.name}<small>{pattern.sourceBodies.map(body => body.label || body.symbol).join(' · ')}</small></button>)}</div></details>}
      {model.issues.length > 0 && <details className="wheel-text-details"><summary>Доступность данных</summary><ul>{model.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
  </>;
  return <div ref={container} className={`chart-v2 ${compact ? 'is-compact' : ''} ${preview ? 'is-preview' : ''}`}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); clear(); } }}>
    {!preview && <div className="chart-toolbar" aria-label="Отображение карты">
      <button type="button" className="button-secondary" aria-pressed={showHouses} onClick={() => setShowHouses(value => !value)}>Дома</button>
      <label>Аспекты<select aria-label="Слой аспектов" value={aspectMode} onChange={event => { setAspectMode(event.target.value); clear(); }}><option value="major">Мажорные</option><option value="all">Все</option><option value="none">Без аспектов</option></select></label>
      <details className="chart-more"><summary>Ещё</summary><div>
        <label><input type="checkbox" checked={degrees} onChange={event => setDegrees(event.target.checked)} />Градусы на круге</label>
        {[['node', 'Северный узел'], ['chiron', 'Хирон'], ['extra', 'Астероиды и другие точки']].filter(([kind]) => model.points.some(p => p.kind === kind)).map(([kind, name]) => <label key={kind}><input type="checkbox" checked={layers[kind]} onChange={event => { setLayers(value => ({ ...value, [kind]: event.target.checked })); clear(); }} />{name}</label>)}
      </div></details>
    </div>}
    <svg className="natal-wheel-svg" viewBox="0 0 600 600" role="img" aria-labelledby={`${prefix}-title ${prefix}-description`} onClick={clear}>
      <title id={`${prefix}-title`}>{preview ? 'Иллюстративная натальная карта' : 'Натальная карта: точные положения, дома и аспекты'}</title>
      <desc id={`${prefix}-description`}>ASC слева. Углы и куспиды следуют долготам API. Точки на окружности — точные положения; линии ведут к подписям. Таблицы и доступные кнопки находятся под картой.</desc>
      <GlyphDefs prefix={prefix} />
      <circle cx="300" cy="300" r={RADII.outer} className="wheel-surface" />
      <circle cx="300" cy="300" r={RADII.zodiacInner} className="wheel-ring" />
      {SIGNS.map((sign, index) => {
        const outer = project(index * 30, model.asc, RADII.outer), inner = project(index * 30, model.asc, RADII.zodiacInner);
        const glyph = project(index * 30 + 15, model.asc, 255);
        return <g key={sign} className="zodiac-sign" data-sign={index}><title>{sign}</title><line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} /><Glyph id={`sign-${index}`} prefix={prefix} x={glyph.x} y={glyph.y} size={compact ? 26 : 22} /></g>;
      })}
      {Array.from({ length: 360 }, (_, degree) => {
        if (degree % 5 !== 0 && compact) return null;
        const major = degree % 10 === 0, medium = degree % 5 === 0;
        const start = project(degree, model.asc, 239), end = project(degree, model.asc, major ? 230 : medium ? 233 : 236);
        return <line key={degree} className={`degree-tick ${major ? 'major' : ''}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
      })}
      {showHouses && sectors.map(house => <g key={house.id} className={`house-sector ${selectedHouse?.id === house.id ? 'is-active' : ''}`}>
        <path className="house-hit" d={sectorPath(house.longitude, house.span, model.asc, RADII.anchor)} {...interaction({ kind: 'house', id: house.id }, `Дом ${ROMAN[house.number - 1]}. Куспид ${longitudeText(house.longitude)}`)} />
        <line className="house-ray" x1="300" y1="300" x2={house.start.x} y2={house.start.y} pointerEvents="none" data-cusp={house.longitude} />
        <text className="house-number" x={house.label.x} y={house.label.y} textAnchor="middle" dominantBaseline="central" pointerEvents="none">{ROMAN[house.number - 1]}</text>
      </g>)}
      <circle cx="300" cy="300" r={RADII.aspect} className="aspect-surface" />
      <g className="aspect-layer">{visibleAspects.map(aspect => {
        const d = aspect.type === '☌' ? `M ${aspect.start.x} ${aspect.start.y} Q ${300 + ((aspect.start.x + aspect.end.x) / 2 - 300) * .82} ${300 + ((aspect.start.y + aspect.end.y) / 2 - 300) * .82} ${aspect.end.x} ${aspect.end.y}` : `M ${aspect.start.x} ${aspect.start.y} L ${aspect.end.x} ${aspect.end.y}`;
        return <g key={aspect.id} className={`wheel-aspect ${aspect.family}${aspectDim(aspect) ? ' is-dim' : ''}${activeAspect?.id === aspect.id ? ' is-active' : ''}`} data-aspect-id={aspect.id}>
          <path className="aspect-stroke" d={d} strokeDasharray={aspect.dash} />
          {aspect.type === '☌' && <circle className="conjunction-marker" cx={aspect.start.x} cy={aspect.start.y} r="4" />}
          <path className="aspect-hit" d={d} {...interaction({ kind: 'aspect', id: aspect.id }, aspectLabel(aspect))} />
          {aspect.type === '☌' && <circle className="conjunction-hit" cx={aspect.start.x} cy={aspect.start.y} r="9" {...interaction({ kind: 'aspect', id: aspect.id }, aspectLabel(aspect))} />}
        </g>;
      })}</g>
      {activePattern?.stellium && activePattern.members.map(id => <path key={id} className="stellium-focus" d={arcPath(model.byId[id].longitude - 2, 4, model.asc, RADII.anchor + 3)} />)}
      {ANGLES.map(id => {
        const point = model.byId[id], start = project(point.longitude, model.asc, RADII.aspect + 30), end = project(point.longitude, model.asc, RADII.outer + 2), label = project(point.longitude, model.asc, RADII.angleLabel);
        return <g key={id} className={`angle-marker${pointDim(id)}`} {...interaction({ kind: 'point', id }, pointLabel(point))}>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} /><rect className="angle-label-bg" x={label.x - (compact ? 21 : 15)} y={label.y - (compact ? 14 : 10)} width={compact ? 42 : 30} height={compact ? 28 : 20} rx="3" />
          <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">{ANGLE_LABELS[id]}</text>
        </g>;
      })}
      {anchors.map(point => {
        const label = labels.find(item => item.members.includes(point.id)), inner = project(point.longitude, model.asc, RADII.anchor - 6);
        return <g key={point.id} className={`point-anchor${pointDim(point.id)}`} data-point-anchor={point.id}>
          <path d={`M ${point.anchor.x} ${point.anchor.y} L ${inner.x} ${inner.y} L ${label.x} ${label.y}`} className="anchor-leader" />
          <circle cx={point.anchor.x} cy={point.anchor.y} r="2.5" />
        </g>;
      })}
      {labels.map(label => {
        const point = model.byId[label.id], grouped = label.members.length > 1;
        return <g key={label.id} className={`planet-label${label.members.every(id => pointDim(id)) ? ' is-dim' : ''}${focusIds.includes(label.id) ? ' is-active' : ''}`}
          {...interaction({ kind: grouped ? 'group' : 'point', id: label.id, members: label.members }, grouped ? `Группа: ${label.members.map(id => model.byId[id].name).join(', ')}` : pointLabel(point))} data-label={label.id}>
          <circle className="planet-hit" cx={label.x} cy={label.y} r={compact ? 27 : 22} />
          <circle className="planet-disc" cx={label.x} cy={label.y} r={label.width / 2 + 2} />
          {grouped ? <text className="cluster-count" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">{label.members.length}</text> : <Glyph prefix={prefix} id={label.id} x={label.x} y={label.y} size={compact ? 35 : 24} />}
          {!grouped && point.retrograde && <text className="retrograde-mark" x={label.x + 13} y={label.y + 16}>R</text>}
          {!compact && degrees && !grouped && <text className="planet-degree-v2" x={label.x} y={label.y - 23} textAnchor="middle">{longitudeText(point.longitude).split(' ').slice(-1)}</text>}
        </g>;
      })}
    </svg>
    {!preview && <>
      <div className="chart-legend" aria-label="Обозначения аспектов"><span className="legend-hard">Напряжённые</span><span className="legend-soft">Гармоничные</span><span className="legend-conjunction">Соединения</span>{aspectMode === 'all' && <span className="legend-minor">Минорные</span>}</div>
      <div className="wheel-detail" aria-live="polite">
        {activePoint ? <><strong>{activePoint.name}</strong><p>{pointLabel(activePoint)}</p><small>Долгота API: {activePoint.longitude}°</small></> : activeAspect ? <><strong>{model.byId[activeAspect.from]?.name || activeAspect.from} {activeAspect.type} {model.byId[activeAspect.to]?.name || activeAspect.to}</strong><p>{activeAspect.name}{activeAspect.angle != null ? ` · ${activeAspect.angle}°` : ''} · Орбис: {activeAspect.orb || 'не передан API'}</p></> : selectedHouse ? <><strong>Дом {ROMAN[selectedHouse.number - 1]}</strong><p>Куспид: {longitudeText(selectedHouse.longitude)}</p><small>Долгота API: {selectedHouse.longitude}°</small></> : activePattern ? <><strong>{activePattern.name}</strong><p>{activePattern.members.map(id => model.byId[id].name).join(' · ')}</p><small>Выделены переданные участники и их существующие аспекты.</small></> : group ? <><strong>Плотная группа · участников: {group.members.length}</strong><div className="group-members">{group.members.map(id => <button type="button" className="button-secondary" key={id} onClick={() => select({ kind: 'point', id })}>{model.byId[id].name}</button>)}</div></> : <p>Выберите планету, угол или аспект. Точные значения появятся здесь.</p>}
        {selected && <button className="wheel-clear button-secondary" onClick={clear}>Снять выделение</button>}
      </div>
      {referenceTarget ? createPortal(referenceDetails, referenceTarget) : referenceDetails}
    </>}
  </div>;
}
