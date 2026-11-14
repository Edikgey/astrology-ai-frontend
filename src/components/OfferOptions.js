import React from "react";
import { OFFER_TITLES, PACK_SIZE, PREMIUM_CHART_LIMIT, PREMIUM_GPT_LIMIT, PRICES } from "../config/plans";
import { providersFor } from "../utils/offers";
import { useBilling } from "../context/BillingContext";
import "./Usage.css";

const price = (product, currency, savings = true) => {
  const value = PRICES[product];
  if (product === "premium_month") return `${value[currency]} в месяц`;
  if (product === "question_pack") return `${value[currency]} один раз, без подписки`;
  const perMonth = currency === "usd" ? value.usdPerMonth : value.rubPerMonth;
  const saving = currency === "usd" ? value.usdSaving : value.rubSaving;
  return `${value[currency]} в год — это ${perMonth} в месяц${savings ? `, выгоднее на ${saving} %` : ""}`;
};
const BLURB = {
  premium_month: `${PREMIUM_GPT_LIMIT} AI-вопросов в месяц и до ${PREMIUM_CHART_LIMIT} сохранённых карт. Продление каждый месяц, отмена в любой момент.`,
  premium_year: `Те же ${PREMIUM_GPT_LIMIT} вопросов каждый месяц и ${PREMIUM_CHART_LIMIT} карт. Продление раз в год, отмена в любой момент.`,
  question_pack: "Вопросы не сгорают и тратятся, когда закончатся бесплатные или месячные.",
};

// Prices and what the buyer gets; shared by the pricing page and the payment options. Providers say whose price is shown.
export function OfferDetails({ product, stripe = true, lava = true }) {
  return <>
    {stripe && <p className="offer-price">{price(product, "usd")}</p>}
    {lava && <p className="offer-price">{price(product, "rub")}</p>}
    <p className="offer-blurb">{BLURB[product]}</p>
  </>;
}

// One container per option with its own payment buttons; an option the server does not offer is not shown.
export default function OfferOptions({ usage, products }) {
  const billing = useBilling();
  const shown = products.map(product => ({ product, ...providersFor(usage, product) })).filter(item => item.stripe || item.lava);
  if (!shown.length) return null;
  const stripeMissing = shown.some(item => item.stripe) && !billing.stripeConfigured;
  const feedback = billing.feedbackProvider;
  return <>
    <div className="offer-options">
      {shown.map(({ product, stripe, lava }) => <section key={product} className="offer-option" aria-label={OFFER_TITLES[product]}>
        <h3>{OFFER_TITLES[product]}</h3>
        <OfferDetails product={product} stripe={stripe} lava={lava} />
        <div className="offer-buttons">
          {stripe && <button type="button" className="usage-button" disabled={!billing.stripeConfigured || billing.busy}
            onClick={() => billing.startCheckout(product)}>Оплатить через Stripe</button>}
          {lava && <button type="button" className="usage-button" disabled={billing.busy}
            onClick={() => billing.startLavaCheckout(product)}>Оплатить в RUB</button>}
        </div>
      </section>)}
    </div>
    <div className="payment-feedback" aria-live="polite">
      {stripeMissing && <p role="status">Оплата пока не настроена.</p>}
      {feedback && <>
        {billing.busy && <p role="status">Проверяем оплату…</p>}
        {billing.message && <p role="status">{billing.message}</p>}
        {billing.error && <p role="alert">{billing.error}</p>}
      </>}
    </div>
  </>;
}
