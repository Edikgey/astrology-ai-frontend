import React from 'react';
import { useServiceConfig } from '../context/ServiceConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUsage } from '../context/UsageContext';
import './FreeBetaNotice.css';

export default function FreeBetaNotice() {
  const { freeBetaEnabled } = useServiceConfig();
  const { user } = useAuth();
  const { usage } = useUsage();
  const beta = usage ? usage.free_beta_enabled === true : freeBetaEnabled;
  if (!beta) return null;
  return <aside className="free-beta-notice shell" aria-label="Бета-тестирование">
    <strong>Бесплатный бета-тест</strong>
    {/* Кнопка отзыва есть только у вошедших: гостю про неё не пишем. */}
    <span>{user ? 'Карты и AI-вопросы без лимита. Поделитесь впечатлениями через кнопку «Есть идея?».' : 'Карты и AI-вопросы без лимита после входа в аккаунт.'}</span>
  </aside>;
}
