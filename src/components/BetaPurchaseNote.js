import React from 'react';
import './FreeBetaNotice.css';

const PREFIX = "Во время бета-теста карты и AI-вопросы доступны бесплатно без лимита.";
const NOTES = {
  premium_month: `${PREFIX} Покупка Premium необязательна и оформляет платную подписку с ежемесячным продлением.`,
  premium_year: `${PREFIX} Покупка Premium на год необязательна и оформляет платную подписку с ежегодным продлением.`,
  question_pack: `${PREFIX} Покупка пакета необязательна: его вопросы не тратятся до конца бета-теста и не сгорают.`,
};

// The beta note of one product (decision 41); the month by default.
export default function BetaPurchaseNote({ enabled, product = "premium_month" }) {
  return enabled && NOTES[product] ? <p className="beta-purchase-note">{NOTES[product]}</p> : null;
}
