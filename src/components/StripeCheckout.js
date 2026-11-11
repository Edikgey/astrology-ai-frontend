import React, { useEffect, useMemo, useRef } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { DialogClose } from "./UI";
import BetaPurchaseNote from "./BetaPurchaseNote";

class CheckoutError extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">Не удалось загрузить оплату. Закройте окно и попробуйте снова.</p> : this.props.children;
  }
}

export default function StripeCheckout({ stripe, clientSecret, onComplete, onClose, freeBetaEnabled = false }) {
  const dialog = useRef(null);
  const options = useMemo(() => ({ clientSecret, onComplete }), [clientSecret, onComplete]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="usage-modal stripe-checkout-modal" aria-labelledby="stripe-checkout-title" onCancel={onClose}>
    <DialogClose onClose={onClose} />
    <h2 id="stripe-checkout-title">Lunaria Premium</h2>
    <p>$9.99 USD / месяц · {freeBetaEnabled && "обычные лимиты вне бета-теста: "}10 сохранённых карт · 300 AI-вопросов за расчётный период</p>
    <BetaPurchaseNote enabled={freeBetaEnabled} />
    <p>Автоматическое продление каждый месяц. Отменить продление можно в разделе «Мои карты».</p>
    <CheckoutError><EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider></CheckoutError>
    <button type="button" className="usage-button" onClick={onClose}>Закрыть оплату</button>
  </dialog>;
}
