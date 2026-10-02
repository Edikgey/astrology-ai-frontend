import React from 'react';
import { Link } from 'react-router-dom';
import { OrbitMark } from './UI';
import './Footer.css';
export default function Footer() {
  return <footer className="site-footer"><div className="shell">
    <div className="footer-top"><Link className="brand" to="/"><OrbitMark />Lunaria</Link>
      <div className="footer-links"><Link to="/try-free">Создать карту</Link><Link to="/pricing">Free & Premium</Link><Link to="/my-charts">Мои карты</Link></div></div>
    <nav className="footer-links footer-legal" aria-label="Правовая информация и поддержка">
      <Link to="/terms">Условия использования</Link><Link to="/privacy">Конфиденциальность</Link>
      <Link to="/refunds">Возвраты и отмена</Link><Link to="/support">Поддержка</Link>
    </nav>
    <div className="footer-bottom"><p>Астрология — язык саморефлексии. Ответы AI не заменяют профессиональную консультацию.</p><span>© {new Date().getFullYear()} Lunaria</span></div>
  </div></footer>;
}
