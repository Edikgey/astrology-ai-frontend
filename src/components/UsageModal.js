import React, { useEffect, useRef } from "react";
import { PLANS } from "../config/plans";
import { useBilling } from "../context/BillingContext";
import PremiumPrice from "./PremiumPrice";
import { DialogClose } from "./UI";
import "./Usage.css";

export function formatPeriodDate(value) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export default function UsageModal({ state, usage, onClose }) {
  const dialog = useRef(null);
  const billing = useBilling();
  const plan = state.plan || usage?.plan;
  const free = plan === "free";
  const charts = state.codeNormalized === "chart_limit_reached";
  const periodInvalid = state.codeNormalized === "gpt_period_invalid";
  const limited = Boolean(state.codeNormalized);
  const end = formatPeriodDate(usage?.current_period_end);
  const feedback = provider => <div className="payment-feedback" aria-live="polite">
    {provider === "paddle" && !billing.configured && <p role="status">Оплата пока не настроена.</p>}
    {billing.feedbackProvider === provider && <>
      {billing.busy && <p role="status">Проверяем оплату…</p>}
      {billing.message && <p role="status">{billing.message}</p>}
      {billing.error && <p role="alert">{billing.error}</p>}
    </>}
  </div>;
  useEffect(() => {
    if (!billing.checkoutVisible && !dialog.current?.open) dialog.current?.showModal();
  }, [billing.checkoutVisible, billing.busy]);
  return <dialog ref={dialog} className="usage-modal" aria-labelledby="usage-modal-title" onCancel={onClose}>
    <DialogClose onClose={onClose} />
    <h2 id="usage-modal-title">{limited ? (periodInvalid ? "Расчётный период Premium недоступен" :
      charts ? "Достигнут лимит сохранённых карт" : "Достигнут лимит AI-вопросов") : "Больше возможностей с Premium"}</h2>
    {limited && <p>{charts ? "Удалите ненужную карту в разделе «Мои карты», чтобы освободить место." :
      periodInvalid ? "Ваш план — Premium. Для продолжения разговора нужен действующий расчётный период." :
      free ? "Бесплатный лимит действует на весь аккаунт за всё время. Удаление карт или истории не возвращает сообщения." :
      "Ваш лимит действует на весь аккаунт за расчётный период. Дождитесь обновления периода или завершения запросов в обработке."}</p>}
    {limited && Number.isFinite(state.used) && Number.isFinite(state.limit) && <p>Использовано: {state.used} / {state.limit}{state.reserved > 0 ? `; в обработке: ${state.reserved}` : ""}.</p>}
    {free && !limited && <p>Продолжайте разбирать отношения, работу и свои сильные стороны. Больше вопросов для каждой истории.</p>}
    {free ? <>
      <div className="usage-plan-grid">
        <section><h3>Free</h3><p>{PLANS.free.chartLimit} карты</p><p>{PLANS.free.gptLimit} AI-вопросов за всё время аккаунта</p></section>
        <section><h3>Premium</h3><p>{PLANS.premium.chartLimit} карт</p><p>{PLANS.premium.gptLimit} AI-вопросов в месяц — за расчётный период, на весь аккаунт</p></section>
      </div>
      <div className="payment-options">
        <section className="payment-option" aria-label="Оплата — Paddle">
          <div className="payment-option-content">
            <h3>Оплата</h3><p className="payment-option-description">Paddle</p>
            <PremiumPrice />
          </div>
          <button type="button" className="usage-button" disabled={!billing.configured || billing.busy} onClick={billing.startCheckout}>Оплатить через Paddle</button>
          {feedback("paddle")}
        </section>
        {billing.lavaConfigured && <section className="payment-option" aria-label="Оплата в рублях — Lava.top">
          <div className="payment-option-content">
            <h3>Оплата в рублях</h3><p className="payment-option-description">Lava.top</p>
            <p className="payment-option-price">799 ₽ / месяц</p>
            <p className="payment-option-note">Без пробного периода. Способы оплаты — на странице Lava.top.</p>
          </div>
          <button type="button" className="usage-button" disabled={billing.busy} onClick={billing.startLavaCheckout}>Оплатить в RUB</button>
          {feedback("lava")}
        </section>}
      </div>
    </> : <p>{plan === "premium" ? "Ваш текущий план — Premium." : "Лимит определяет сервер."}{end && plan === "premium" ? ` Конец расчётного периода: ${end} (UTC).` : ""}</p>}
    {(!free || !billing.feedbackProvider) && billing.message && <p role="status">{billing.message}</p>}
    {(!free || !billing.feedbackProvider) && billing.error && <p role="alert">{billing.error}</p>}
    <button type="button" className="usage-button usage-close" onClick={onClose}>Закрыть</button>
  </dialog>;
}
