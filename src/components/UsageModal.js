import React, { useEffect, useRef } from "react";
import { PACK_SIZE, PLANS } from "../config/plans";
import { canBuy, hasNewOffers } from "../utils/offers";
import OfferOptions from "./OfferOptions";
import { useBilling } from "../context/BillingContext";
import { DialogClose } from "./UI";
import {newAnalyticsFlow,trackEvent} from '../analytics/clarity';
import "./Usage.css";
import BetaPurchaseNote from "./BetaPurchaseNote";

export function formatPeriodDate(value) {
  if (!value) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export default function UsageModal({ state, usage, onClose, noteOffer = () => {} }) {
  const dialog = useRef(null);
  const analyticsFlow=useRef(null);
  const billing = useBilling();
  const plan = state.plan || usage?.plan;
  const free = plan === "free";
  const beta = usage?.free_beta_enabled === true;
  const charts = state.codeNormalized === "chart_limit_reached";
  const periodInvalid = state.codeNormalized === "gpt_period_invalid";
  const limited = Boolean(state.codeNormalized);
  const end = formatPeriodDate(usage?.current_period_end);
  // Offers by moment (DESIGN 4). Only the server flags decide; during the beta nothing new is offered and the old window stays.
  const newOffers = !beta && hasNewOffers(usage);
  const gptLimit = state.codeNormalized === "gpt_limit_reached";
  const products = !newOffers || periodInvalid ? [] : free ? (charts ? ["premium_month", "premium_year"] : ["premium_month", "premium_year", "question_pack"]) :
    (gptLimit || !limited) ? ["question_pack"] : [];
  const showOptions = products.some(product => canBuy(usage, product));
  const freeQuestionsOver = free && !beta && gptLimit;
  const packOffered = canBuy(usage, "question_pack");
  const resetDate = formatPeriodDate(usage?.gpt_messages_reset_at);
  const feedback = provider => <div className="payment-feedback" aria-live="polite">
    {provider === "stripe" && !billing.configured && <p role="status">Оплата пока не настроена.</p>}
    {billing.feedbackProvider === provider && <>
      {billing.busy && <p role="status">Проверяем оплату…</p>}
      {billing.message && <p role="status">{billing.message}</p>}
      {billing.error && <p role="alert">{billing.error}</p>}
    </>}
  </div>;
  useEffect(() => {
    if (!billing.checkoutVisible && !dialog.current?.open) dialog.current?.showModal();
    if(free){
      if(!analyticsFlow.current)analyticsFlow.current=newAnalyticsFlow();
      trackEvent('premium_modal_opened',analyticsFlow.current);
    }
  }, [billing.checkoutVisible, billing.busy, free]);
  useEffect(() => { if (showOptions && state.moment) noteOffer(state.moment); }, [showOptions, state.moment, noteOffer]);
  return <dialog ref={dialog} className="usage-modal" aria-labelledby="usage-modal-title" onCancel={onClose}>
    <DialogClose onClose={onClose} />
    <h2 id="usage-modal-title">{limited ? (periodInvalid ? "Расчётный период Premium недоступен" :
      charts ? "Достигнут лимит сохранённых карт" : freeQuestionsOver ? "Бесплатные вопросы закончились" : "Достигнут лимит AI-вопросов") :
      beta ? "Подписка Premium" : !free ? "Пакет вопросов" : "Больше возможностей с Premium"}</h2>
    {limited && <p>{charts ? (newOffers && free ? "Бесплатно можно сохранить 3 карты. Удалите ненужную в «Мои карты» или перейдите на Premium — до 10 карт." :
        "Удалите ненужную карту в разделе «Мои карты», чтобы освободить место.") :
      periodInvalid ? "Ваш план — Premium. Для продолжения разговора нужен действующий расчётный период." :
      free ? (freeQuestionsOver && showOptions ? `Вы задали все ${PLANS.free.gptLimit} бесплатных вопросов. Чтобы продолжить разговор, выберите Premium${packOffered ? " или пакет вопросов" : ""}. История сохранится.` :
        "Бесплатный лимит действует на весь аккаунт за всё время. Удаление карт или истории не возвращает сообщения.") :
      showOptions ? `Вопросы Premium на этот месяц закончились.${resetDate ? ` Новые ${PLANS.premium.gptLimit} — ${resetDate} (UTC).` : ""} Чтобы не ждать, купите пакет +${PACK_SIZE} вопросов.` :
      "Ваш лимит действует на весь аккаунт за расчётный период. Дождитесь обновления периода или завершения запросов в обработке."}</p>}
    {!limited && !free && showOptions && <p>Пакет добавляет вопросы к вашему лимиту и не меняет подписку.</p>}
    {limited && Number.isFinite(state.used) && Number.isFinite(state.limit) && <p>Использовано: {state.used} / {state.limit}{state.reserved > 0 ? `; в обработке: ${state.reserved}` : ""}.</p>}
    {free && !limited && !beta && <p>Продолжайте разбирать отношения, работу и свои сильные стороны. Больше вопросов для каждой истории.</p>}
    <BetaPurchaseNote enabled={beta} />
    {showOptions ? <>
      <OfferOptions usage={usage} products={products} />
      <p className="payment-summary">{free ? <>Отменить продление Premium можно в разделе «Мои карты».{' '}</> : null}
        <a href="/refunds" target="_blank" rel="noopener noreferrer">Правила отмены и возвратов</a>.</p>
    </> : free ? <>
      {beta && <p>Обычные лимиты тарифов вне бета-теста:</p>}
      <div className="usage-plan-grid">
        <section><h3>Бесплатно</h3><p>{PLANS.free.chartLimit} карты</p><p>{PLANS.free.gptLimit} AI-вопросов за всё время аккаунта</p></section>
        <section><h3>Premium</h3><p>{PLANS.premium.chartLimit} карт</p><p>{PLANS.premium.gptLimit} AI-вопросов в месяц — за расчётный период, на весь аккаунт</p></section>
      </div>
      <div className="payment-options">
        <section className="payment-option" aria-label="Оплата — Stripe">
          <div className="payment-option-content">
            <h3>Оплата</h3><p className="payment-option-description">Stripe</p>
            <p className="payment-option-price">$9.99 USD / месяц</p>
            <p className="payment-option-note">Автоматическое продление каждый месяц. Отмена в любое время.</p>
          </div>
          <button type="button" className="usage-button" disabled={!billing.configured || billing.busy} onClick={() => billing.startCheckout()}>Оплатить через Stripe</button>
          {feedback("stripe")}
        </section>
        {billing.lavaConfigured && <section className="payment-option" aria-label="Оплата в рублях — Lava.top">
          <div className="payment-option-content">
            <h3>Оплата в рублях</h3><p className="payment-option-description">Lava.top</p>
            <p className="payment-option-price">799 ₽ / месяц</p>
            <p className="payment-option-note">Автоматическое продление каждый месяц. Отмена в любое время.</p>
          </div>
          <button type="button" className="usage-button" disabled={billing.busy} onClick={() => billing.startLavaCheckout()}>Оплатить в RUB</button>
          {feedback("lava")}
        </section>}
      </div>
      <p className="payment-summary">Отменить продление можно в разделе «Мои карты».{' '}
        <a href="/refunds" target="_blank" rel="noopener noreferrer">Правила отмены и возвратов</a>.</p>
    </> : <p>{plan === "premium" ? "Ваш текущий план — Premium." : "Лимит определяет сервер."}{end && plan === "premium" ? ` Конец расчётного периода: ${end} (UTC).` : ""}</p>}
    {!showOptions && (!free || !billing.feedbackProvider) && billing.message && <p role="status">{billing.message}</p>}
    {!showOptions && (!free || !billing.feedbackProvider) && billing.error && <p role="alert">{billing.error}</p>}
    <button type="button" className="usage-button usage-close" onClick={onClose}>Закрыть</button>
  </dialog>;
}
