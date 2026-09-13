import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUsage } from '../context/UsageContext';
import { OrbitMark } from './UI';
import './Header.css';

export default function Header() {
  const { user, loading, logout, activeGuestChart } = useAuth();
  const { usage } = useUsage();
  const [open, setOpen] = useState(false);
  const nav = useRef(null);
  const toggle = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const outside = event => { if (!nav.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const close = () => setOpen(false);
  const login = () => {
    close();
    navigate('/authorization', activeGuestChart ? { state: {
      guestChart: activeGuestChart, returnTo: `/natal-chart-result/${activeGuestChart.chartId}`,
    } } : undefined);
  };
  return <header className="site-header"><nav className="navbar shell" aria-label="Основная навигация" ref={nav}
    onKeyDown={event => { if (event.key === 'Escape' && open) { close(); toggle.current?.focus(); } }}>
    <Link className="brand" to="/" onClick={close} aria-label="AstrologyAI — главная"><OrbitMark />Astrology<span>AI</span></Link>
    <button ref={toggle} className="nav-toggle button-secondary" aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(value => !value)}>{open ? 'Закрыть' : 'Меню'} <span aria-hidden="true">{open ? '×' : '☰'}</span></button>
    <div id="main-navigation" className={`nav-links ${open ? 'is-open' : ''}`}>
      <Link to="/try-free" onClick={close}>Создать карту</Link>
      {user && <Link to="/my-charts" onClick={close}>Мои карты</Link>}
      <Link to="/pricing" onClick={close}>Free & Premium</Link>
      {user ? <div className="nav-account"><Link to="/pricing" className="badge badge-accent" onClick={close}>{usage?.plan === 'premium' ? 'Premium' : usage?.plan === 'free' ? 'Free' : 'Аккаунт'}</Link>
        <button className="button-secondary" onClick={() => { close(); logout(); navigate('/'); }}>Выйти</button></div> :
        <button className="login-btn button-secondary" disabled={loading} onClick={login}>Войти</button>}
    </div>
  </nav></header>;
}
