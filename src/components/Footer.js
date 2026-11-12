import React from 'react';
import { Link } from 'react-router-dom';
import { OrbitMark } from './UI';
import { SupportEmail } from './ServiceDisclosures';
import './Footer.css';
import {openCookiePreferences} from '../analytics/consent';

export default function Footer() {
  return <footer className="site-footer"><div className="shell">
    <div className="footer-grid">
      <div className="footer-brand">
        <Link className="brand" to="/" aria-label="Lunaria — на главную"><OrbitMark />Lunaria</Link>
        <p>Астрология и AI.<br />Пространство для самопознания.</p>
        <SupportEmail />
      </div>
      <nav className="footer-nav" aria-labelledby="footer-service-title">
        <h2 id="footer-service-title">Ваше пространство</h2>
        <Link data-analytics="landing_cta_chart" to="/try-free">Создать карту</Link>
        <Link data-analytics="landing_cta_pricing" to="/pricing">Тарифы</Link>
        <Link to="/my-charts">Мои карты</Link>
        <Link to="/terms#cancellation">Отменить продление</Link>
      </nav>
      <nav className="footer-nav" aria-labelledby="footer-info-title">
        <h2 id="footer-info-title">Информация и помощь</h2>
        <Link to="/terms">Условия использования</Link>
        <Link to="/privacy">Конфиденциальность</Link>
        <Link to="/refunds">Возвраты и отмена</Link>
        <Link to="/support">Поддержка</Link>
        <button type="button" className="footer-cookie-settings" onClick={openCookiePreferences}>Настройки cookie</button>
      </nav>
    </div>
    <div className="footer-bottom">
      <p><span className="footer-note-label">Для саморефлексии</span>Астрология не гарантирует события, а AI может ошибаться. Ответы не заменяют профессиональную консультацию.</p>
      <span className="footer-copyright">© {new Date().getFullYear()} Lunaria</span>
    </div>
  </div></footer>;
}
