import React, { useEffect, useState } from 'react';
import NatalChart from '../components/NatalChart';
import AskGptForm from '../components/AskGptForm'; // Подключаем компонент чата

const NatalChartResultPage = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const savedChart = localStorage.getItem("natalChart");
    if (savedChart) {
      const parsed = JSON.parse(savedChart);
      setChartData(parsed);
    }
  }, []);

  if (!chartData) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Загрузка натальной карты...</div>;
  }

  return (
    <div style={{ padding: "40px 0" }}>
   <NatalChart
  chartId={chartData.chart_id}
  bodies={chartData.bodies_for_circle}
  aspects={chartData.aspects_for_circle}
  pointsData={chartData.points_data}
  patterns={chartData.patterns_data}
  structuredAspects={chartData.aspects_structured}
  houses={chartData.houses}
>
  {/* ✅ Передаём чат как children */}
  <div style={{ marginTop: "40px", maxWidth: 640 }}>
    <h2 style={{ textAlign: "center", marginBottom: "16px",fontFamily: "'Montserrat', sans-serif" }}>Спросить у GPT</h2>
    <AskGptForm chartId={chartData.chart_id} />
  </div>
</NatalChart>

   
    </div>
  );
  
};

export default NatalChartResultPage;


