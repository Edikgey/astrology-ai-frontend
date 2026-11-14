import React, { useEffect, useMemo, useRef } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { DialogClose } from "./UI";
import BetaPurchaseNote from "./BetaPurchaseNote";
import { PACK_SIZE, PREMIUM_CHART_LIMIT, PREMIUM_GPT_LIMIT, PRICES } from "../config/plans";

class CheckoutError extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">Не удалось загрузить оплату. Закройте окно и попробуйте снова.</p> : this.props.children;
  }
}

export default function StripeCheckout({ stripe, clientSecret, onComplete, onClose, freeBetaEnabled = false, product = "premium_month" }) {
  const dialog = useRef(null);
  const options = useMemo(() => ({ clientSecret, onComplete }), [clientSecret, onComplete]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="usage-modal stripe-checkout-modal" aria-labelledby="stripe-checkout-title" onCancel={onClose}>
    <DialogClose onClose={onClose} />
    {product === "question_pack" ? <>
      <h2 id="stripe-checkout-title">Пакет вопросов Lunaria</h2>
      <p>+{PACK_SIZE} вопросов · {PRICES.question_pack.usd} USD один раз, без подписки</p>
      <p>Вопросы не сгорают и тратятся, когда закончатся бесплатные или месячные. Пакет не меняет вашу подписку.</p>
    </> : product === "premium_year" ? <>
      <h2 id="stripe-checkout-title">Lunaria Premium на год</h2>
      <p>{PRICES.premium_year.usd} USD / год · {PREMIUM_CHART_LIMIT} сохранённых карт · {PREMIUM_GPT_LIMIT} AI-вопросов каждый месяц</p>
      <p>Продление раз в год, отмена в любой момент. Отменить продление можно в разделе «Мои карты».</p>
    </> : <>
      <h2 id="stripe-checkout-title">Lunaria Premium</h2>
      <p>{PRICES.premium_month.usd} USD / месяц · {freeBetaEnabled && "обычные лимиты вне бета-теста: "}10 сохранённых карт · 300 AI-вопросов за расчётный период</p>
      <BetaPurchaseNote enabled={freeBetaEnabled} />
      <p>Автоматическое продление каждый месяц. Отменить продление можно в разделе «Мои карты».</p>
    </>}
    <CheckoutError><EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider></CheckoutError>
    <button type="button" className="usage-button" onClick={onClose}>Закрыть оплату</button>
  </dialog>;
}
