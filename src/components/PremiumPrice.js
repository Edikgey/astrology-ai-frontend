import React from "react";

export default function PremiumPrice() {
  return <div className="premium-price"><p className="price-value">$9.99 USD <span>/ месяц</span></p>
    <small>Stripe · автоматическое продление каждый месяц до отмены.</small>
    <small>Итоговая сумма и применимые налоги — перед подтверждением оплаты.</small><small>Без пробного периода.</small></div>;
}
