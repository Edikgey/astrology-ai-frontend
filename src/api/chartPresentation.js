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
