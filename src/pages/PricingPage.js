import React from "react";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { useNavigate } from "react-router-dom";
import { PLANS } from "../config/plans";
import { PageHeading } from "../components/UI";
import PremiumPrice from "../components/PremiumPrice";
import UsageSummary from "../components/UsageSummary";
import "./PricingPage.css";

export default function PricingPage() {
  const { user } = useAuth();
  const { usage, openUpgrade } = useUsage();
  const navigate = useNavigate();
  const upgrade = () => user ? openUpgrade() : navigate("/authorization", { state: { returnTo: "/pricing" } });
  return <section className="pricing-section page">
    <PageHeading eyebrow="Free & Premium" title="Больше места для ваших открытий."><p>Начните бесплатно. Выберите Premium, когда захотите продолжить разговор.</p></PageHeading>
    <div className="pricing-grid">
      <div className="pricing-card"><span className="eyebrow">Первое знакомство</span><h3>Free</h3><p className="free-price">Бесплатно</p><p className="plan-description">Ваша карта и первые вопросы к ней.</p>
        <p>{PLANS.free.chartLimit} сохранённые карты</p><p>{PLANS.free.gptLimit} AI-вопросов за всё время аккаунта</p><p>История разговора для каждой карты</p>
        <button className="button-secondary" onClick={() => navigate("/try-free")}>Начать бесплатно</button>
      </div>
      <div className="pricing-card popular"><span className="eyebrow">Для глубокого разговора</span><h3>Premium</h3><PremiumPrice /><p className="plan-description">Больше карт, вопросов и пространства для уточнений.</p>
        <p>{PLANS.premium.chartLimit} сохранённых карт</p><p>{PLANS.premium.gptLimit} AI-вопросов за расчётный месяц</p>
        <p>Отмена продления в любое время. Доступ сохраняется до конца оплаченного периода.</p>
        {usage?.plan !== "premium" && <button className="filled-button" onClick={upgrade} disabled={Boolean(user && !usage)}>Перейти на Premium</button>}
      </div>
    </div>
    <p className="pricing-note">Считаются только успешные AI-ответы. Лимит Free действует за всё время аккаунта, Premium — за оплаченный расчётный период. Удаление карты или истории не возвращает вопросы.</p>
    <UsageSummary />
  </section>;
}
