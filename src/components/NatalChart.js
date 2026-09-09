import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import PatternVisualizer from "./PatternVisualizer";
import "./AspectsList.css";
import "./NatalChart.css";

// Основной компонент, получающий данные карты
const NatalChart = ({ bodies, aspects, houses, patterns, structuredAspects, children }) => {
  const ref = useRef();

  const [visiblePlanets, setVisiblePlanets] = useState(() => {
    const initial = {};
    Object.values(bodies).forEach((b) => {
      initial[b.symbol] = true;
    });
    return initial;
  });
  
  const [visibleAspects, setVisibleAspects] = useState(() => {
    const initial = {};
    aspects?.forEach((asp) => {
      initial[asp.aspect] = true;
    });
    return initial;
  });
  
  const [showToggles, setShowToggles] = useState(true);
 

  

  useEffect(() => {
   
    
    if (!houses || houses.length !== 12) return;

    // 🎯 Общие настройки размеров
    const width =550;
    const height =550;
    const center = width / 2;

    // 📏 Радиусы разных уровней кругов
    const radiusZodiacOuter = 268.33; // Внешний фиолетовый
    const radiusZodiacInner = 240;    // Внутренний белый
    const whiteCircleOuter = 1;     // Внешний белый фон
    const whiteCircleInner = 190;     // Центральный круг аспектов

    const houseOuter = 180;           // Радиус внешнего круга домов
    const houseInner = 140;           // Радиус внутреннего круга домов

    const labelRadius = 160;          // Радиус подписи домов
    const aspectRadius = 135;         // Радиус линий аспектов
    const baseSymbolRadius = 225;     // Радиус символов планет
    const degreeTextOffset = 14;      // Смещение градусов от символа

    const redSymbols = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♅", "♆", "♇", "☊", "⚷"]; // Планеты

    // 🎨 Инициализация SVG
  const svg = d3.select(ref.current)
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .attr("class", "responsive-svg") // 👈 вместо width/height
  .style("background", "#f7f0fa")
  .style("border-radius", "12px")
  .style("box-shadow", "0 0 12px rgba(0,0,0,0.1)");


    svg.selectAll("*").remove(); // Очистка SVG перед отрисовкой

    const g = svg.append("g").attr("transform", `translate(${center},${center})`);

    // 🔵 Фон: фиолетовый + белые круги
    const bg = g.append("g").attr("id", "background");
    bg.append("circle").attr("r", radiusZodiacOuter).attr("fill", "#4B0082");
    bg.append("circle").attr("r", radiusZodiacInner).attr("fill", "white");
    bg.append("circle").attr("r", whiteCircleOuter).attr("fill", "white");
    bg.append("circle").attr("r", whiteCircleInner).attr("fill", "white");

    // 📍 Нормализация домов
    // 📍 Нормализация домов
  

    // 📌 ASC для поворота карты
    const asc = Object.values(bodies).find(b => b.symbol === "AS");
    const ascDegree = asc?.degree || 0;
    const degOffset = ascDegree - 270;

  
  
    // 📍 Группа для домов
const houseGroup = g.append("g").attr("id", "houses");

// 📍 Нормализация домов (и применение degOffset)
const normalized = houses.map(h => ({
  ...h,
  normDeg: (h.degree - degOffset + 360) % 360
}));

normalized.forEach((current, i) => {
  const next = normalized[(i + 1) % 12];
  let startDeg = current.normDeg;
  let endDeg = next.normDeg;
  if (i === 11 && endDeg < startDeg) endDeg += 360;

  const startAngle = (-(startDeg - 90)) * (Math.PI / 180);
  const endAngle = (-(endDeg - 90)) * (Math.PI / 180);

  const arc = d3.arc().innerRadius(houseInner).outerRadius(houseOuter).startAngle(startAngle).endAngle(endAngle);
  houseGroup.append("path").attr("d", arc()).attr("fill", "#eeeeee");

  const lineRadius = houseOuter + 60;
  const x1 = houseInner * Math.cos(startAngle);
  const y1 = houseInner * Math.sin(startAngle);
  const x2 = lineRadius * Math.cos(startAngle);
  const y2 = lineRadius * Math.sin(startAngle);
  houseGroup.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("stroke", "#aaa").attr("stroke-width", 1).raise();

  const midDeg = startDeg + (endDeg - startDeg) / 2;
  const midAngle = (-(midDeg - 90)) * (Math.PI / 180);
  const xLabel = labelRadius * Math.cos(midAngle);
  const yLabel = labelRadius * Math.sin(midAngle);

  houseGroup.append("text")
    .attr("x", xLabel).attr("y", yLabel)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "15px")
    .attr("fill", "#444")
    .attr("font-family", "Roboto, sans-serif")
    .text(current.symbol || i + 1);
});






// 🌀 Зодиакальный круг
// 🌀 Зодиакальный круг (по данным фигур)
const zodiacGroup = g.append("g").attr("id", "zodiac-group");

const zodiacSymbolsMap = {
  "ОВЕН": "♈", "ТЕЛЕЦ": "♉", "БЛИЗНЕЦЫ": "♊", "РАК": "♋",
  "ЛЕВ": "♌", "ДЕВА": "♍", "ВЕСЫ": "♎", "СКОРПИОН": "♏",
  "СТРЕЛЕЦ": "♐", "КОЗЕРОГ": "♑", "ВОДОЛЕЙ": "♒", "РЫБЫ": "♓"
};


const zodiacRadius = 252;

// === Группируем по знакам и считаем средние градусы ===
const groupedBySign = {};
Object.values(bodies).forEach(body => {
  if (!body.sign || isNaN(body.degree)) return;
  if (!groupedBySign[body.sign]) groupedBySign[body.sign] = [];
  groupedBySign[body.sign].push(body.degree);
});

const sortedSigns = Object.entries(groupedBySign)
  .map(([sign, degrees]) => ({
    sign,
    avgDeg: degrees.reduce((a, b) => a + b, 0) / degrees.length
  }))
  .sort((a, b) => a.avgDeg - b.avgDeg);

// === Рисуем символы знаков ===
sortedSigns.forEach(({ sign, avgDeg }) => {
  const rotatedDeg = (avgDeg - degOffset + 360) % 360;
  const angle = (90 - rotatedDeg) * (Math.PI / 180);
  const x = zodiacRadius * Math.cos(angle);
  const y = zodiacRadius * Math.sin(angle);
  const rotation = (angle * 180) / Math.PI + 90;

  zodiacGroup.append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("transform", `rotate(${rotation}, ${x}, ${y})`)
    .attr("fill", "white")
    .attr("font-family", "Roboto, sans-serif")
    .attr("font-size", "14px")
    .text(zodiacSymbolsMap[sign] || sign);
});

// === Добавляем первый знак в конец для замыкания круга ===
const extended = [...sortedSigns, { ...sortedSigns[0], avgDeg: sortedSigns[0].avgDeg + 360 }];

// === Рисуем разделители по середине между соседними знаками ===
for (let i = 1; i < extended.length; i++) {
  const prev = extended[i - 1];
  const curr = extended[i];
  const midDeg = (prev.avgDeg + curr.avgDeg) / 2;
  const rotatedDeg = (midDeg - degOffset + 360) % 360;
  const angle = (90 - rotatedDeg) * (Math.PI / 180);

  const x1 = radiusZodiacInner * Math.cos(angle);
  const y1 = radiusZodiacInner * Math.sin(angle);
  const x2 = radiusZodiacOuter * Math.cos(angle);
  const y2 = radiusZodiacOuter * Math.sin(angle);

  zodiacGroup.append("line")
    .attr("x1", x1).attr("y1", y1)
    .attr("x2", x2).attr("y2", y2)
    .attr("stroke", "white")
    .attr("stroke-width", 1.6)
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.95);
}





  


    // 📌 Функция получения координат по градусам
    const getCoordFromDegree = (deg, r) => {
      const rotatedDeg = (deg - degOffset + 360) % 360;
      const angle = (90 - rotatedDeg) * (Math.PI / 180);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    };

  
    const getColorByAspect = (aspectRaw) => {
      const aspect = String(aspectRaw).trim();
    
      const map = {
        // Мажорные
        "☌": "#9bd7b7", // conjunction
        "△": "#ec7464", // trine
        "✶": "#f4dc6c", // sextile
        "☍": "#5cace4", // opposition
        "□": "#b98bcd", // square
    
        // Минорные и редкие
        "⚻": "#84c4ec", // quincunx
        "∠": "#f4948c", // semisquare
        "⚼": "#bb8fce", // sesquiquadrate
        "Q": "#f8c475",  // quintile ← твой цвет
        "bQ": "#acd4f4", // biquintile
        "S": "#a4e4d4",  // semisextile
        "N": "#00bcd4",  // novile
        "π": "#ff4081"   // custom special
      };
    
      return map[aspect] || "#bbb";
    };
    
    
    

    // 🔷 Отрисовка аспектов между телами
    aspects?.forEach((asp) => {
      if (!visibleAspects[asp.aspect]) return;

      const from = bodies[asp.from_body || asp.from];
      const to = bodies[asp.to_body || asp.to];
      if (!from || !to) return;
      const [x1, y1] = getCoordFromDegree(from.degree, aspectRadius);
      const [x2, y2] = getCoordFromDegree(to.degree, aspectRadius);
      g.append("line")
        .attr("x1", x1).attr("y1", y1)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", getColorByAspect(asp.aspect))
        .attr("stroke-width", 2.5)
        .attr("opacity", 1);
    });

    // 🪐 Отрисовка планет + градусов
const planetGroup = g.append("g").attr("id", "planets-group");
const sortedBodies = Object.entries(bodies).sort(([, a], [, b]) => a.degree - b.degree);
const placedDegrees = [];
const DEGREE_OFFSET_STEP = 9;
const MAX_ATTEMPTS = 10;
const anglePoints = ["AS", "DS", "MC", "IC"];

sortedBodies.forEach(([key, body]) => {
  if (!visiblePlanets[body.symbol]) return;
  if (body.symbol === "DS") return;
  if (key === "DS") return;

  const isAnglePoint = anglePoints.includes(body.symbol);
  const isRed = redSymbols.includes(body.symbol);
  const color = isRed ? "#d22" : "#000";

  // Смещаем градус для предотвращения наложения
  let degree = (body.degree - degOffset + 360) % 360;
  let found = false;

  if (!isAnglePoint) {
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      const offset = (attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * DEGREE_OFFSET_STEP;
      const testDegree = degree + offset;
      const isFarEnough = placedDegrees.every((d) => Math.abs(d - testDegree) > DEGREE_OFFSET_STEP - 1.2);
      if (isFarEnough) {
        degree = testDegree;
        placedDegrees.push(degree);
        found = true;
        break;
      }
    }
    if (!found) placedDegrees.push(degree);
  }

  const reducedRadius = isAnglePoint ? (houseInner + houseOuter) / 2 : baseSymbolRadius - 12;
  const [x, y] = getCoordFromDegree((degree + degOffset) % 360, reducedRadius);
  const planetG = planetGroup.append("g");

  // Символ фигуры
  planetG.append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", isAnglePoint ? "16px" : "18px")
    .attr("fill", color)
    .attr("font-family", "Roboto, sans-serif")
    .attr("font-weight", "bold")
    .text(body.symbol || key);

  if (!isAnglePoint) {
    // Градус
    const offsetX = 8;
    const offsetY = -12;

    planetG.append("text")
      .attr("x", x + offsetX)
      .attr("y", y + offsetY)
      .attr("font-size", "10px")
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "central")
      .attr("fill", color)
      .attr("class", "planet-degree")
      .text(`${body.roundedDegree}°`);
  }
});

g.select("#houses").raise();
// 1. Серый фон для 7 дома (между домами 4 и 5)
const houseOverlay = g.append("g").attr("id", "house-overlay");

const house4 = normalized.find(h => h.symbol === "4");
const house5 = normalized.find(h => h.symbol === "5");

if (house4 && house5) {
  let startDeg = house4.normDeg;
  let endDeg = house5.normDeg;
  if (endDeg < startDeg) endDeg += 360;

  const startAngle = (90 - startDeg) * (Math.PI / 180);
  const endAngle = (90 - endDeg) * (Math.PI / 180);

  const arc = d3.arc()
    .innerRadius(houseInner)
    .outerRadius(houseOuter)
    .startAngle(startAngle)
    .endAngle(endAngle);

  houseOverlay.append("path")
    .attr("d", arc())
    .attr("fill", "#eeeeee");
}
// 2. Поверх всех — слой с цифрами домов и углами (AS, DS, MC, IC)
const overlayGroup = g.append("g").attr("id", "overlay-top-layer");

// 🔢 Только дома 1–4 и 7
[0, 1, 2, 3, 6].forEach((i) => {
  const current = normalized[i];
  const next = normalized[(i + 1) % 12];
  let startDeg = current.normDeg;
  let endDeg = next.normDeg;
  if (endDeg < startDeg) endDeg += 360;

  const midDeg = startDeg + (endDeg - startDeg) / 2;
  const angle = (90 - midDeg) * (Math.PI / 180);
  const x = (labelRadius) * Math.cos(angle);
  const y = (labelRadius) * Math.sin(angle);

  overlayGroup.append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "15px")
    .attr("fill", "#444")
    .attr("font-family", "Roboto, sans-serif")
    .text(i + 1);

  const startAngle = (90 - startDeg) * (Math.PI / 180);
  const x1 = houseInner * Math.cos(startAngle);
  const y1 = houseInner * Math.sin(startAngle);
  const x2 = (houseOuter + 60) * Math.cos(startAngle);
  const y2 = (houseOuter + 60) * Math.sin(startAngle);

  overlayGroup.append("line")
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .attr("stroke", "#aaa")
    .attr("stroke-width", 1);
});

// 2. Метки углов (AS, DS, MC, IC)
const importantAngles = ["AS", "DS", "MC", "IC"];
importantAngles.forEach((symbol) => {
  const point = bodies[symbol];
  if (!point) return;

  const angle = (90 - ((point.degree - degOffset + 360) % 360)) * (Math.PI / 180);
  const x = labelRadius * Math.cos(angle);
  const y = labelRadius * Math.sin(angle);

  overlayGroup.append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .attr("fill", "#000")
    .attr("font-family", "Roboto, sans-serif")
    .text(symbol);
});

// 3. 🔝 Блок для приоритетного отображения поверх всего
const topOverlay = g.append("g").attr("id", "topmost-overlay");

// === ЦИФРА "7" ===
const house7 = normalized[6]; // <- как ты сказал, геометрически 7 дом
const house8 = normalized[7];

let startDeg = house7.normDeg;
let endDeg = house8.normDeg;
if (endDeg < startDeg) endDeg += 360;

const midDeg = startDeg + (endDeg - startDeg) / 2;
const angle = (90 - midDeg) * (Math.PI / 180);
const x7 = labelRadius * Math.cos(angle);
const y7 = labelRadius * Math.sin(angle);

topOverlay.append("text")
  .attr("x", x7)
  .attr("y", y7)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "middle")
  .attr("font-size", "15px")
  .attr("fill", "#444")
  .attr("font-family", "Roboto, sans-serif")
  .text("7");



  }, [bodies, aspects, houses, visiblePlanets, visibleAspects]);


 return (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 30 }}>
    {/* Карта и переключатели */}
    <div className="chart-layout">
      <div className="chart-wrapper">
        <svg ref={ref}></svg>
      </div>

      <div className="chart-toggles">
        <button
          onClick={() => setShowToggles(prev => !prev)}
          className="toggle-button"
        >
          {showToggles ? "Скрыть переключатели" : "Показать переключатели"}
        </button>

        {showToggles && (
          <>
            <h3>Планеты:</h3>
            <div className="checkbox-group">
              {Object.keys(visiblePlanets).map((symbol) => (
                <label key={symbol}>
                  <input
                    type="checkbox"
                    checked={visiblePlanets[symbol]}
                    onChange={() =>
                      setVisiblePlanets((prev) => ({
                        ...prev,
                        [symbol]: !prev[symbol],
                      }))
                    }
                  />
                  {symbol}
                </label>
              ))}
            </div>

            <h3>Аспекты:</h3>
            <div className="checkbox-group">
              {Object.keys(visibleAspects).map((asp) => (
                <label key={asp}>
                  <input
                    type="checkbox"
                    checked={visibleAspects[asp]}
                    onChange={() =>
                      setVisibleAspects((prev) => ({
                        ...prev,
                        [asp]: !prev[asp],
                      }))
                    }
                  />
                  {asp}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Дети и аспекты */}
    {children}
    <PatternVisualizer patterns={patterns} />
    <div className="aspects-wrapper">
      <h3>Аспекты:</h3>
      <div className="aspects-columns">
        <div className="aspects-column">
          <strong>Мажорные:</strong>
          <ul>
            {structuredAspects?.major.map((asp, i) => (
              <li key={i}>{asp}</li>
            ))}
          </ul>
        </div>
        <div className="aspects-column">
          <strong>Минорные:</strong>
          <ul>
            {structuredAspects?.minor.map((asp, i) => (
              <li key={i}>{asp}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);

  
  
};

export default NatalChart;
