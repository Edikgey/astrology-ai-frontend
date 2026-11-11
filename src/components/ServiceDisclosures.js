import React from 'react';
import './ServiceDisclosures.css';

export const SUPPLIER_NAME = 'Viacheslav Ponomarov';
export const SUPPORT_EMAIL = 'lunariaai.support@gmail.com';

export function SupportEmail() {
  return <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
}

export function SupplierDisclosure() {
  return <p className="supplier-disclosure">Поставщик услуги: {SUPPLIER_NAME}, физическое лицо, ведущее самостоятельную предпринимательскую деятельность в Онтарио, Канада (Ontario, Canada). Lunaria — название продукта, не отдельное юридическое лицо и не зарегистрированное фирменное наименование.</p>;
}

// Plain links also work inside the payment dialogs and preserve the open checkout.
export function PolicyLinks() {
  return <nav className="policy-links" aria-label="Условия покупки (откроются в новой вкладке)">
    <a href="/terms" target="_blank" rel="noopener noreferrer">Условия</a>
    <a href="/privacy" target="_blank" rel="noopener noreferrer">Конфиденциальность</a>
    <a href="/refunds" target="_blank" rel="noopener noreferrer">Возвраты и отмена</a>
    <a href="/support" target="_blank" rel="noopener noreferrer">Поддержка</a>
  </nav>;
}
