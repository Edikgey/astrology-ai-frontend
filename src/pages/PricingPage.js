import React from "react";
import { useAuth } from "../context/AuthContext";
import { useUsage } from "../context/UsageContext";
import { useNavigate } from "react-router-dom";
import { PLANS, PRICES, OFFER_TITLES } from "../config/plans";
import { PageHeading } from "../components/UI";
import UsageSummary from "../components/UsageSummary";
import { PolicyLinks } from '../components/ServiceDisclosures';
import "./PricingPage.css";
import { useServiceConfig } from "../context/ServiceConfigContext";
import BetaPurchaseNote from "../components/BetaPurchaseNote";
import { canBuy } from "../utils/offers";

const FREE_PRICE = { usd: "$0", rub: "0 ₽" };

// Dollars and roubles are two rows of the same kind: the same classes, so the same size and weight (decision 50).
function PlanPrice({ price, unit }) {
  return <div className="plan-prices">
    {[["usd", price.usd, price.usdPerMonth, price.usdSaving], ["rub", price.rub, price.rubPerMonth, price.rubSaving]]
      .map(([currency, value, perMonth, saving]) => <p key={currency} className="plan-price">
        <span className="plan-price-value">{value}</span>{unit && <> <span className="plan-price-unit">{unit}</span></>}
        {perMonth && <span className="plan-price-sub">{perMonth} в месяц, выгоднее на {saving}%</span>}
      </p>)}
  </div>;
}

const Checks = ({ items }) => <ul className="plan-list">{items.map(item => <li key={item}>{item}</li>)}</ul>;

export default function PricingPage() {
  const { user } = useAuth();
  const { usage, openUpgrade } = useUsage();
  const { freeBetaEnabled, offers = {} } = useServiceConfig();
  const beta = usage ? usage.free_beta_enabled === true : freeBetaEnabled;
  const navigate = useNavigate();
  // Вошедший пользователь без загруженных данных аккаунта пока не может открыть оплату.
  const upgradeWaiting = Boolean(user && !usage);
  const upgrade = arg => user ? openUpgrade(arg) : navigate("/authorization", { state: { returnTo: "/pricing" } });
  // The year and the pack: only if the server sells them (config for everyone, account flags once loaded), in the beta too.
  const showYear = offers.premium_year === true && (!usage || canBuy(usage, "premium_year"));
  const showPack = offers.question_pack === true && (!usage || canBuy(usage, "question_pack"));
  const premiumPlan = usage?.plan === "premium";
  const chartsText = `${PLANS.premium.chartLimit} сохранённых карт`;
  return <section className="pricing-section page">
    <PageHeading eyebrow={beta ? "Бесплатный бета-тест" : "Тарифы"} title={beta ? "Исследуйте Lunaria без лимитов." : "Больше места для ваших открытий."}><p>{beta ? "Карты и AI-вопросы бесплатно после входа в аккаунт. Покупка Premium необязательна." : "Начните бесплатно. Выберите Premium, когда захотите продолжить разговор."}</p></PageHeading>
    <div className="pricing-grid">
      <div className="pricing-card"><p className="plan-tag">Первое знакомство</p><h3>Бесплатно</h3><PlanPrice price={FREE_PRICE} />
        <Checks items={[beta ? "Сохранённые карты без лимита" : `${PLANS.free.chartLimit} сохранённые карты`, beta ? "AI-вопросы без лимита" : `${PLANS.free.gptLimit} AI-вопросов за всё время аккаунта`, "История разговора для каждой карты"]} />
        <button className="button-secondary" onClick={() => navigate("/try-free")}>Начать бесплатно</button>
      </div>
      <div className={`pricing-card${showYear ? "" : " popular"}`}><p className="plan-tag">Для глубокого разговора</p><h3>{showYear || showPack ? OFFER_TITLES.premium_month : "Premium"}</h3><PlanPrice price={PRICES.premium_month} unit="в месяц" />
        {beta && <p className="plan-lead">Обычные лимиты Premium вне бета-теста:</p>}
        <Checks items={[chartsText, `${PLANS.premium.gptLimit} AI-вопросов за расчётный месяц`, "Продление каждый месяц, отмена в любой момент"]} />
        {upgradeWaiting && <p id="premium-unavailable" className="premium-hint">Кнопка станет доступна, когда загрузятся данные аккаунта. Если этого не происходит, обновите страницу.</p>}
        {usage?.plan !== "premium" && <button className="filled-button" onClick={() => upgrade()} disabled={upgradeWaiting} aria-describedby={upgradeWaiting ? "premium-unavailable" : undefined}>Перейти на Premium</button>}
      </div>
      {showYear && <div className="pricing-card popular"><p className="plan-tag plan-tag-badge">Выгоднее всего</p><h3>{OFFER_TITLES.premium_year}</h3><PlanPrice price={PRICES.premium_year} unit="в год" />
        <Checks items={[`Те же ${PLANS.premium.gptLimit} вопросов каждый месяц`, chartsText, "Продление раз в год, отмена в любой момент"]} />
        {!premiumPlan && <button className="filled-button" onClick={() => upgrade()} disabled={upgradeWaiting}>Выбрать Premium на год</button>}
      </div>}
      {showPack && <div className="pricing-card"><p className="plan-tag">Без подписки</p><h3>{OFFER_TITLES.question_pack}</h3><PlanPrice price={PRICES.question_pack} unit="один раз, без подписки" />
        <Checks items={["Вопросы не сгорают", "Подходит бесплатному аккаунту и Premium"]} />
        <button className="button-secondary" onClick={() => upgrade("pack")} disabled={upgradeWaiting}>Купить пакет</button>
      </div>}
    </div>
    <details className="pricing-terms"><summary>Подробнее об условиях</summary>
      <div className="pricing-terms-body">
        {beta && <p>Бесплатный доступ без продуктовых лимитов действует на время бета-теста. После его завершения возвращаются обычные тарифы: бесплатный план — 3 карты и 10 AI-вопросов за всё время аккаунта, Premium — 10 карт и 300 AI-вопросов за расчётный период. Сохранённые карты и история не удаляются.</p>}
        {!beta && <p>Считаются только успешные AI-ответы. Лимит бесплатного плана действует за всё время аккаунта, Premium — за оплаченный расчётный период. Удаление карты или истории не возвращает вопросы.</p>}
        <p>Неиспользованные вопросы Premium не переносятся на следующий период. Бесплатный план не превращается в платную подписку автоматически. Оплата в RUB через Lava.top, где доступна, — 799 ₽ в месяц с автоматическим продлением до отмены.</p>
        <p>Отмена продления в «Мои карты» → «Управление подпиской». Доступ сохраняется до конца оплаченного периода. Отмена не возвращает оплату автоматически.</p>
        <p>Stripe · автоматическое продление каждый месяц до отмены. Итоговая сумма и применимые налоги — перед подтверждением оплаты. Без пробного периода.</p>
        {showPack && <p>Вопросы не сгорают и тратятся, когда закончатся бесплатные или месячные. Подходит и бесплатному аккаунту, и Premium: пакет добавляет вопросы к вашему лимиту.</p>}
        <BetaPurchaseNote enabled={beta} />
        {showYear && <BetaPurchaseNote enabled={beta} product="premium_year" />}
        {showPack && <BetaPurchaseNote enabled={beta} product="question_pack" />}
      </div>
    </details>
    <PolicyLinks />
    <UsageSummary />
  </section>;
}
