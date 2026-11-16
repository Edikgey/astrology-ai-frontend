import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUsage } from '../context/UsageContext';
import { LANDING_RELATIONSHIP_INTENT } from '../pages/landingIntent';
import { OrbitMark } from './UI';
import './Header.css';

// Same breakpoint as `@media (max-width: 960px)` in Header.css: on a phone the groups are plain headings with their items.
const NARROW = '(max-width: 960px)';
function useNarrow() {
  const query = () => window.matchMedia?.(NARROW);
  const [narrow, setNarrow] = useState(() => !!query()?.matches);
  useEffect(() => {
    const media = query();
    if (!media) return undefined;
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return narrow;
}

// A drop-down opened by a click (one at a time: `openId` is shared); on a phone just a heading above its items.
function NavGroup({ id, label, narrow, openId, setOpenId, triggers, className = '', children }) {
  const isOpen = openId === id;
  if (narrow) return <div className={`nav-group ${className}`}><p className="nav-group-title">{label}</p>{children}</div>;
  return <div className={`nav-group ${className}`}>
    <button type="button" ref={element => { triggers.current[id] = element; }} className="nav-trigger" aria-expanded={isOpen}
      aria-controls={`nav-menu-${id}`} onClick={() => setOpenId(isOpen ? null : id)}>{label} <span className="nav-caret" aria-hidden="true">▾</span></button>
    <div id={`nav-menu-${id}`} className="nav-menu" hidden={!isOpen}>{children}</div>
  </div>;
}

export default function Header() {
  const { user, loading, logout, activeGuestChart } = useAuth();
  const { usage } = useUsage();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const nav = useRef(null);
  const toggle = useRef(null);
  const triggers = useRef({});
  const navigate = useNavigate();
  const narrow = useNarrow();
  useEffect(() => setOpenId(null), [narrow]); // a drop-down left open must not survive the switch to the phone layout
  useEffect(() => {
    const outside = event => { if (!nav.current?.contains(event.target)) { setOpen(false); setOpenId(null); } };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const close = () => { setOpen(false); setOpenId(null); };
  // Escape on `document`, only while something is open: Safari/Firefox on macOS do not focus a button on a mouse click, so the key may not reach `nav`.
  const anyOpen = !!openId || open;
  useEffect(() => {
    if (!anyOpen) return undefined;
    const escape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return; // a dialog or field that already used Escape keeps it
      if (openId) { triggers.current[openId]?.focus(); setOpenId(null); }
      else { setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [anyOpen, openId]);
  const login = () => {
    close();
    navigate('/authorization', activeGuestChart ? { state: {
      guestChart: activeGuestChart, returnTo: `/natal-chart-result/${activeGuestChart.chartId}`,
    } } : undefined);
  };
  const group = { narrow, openId, setOpenId, triggers };
  const plan = usage?.plan === 'premium' ? 'Premium' : usage?.plan === 'free' ? 'Бесплатно' : 'Аккаунт';
  return <header className="site-header"><nav className="navbar shell" aria-label="Основная навигация" ref={nav}
    onBlur={event => { if (event.relatedTarget && !nav.current?.contains(event.relatedTarget)) setOpenId(null); }}>
    <Link className="brand" to="/" onClick={close} aria-label="Lunaria — главная"><OrbitMark />Lunaria</Link>
    <button ref={toggle} className="nav-toggle button-secondary" aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(value => !value)}>{open ? 'Закрыть' : 'Меню'} <span aria-hidden="true">{open ? '×' : '☰'}</span></button>
    <div id="main-navigation" className={`nav-links ${open ? 'is-open' : ''}`}>
      <div className="nav-main">
        <NavGroup id="forecasts" label="Прогнозы" {...group}>
          <Link className="nav-link" to="/my-month" onClick={close}>Мой месяц</Link>
          <Link className="nav-link" to="/moon" onClick={close}>Луна сегодня</Link>
          <Link className="nav-link" to="/my-year" onClick={close}>Мой год</Link>
        </NavGroup>
        <NavGroup id="readings" label="Разборы" {...group}>
          <Link className="nav-link" to="/topics" onClick={close}>По темам</Link>
          <Link className="nav-link" to={user ? '/relationships/new' : '/try-free'}
            state={user ? undefined : { landingRelationshipIntent: LANDING_RELATIONSHIP_INTENT }}
            onClick={close}>Отношения</Link>
        </NavGroup>
        <Link className="nav-link nav-link-top" data-analytics="landing_cta_pricing" to="/pricing" onClick={close}>Тарифы</Link>
      </div>
      <div className="nav-side">
        {user && <Link className="nav-link nav-link-top" to="/my-charts" onClick={close}>Мои карты</Link>}
        <Link className="button nav-cta" data-analytics="landing_cta_chart" to="/try-free" onClick={close}>Создать карту</Link>
        {user ? <NavGroup id="account" label={plan} className="nav-account" {...group}>
          <Link className="nav-link" to="/pricing" onClick={close}>Подписка</Link>
          <button type="button" className="nav-link" onClick={() => { close(); logout(); navigate('/'); }}>Выйти</button>
        </NavGroup> :
          <button data-analytics="landing_cta_login" className="login-btn button-secondary" disabled={loading} onClick={login}>Войти</button>}
      </div>
    </div>
  </nav></header>;
}
