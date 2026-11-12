// Optional device-local labels. Calculated chart data always comes from the API.
export function chartPresentation(chartId) {
  try {
    const value = JSON.parse(localStorage.getItem(`chart-presentation:${chartId}`));
    return typeof value?.name === 'string' ? { name: value.name } : {};
  }
  catch { return {}; }
}

export function saveChartPresentation(chartId, form) {
  try {
    localStorage.setItem(`chart-presentation:${chartId}`, JSON.stringify({ name: form.name?.trim() || '' }));
  } catch { /* A label cache failure must not undo successful chart creation. */ }
}

const UNNAMED_CHART = 'Карта без названия';
const birthDate = chart => chart.day && chart.month && chart.year
  ? `${String(chart.day).padStart(2, '0')}.${String(chart.month).padStart(2, '0')}.${chart.year}` : '';

// Единое имя карты для всех экранов: подпись с устройства, иначе «Карта без названия».
// Если безымянных карт несколько, их различает дата рождения. Внутренний номер карты не показываем.
// Возвращает { chart_id: имя }; подписи читаются из хранилища один раз на карту.
export function chartLabels(charts) {
  const named = charts.map(chart => [chart, chartPresentation(chart.chart_id).name]);
  const unnamed = named.filter(([, name]) => !name).length;
  return Object.fromEntries(named.map(([chart, name]) => {
    const date = !name && unnamed > 1 ? birthDate(chart) : '';
    return [chart.chart_id, name || (date ? `${UNNAMED_CHART} · ${date}` : UNNAMED_CHART)];
  }));
}

// Имя одной карты, когда остальных не видно (страница карты).
export const chartLabel = (chart, charts = [chart]) => chartLabels(charts)[chart.chart_id];
