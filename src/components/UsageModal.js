import React, { useEffect, useRef } from "react";
import { PLANS } from "../config/plans";
import "./Usage.css";

export function formatPeriodDate(value) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export default function UsageModal({ state, usage, onClose }) {
  const dialog = useRef(null);
  const plan = state.plan || usage?.plan;
  const free = plan === "free";
  const charts = state.codeNormalized === "chart_limit_reached";
  const periodInvalid = state.codeNormalized === "gpt_period_invalid";
  const limited = Boolean(state.codeNormalized);
  const end = formatPeriodDate(usage?.current_period_end);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="usage-modal" aria-labelledby="usage-modal-title" onCancel={onClose}>
    <h2 id="usage-modal-title">{limited ? (periodInvalid ? "Расчётный период Premium недоступен" :
      charts ? "Достигнут лимит сохранённых карт" : "Достигнут лимит GPT-сообщений") : "Больше возможностей с Premium"}</h2>
    {limited && <p>{charts ? "Удалите ненужную карту в разделе «Мои карты», чтобы освободить место." :
      periodInvalid ? "Ваш план — Premium. Для продолжения GPT нужен действующий расчётный период." :
      free ? "Бесплатный лимит действует на весь аккаунт за всё время. Удаление карт или истории не возвращает сообщения." :
      "Ваш лимит действует на весь аккаунт за расчётный период. Дождитесь обновления периода или завершения запросов в обработке."}</p>}
    {limited && Number.isFinite(state.used) && Number.isFinite(state.limit) && <p>Использовано: {state.used} / {state.limit}{state.reserved > 0 ? `; в обработке: ${state.reserved}` : ""}.</p>}
    {free ? <>
      <div className="usage-plan-grid">
        <section><h3>Free</h3><p>{PLANS.free.chartLimit} карты</p><p>{PLANS.free.gptLimit} GPT-сообщений за всё время аккаунта</p></section>
        <section><h3>Premium</h3><p>{PLANS.premium.chartLimit} карт</p><p>{PLANS.premium.gptLimit} GPT-сообщений в месяц — за расчётный период, на весь аккаунт</p></section>
      </div>
      <button type="button" className="usage-button" disabled aria-describedby="payments-coming">Upgrade to Premium</button>
      <p id="payments-coming">Payments coming next — подключение оплаты появится позже. Сейчас изменить план здесь нельзя.</p>
    </> : <p>{plan === "premium" ? "Ваш текущий план — Premium." : "Лимит определяет сервер."}{end && plan === "premium" ? ` Конец расчётного периода: ${end} (UTC).` : ""}</p>}
    <button type="button" className="usage-button usage-close" onClick={onClose}>Закрыть</button>
  </dialog>;
}
