import React from "react";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { useNavigate } from "react-router-dom";
import { PLANS } from "../config/plans";
import { PageHeading } from "../components/UI";
import PremiumPrice from "../components/PremiumPrice";
import UsageSummary from "../components/UsageSummary";
import { PolicyLinks } from '../components/ServiceDisclosures';
import "./PricingPage.css";
import { useServiceConfig } from "../context/ServiceConfigContext";
import BetaPurchaseNote from "../components/BetaPurchaseNote";

export default function PricingPage() {
  const { user } = useAuth();
  const { usage, openUpgrade } = useUsage();
  const { freeBetaEnabled } = useServiceConfig();
  const beta = usage ? usage.free_beta_enabled === true : freeBetaEnabled;
  const navigate = useNavigate();
  // Вошедший пользователь без загруженных данных аккаунта пока не может открыть оплату.
  const upgradeWaiting = Boolean(user && !usage);
  const upgrade = () => user ? openUpgrade() : navigate("/authorization", { state: { returnTo: "/pricing" } });
  return <section className="pricing-section page">
    <PageHeading eyebrow={beta ? "Бесплатный бета-тест" : "Тарифы"} title={beta ? "Исследуйте Lunaria без лимитов." : "Больше места для ваших открытий."}><p>{beta ? "Сохраняйте карты и задавайте AI-вопросы бесплатно после входа в аккаунт. Покупка Premium необязательна." : "Начните бесплатно. Выберите Premium, когда захотите продолжить разговор."}</p></PageHeading>
    <div className="pricing-grid">
      <div className="pricing-card"><span className="eyebrow">Первое знакомство</span><h3>Free</h3><p className="free-price">Бесплатно</p><p className="plan-description">Ваша карта и первые вопросы к ней.</p>
        <p>{beta ? "Сохранённые карты без лимита" : `${PLANS.free.chartLimit} сохранённые карты`}</p><p>{beta ? "AI-вопросы без лимита" : `${PLANS.free.gptLimit} AI-вопросов за всё время аккаунта`}</p><p>История разговора для каждой карты</p>
        <button className="button-secondary" onClick={() => navigate("/try-free")}>Начать бесплатно</button>
      </div>
      <div className="pricing-card popular"><span className="eyebrow">Для глубокого разговора</span><h3>Premium</h3><PremiumPrice /><p className="plan-description">{beta ? "Платная подписка остаётся доступной по желанию." : "Больше карт, вопросов и пространства для уточнений."}</p>
        <BetaPurchaseNote enabled={beta} />
        {beta && <p>Обычные лимиты Premium вне бета-теста:</p>}
        <p>{PLANS.premium.chartLimit} сохранённых карт</p><p>{PLANS.premium.gptLimit} AI-вопросов за расчётный месяц</p>
        <p>Отмена продления в «Мои карты» → «Управление подпиской». Доступ сохраняется до конца оплаченного периода. Отмена не возвращает оплату автоматически.</p>
        {upgradeWaiting && <p id="premium-unavailable" className="premium-hint">Кнопка станет доступна, когда загрузятся данные аккаунта. Если этого не происходит, обновите страницу.</p>}
        {usage?.plan !== "premium" && <button className="filled-button" onClick={upgrade} disabled={upgradeWaiting} aria-describedby={upgradeWaiting ? "premium-unavailable" : undefined}>Перейти на Premium</button>}
      </div>
    </div>
    {beta && <p className="pricing-note">Бесплатный доступ без продуктовых лимитов действует на время бета-теста. После его завершения возвращаются обычные тарифы: Free — 3 карты и 10 AI-вопросов за всё время аккаунта, Premium — 10 карт и 300 AI-вопросов за расчётный период. Сохранённые карты и история не удаляются.</p>}
    {!beta && <p className="pricing-note">Считаются только успешные AI-ответы. Лимит Free действует за всё время аккаунта, Premium — за оплаченный расчётный период. Удаление карты или истории не возвращает вопросы.</p>}
    <p className="pricing-note">Неиспользованные вопросы Premium не переносятся на следующий период. Free не превращается в платную подписку автоматически. Оплата в RUB через Lava.top, где доступна, — 799 ₽ в месяц с автоматическим продлением до отмены.</p>
    <PolicyLinks />
    <UsageSummary />
  </section>;
}
