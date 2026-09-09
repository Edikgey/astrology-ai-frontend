import React from "react";
import "./PatternVisualizer.css";

const PatternVisualizer = ({ patterns }) => {
  const grouped = patterns.reduce((acc, p) => {
    if (!acc[p.type]) acc[p.type] = [];
    acc[p.type].push(p);
    return acc;
  }, {});

  return (
    <div className="patterns-wrapper">
      <h2 className="patterns-title">Астрологические Паттерны</h2>
      {Object.entries(grouped).map(([type, group], idx) => (
        <div key={idx} className="pattern-group">
          <h3 className="group-title">{type} ({group.length} найдено)</h3>
          <div className="patterns-row">
            {group.map((pattern, i) => (
              <div key={i} className="pattern-card">
                <svg width="170" height="180" className="pattern-svg">
                  <circle cx="85" cy="90" r="60" stroke="#ccc" fill="none" />
                  {pattern.bodies.map((body, i) => {
                    const angle = (i / pattern.bodies.length) * 2 * Math.PI;
                    const x = 85 + 55 * Math.cos(angle);
                    const y = 90 + 55 * Math.sin(angle);
                    const labelX = 85 + 78 * Math.cos(angle);
                    const labelY = 90 + 78 * Math.sin(angle);
                    return (
                      <g key={i}>
                        <line
                          x1={85 + 55 * Math.cos(angle)}
                          y1={90 + 55 * Math.sin(angle)}
                          x2={85 + 60 * Math.cos(angle)}
                          y2={90 + 60 * Math.sin(angle)}
                          stroke="#000"
                          strokeWidth="2"
                        />
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          fontSize="14"
                          fontWeight="bold"
                          fill="#000"
                        >
                          {body.symbol}
                        </text>
                      </g>
                    );
                  })}
                  {pattern.bodies.map((from, i) => {
                    const to = pattern.bodies[(i + 1) % pattern.bodies.length];
                    const angleFrom = (i / pattern.bodies.length) * 2 * Math.PI;
                    const angleTo = ((i + 1) % pattern.bodies.length) * 2 * Math.PI;
                    const x1 = 85 + 55 * Math.cos(angleFrom);
                    const y1 = 90 + 55 * Math.sin(angleFrom);
                    const x2 = 85 + 55 * Math.cos(angleTo);
                    const y2 = 90 + 55 * Math.sin(angleTo);
                    const colors = ["#2196f3", "#f44336", "#4caf50", "#ff9800", "#9c27b0"];
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={colors[i % colors.length]}
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
                {pattern.bodies.map((b, i) => (
                  <div key={i} className="pattern-body-text">
                    {b.label} ({b.symbol}) — {b.degree} {b.sign}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PatternVisualizer;

