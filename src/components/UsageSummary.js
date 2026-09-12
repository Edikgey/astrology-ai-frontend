import React from "react";
import { useUsage } from "../context/UsageContext";
import { useBilling } from "../context/BillingContext";
import { formatPeriodDate } from "./UsageModal";
import "./Usage.css";

export function UpgradeCTA() {
  const { usage, openUpgrade } = useUsage();
  return usage?.plan === "free" ? <button type="button" className="usage-button" onClick={openUpgrade}>Upgrade to Premium</button> : null;
}

export default function UsageSummary() {
  const billing = useBilling();
  const { usage, usageLoading, usageError, refreshUsage } = useUsage();
  if (usageError) return <section className="usage-summary" aria-label="Использование аккаунта">
    <p role="alert">{usageError.status === 401 ? "Сессия истекла. Войдите снова." : "Не удалось обновить лимиты аккаунта."}</p>
    {usageError.status === 401 ? <a href="/authorization">Войти</a> :
      <button type="button" className="usage-button" onClick={refreshUsage}>Обновить лимиты</button>}
  </section>;
  if (!usage) return usageLoading ? <p role="status">Загрузка лимитов...</p> : null;
  const premium = usage.plan === "premium";
  const start = formatPeriodDate(usage.current_period_start);
  const end = formatPeriodDate(usage.current_period_end);
  return <section className="usage-summary" aria-label="Использование аккаунта" aria-busy={usageLoading}>
    <strong>План: {premium ? "Premium" : usage.plan === "free" ? "Free" : usage.plan}</strong>
    <p>Сохранено карт: {usage.saved_charts_used} / {usage.saved_charts_limit}</p>
    <p>GPT-сообщения: {usage.gpt_messages_used} / {usage.gpt_messages_limit} — {usage.gpt_limit_type === "billing_period" ? "за расчётный период" : "за всё время аккаунта"}</p>
    {usage.gpt_messages_reserved > 0 && <p>Запросов в обработке: {usage.gpt_messages_reserved}. Они временно занимают лимит.</p>}
    {premium && start && end && <p>Расчётный период: {start} — {end} (UTC).</p>}
    {premium && !usage.gpt_period_valid && <p>Нет действующего расчётного периода Premium. GPT станет доступен после обновления периода.</p>}
    <UpgradeCTA />
    {usage.cancel_at_period_end && <p>Продление отменено. Доступ до {formatPeriodDate(usage.scheduled_cancel_at)} (UTC).</p>}
    {usage.subscription_status === "past_due" && <p>Не удалось продлить подписку. Обновите способ оплаты в Paddle.</p>}
    {usage.can_manage_subscription && <button type="button" className="usage-button" disabled={billing.busy} onClick={billing.manageSubscription}>Manage subscription</button>}
    {billing.message && <p role="status">{billing.message}</p>}
    {billing.error && <p role="alert">{billing.error}</p>}
  </section>;
}
