import React from 'react';
import './FreeBetaNotice.css';

export default function BetaPurchaseNote({ enabled }) {
  return enabled ? <p className="beta-purchase-note">Во время бета-теста карты и AI-вопросы доступны бесплатно без лимита. Покупка Premium необязательна и оформляет платную подписку с ежемесячным продлением.</p> : null;
}
