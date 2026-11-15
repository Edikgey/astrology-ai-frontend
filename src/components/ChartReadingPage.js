import React, { useEffect, useState } from "react";
import { chartRequest } from "../api/chartsApi";
import { LoadingState, PageHeading } from "./UI";
import OwnChartPicker, { SignInSection } from "./OwnChartPicker";

// The frame of a read-only «reading» page (Moon today, My year): the chart choice (OwnChartPicker) and a cancellable
// GET `/natal-chart/<id>/<endpoint>` with «Повторить». The server decides access and the result; a page supplies only its
// view (`View` gets `data` and `sentZone`) and texts. CSS classes come from `prefix`: `<prefix>-page`, `-note`, `-chart`.
function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

function Reading({ chartId, endpoint, View, ...frame }) {
  const { prefix, texts } = frame;
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const zone = deviceZone();
    const query = zone ? `?tz=${encodeURIComponent(zone)}` : "";
    setResult(null);
    chartRequest(`/natal-chart/${chartId}/${endpoint}${query}`, { authenticated: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ data, zone }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [chartId, endpoint, reload]);

  if (!result) return <LoadingState text={texts.loadingReading} />;
  if (result.error?.status === 401) return <SignInSection {...frame} />;
  if (result.error) {
    // A retry helps only when the calculation or the network failed; 403/404/422 need another action (the text says which).
    const retry = !result.error.status || result.error.status === 503;
    return <div className={`${prefix}-note`}>
      <p role="alert">{result.error.message}</p>
      {retry && <button type="button" className="button-secondary" onClick={() => setReload(value => value + 1)}>Повторить</button>}
    </div>;
  }
  return <View data={result.data} sentZone={result.zone} />;
}

export default function ChartReadingPage({ title, description, prefix, returnTo, endpoint, View, texts }) {
  const frame = { prefix, returnTo, endpoint, View, texts };
  return <div className={`page ${prefix}-page`}>
    <PageHeading title={title}><p>{description}</p></PageHeading>
    <OwnChartPicker prefix={prefix} returnTo={returnTo} texts={texts}>
      {chart => <Reading key={chart.chart_id} chartId={chart.chart_id} {...frame} />}
    </OwnChartPicker>
  </div>;
}
