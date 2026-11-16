import React from "react";
import { OFFER_TITLES, PREMIUM_CHART_LIMIT, PREMIUM_GPT_LIMIT, PRICES } from "../config/plans";
import { STRIPE_UNCONFIGURED_TEXT } from "../api/apiError";
import { providersFor } from "../utils/offers";
import { useBilling } from "../context/BillingContext";
import BetaPurchaseNote from "./BetaPurchaseNote";
import "./Usage.css";

// The words of the offers, one source for the pricing page and the payment windows.
export const yearSaving = (perMonth, saving) => `${perMonth} в месяц, выгоднее на ${saving}%`;
export const RENEWAL = { premium_month: "Продление каждый месяц, отмена в любой момент", premium_year: "Продление раз в год, отмена в любой момент" };
export const YEAR_SAME = `Те же ${PREMIUM_GPT_LIMIT} вопросов каждый месяц`;
export const PACK_SPENDING = "Вопросы не сгорают и тратятся, когда закончатся бесплатные или месячные.";

const price = (product, currency) => {
  const value = PRICES[product];
  if (product === "premium_month") return `${value[currency]} в месяц`;
  if (product === "question_pack") return `${value[currency]} один раз, без подписки`;
  const perMonth = currency === "usd" ? value.usdPerMonth : value.rubPerMonth;
  const saving = currency === "usd" ? value.usdSaving : value.rubSaving;
  return `${value[currency]} в год — это ${yearSaving(perMonth, saving)}`;
};
const premiumBlurb = product => `${PREMIUM_GPT_LIMIT} AI-вопросов в месяц и до ${PREMIUM_CHART_LIMIT} сохранённых карт. ${RENEWAL[product]}.`;
const BLURB = { premium_month: premiumBlurb("premium_month"), premium_year: premiumBlurb("premium_year"), question_pack: PACK_SPENDING };

// Prices and what the buyer gets; shared by the pricing page and the payment options. Providers say whose price is shown;
// in the beta the product's own beta note follows.
export function OfferDetails({ product, stripe = true, lava = true, beta = false }) {
  return <>
    {stripe && <p className="offer-price">{price(product, "usd")}</p>}
    {lava && <p className="offer-price">{price(product, "rub")}</p>}
    <p className="offer-blurb">{BLURB[product]}</p>
    <BetaPurchaseNote enabled={beta} product={product} />
  </>;
}

// Waiting, the server message and the payment error of the provider that started the checkout.
function PaymentFeedback({ stripeMissing }) {
  const billing = useBilling();
  return <div className="payment-feedback" aria-live="polite">
    {stripeMissing && <p role="status">{STRIPE_UNCONFIGURED_TEXT}</p>}
    {billing.feedbackProvider && <>
      {billing.busy && <p role="status">Проверяем оплату…</p>}
      {billing.message && <p role="status">{billing.message}</p>}
      {billing.error && <p role="alert">{billing.error}</p>}
    </>}
  </div>;
}

// The two ways to pay for one product (decision 50): blocks of one kind, prices of one class, neither is highlighted.
// A way the server does not sell now is not shown; the caller says what to do when there is none.
const METHODS = [
  { provider: "stripe", name: "Карта любой страны", currency: "usd", cards: "Visa, Mastercard и другие карты. Оплата в долларах в окне Stripe." },
  { provider: "lava", name: "Карта российского банка", currency: "rub", cards: "Оплата картой в рублях на странице Lava.top — откроется в новой вкладке." },
];
export function PaymentMethods({ usage, product }) {
  const billing = useBilling();
  const sold = providersFor(usage, product);
  const shown = METHODS.filter(method => sold[method.provider]);
  if (!shown.length) return null;
  const start = provider => provider === "stripe" ? billing.startCheckout(product) : billing.startLavaCheckout(product);
  const blocked = provider => billing.busy || (provider === "stripe" && !billing.stripeConfigured);
  return <>
    <div className="pay-methods">
      {shown.map(({ provider, name, currency, cards }) => <section key={provider} className="pay-method" aria-label={name}>
        <h3 className="pay-method-name">{name}</h3>
        <p className="pay-method-price">{price(product, currency)}</p>
        <p className="pay-method-cards">{cards}</p>
        {provider === "stripe" && !billing.stripeConfigured && <p role="status" className="pay-method-notice">{STRIPE_UNCONFIGURED_TEXT}</p>}
        <button type="button" className="usage-button" disabled={blocked(provider)}
          onClick={() => start(provider)}>{`Оплатить ${PRICES[product][currency]}`}</button>
      </section>)}
    </div>
    <PaymentFeedback />
  </>;
}

// One container per option with its own payment buttons; an option the server does not offer is not shown.
export default function OfferOptions({ usage, products }) {
  const billing = useBilling();
  const shown = products.map(product => ({ product, ...providersFor(usage, product) })).filter(item => item.stripe || item.lava);
  if (!shown.length) return null;
  return <>
    <div className="offer-options">
      {shown.map(({ product, stripe, lava }) => <section key={product} className="offer-option" aria-label={OFFER_TITLES[product]}>
        <h3>{OFFER_TITLES[product]}</h3>
        <OfferDetails product={product} stripe={stripe} lava={lava} beta={usage?.free_beta_enabled === true} />
        <div className="offer-buttons">
          {stripe && <button type="button" className="usage-button" disabled={!billing.stripeConfigured || billing.busy}
            onClick={() => billing.startCheckout(product)}>Оплатить через Stripe</button>}
          {lava && <button type="button" className="usage-button" disabled={billing.busy}
            onClick={() => billing.startLavaCheckout(product)}>Оплатить в RUB</button>}
        </div>
      </section>)}
    </div>
    <PaymentFeedback stripeMissing={shown.some(item => item.stripe) && !billing.stripeConfigured} />
  </>;
}
