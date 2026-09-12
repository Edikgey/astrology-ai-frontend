import React from "react";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { useNavigate } from "react-router-dom";
import { PLANS } from "../config/plans";
import PremiumPrice from "../components/PremiumPrice";
import UsageSummary from "../components/UsageSummary";
import "./PricingPage.css";

export default function PricingPage() {
  const { user } = useAuth();
  const { usage, openUpgrade } = useUsage();
  const navigate = useNavigate();
  const upgrade = () => user ? openUpgrade() : navigate("/authorization", { state: { returnTo: "/pricing" } });
  return <section className="pricing-section">
    <h2 className="pricing-title">Выберите ваш план</h2>
    <div className="pricing-grid">
      <div className="pricing-card"><h3>Free</h3><p>Бесплатно</p>
        <p>{PLANS.free.chartLimit} сохранённые карты</p><p>{PLANS.free.gptLimit} GPT-сообщений за всё время аккаунта</p>
      </div>
      <div className="pricing-card popular"><h3>Premium</h3><PremiumPrice />
        <p>{PLANS.premium.chartLimit} сохранённых карт</p><p>{PLANS.premium.gptLimit} GPT-сообщений за расчётный месяц</p>
        <p>Отмена продления в любое время. Доступ сохраняется до конца оплаченного периода.</p>
        {usage?.plan !== "premium" && <button className="filled-button" onClick={upgrade} disabled={Boolean(user && !usage)}>Upgrade to Premium</button>}
      </div>
    </div>
    <UsageSummary />
  </section>;
}
