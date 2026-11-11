import React from 'react';
import { useServiceConfig } from '../context/ServiceConfigContext';
import { useUsage } from '../context/UsageContext';
import './FreeBetaNotice.css';

export default function FreeBetaNotice() {
  const { freeBetaEnabled } = useServiceConfig();
  const { usage } = useUsage();
  const beta = usage ? usage.free_beta_enabled === true : freeBetaEnabled;
  if (!beta) return null;
  return <aside className="free-beta-notice shell" aria-label="Бета-тестирование">
    <strong>Бесплатный бета-тест</strong>
    <span>Карты и AI-вопросы без лимита после входа в аккаунт. Поделитесь впечатлениями через кнопку обратной связи.</span>
  </aside>;
}
