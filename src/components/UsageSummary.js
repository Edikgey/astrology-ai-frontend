import React from "react";
import { useUsage } from "../context/UsageContext";
import { useBilling } from "../context/BillingContext";
import { formatPeriodDate } from "./UsageModal";
import SubscriptionManagement from './SubscriptionManagement';
import "./Usage.css";

export function UpgradeCTA() {
  const { usage, openUpgrade } = useUsage();
  return usage?.plan === "free" ? <button type="button" className="usage-button" onClick={openUpgrade}>Перейти на Premium</button> : null;
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
  const beta = usage.free_beta_enabled === true;
  const start = formatPeriodDate(usage.current_period_start);
  const end = formatPeriodDate(usage.current_period_end);
  return <section className="usage-summary" aria-label="Использование аккаунта" aria-busy={usageLoading}>
    <strong>План: {premium ? "Premium" : usage.plan === "free" ? "Free" : usage.plan}</strong>
    {beta && <p>Бесплатный бета-тест: карты и AI-вопросы без лимита.</p>}
    <p>Сохранено карт: {usage.saved_charts_used} / {beta ? "без лимита" : usage.saved_charts_limit}</p>
    <p>AI-вопросы: {usage.gpt_messages_used} / {beta ? "без лимита" : usage.gpt_messages_limit}{!beta && <> — {usage.gpt_limit_type === "billing_period" ? "за расчётный период" : "за всё время аккаунта"}</>}</p>
    {usage.gpt_messages_reserved > 0 && <p>Запросов в обработке: {usage.gpt_messages_reserved}. {!beta && "Они временно занимают лимит."}</p>}
    {premium && start && end && <p>Расчётный период: {start} — {end} (UTC).</p>}
    {premium && !beta && !usage.gpt_period_valid && <p>Нет действующего расчётного периода Premium. AI-чат станет доступен после обновления периода.</p>}
    <UpgradeCTA />
    {usage.subscription_status === "past_due" && <p>Не удалось продлить подписку. Проверьте оплату у платёжного провайдера.</p>}
    <SubscriptionManagement usage={usage} />
    {billing.message && <p role="status">{billing.message}</p>}
    {billing.error && <p role="alert">{billing.error}</p>}
  </section>;
}
