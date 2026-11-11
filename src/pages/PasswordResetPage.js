import React, {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {resetPassword} from '../api/authApi';
import {captureResetToken, clearResetToken} from '../security/passwordResetToken';
import PasswordRequirements from '../components/PasswordRequirements';
import {validNewPassword} from '../utils/passwordPolicy';
import './AuthorizationPage.css';

export default function PasswordResetPage() {
  const [token, setToken] = useState(captureResetToken);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const alive = useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearResetToken();};},[]);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  const flight = useRef(false);
  const {logout} = useAuth();
  const valid = validNewPassword(password) && confirmation === password;
  const submit = async event => {
    event.preventDefault();
    if (flight.current || !token || !valid || cooldown) return;
    const sessionAtSubmit = localStorage.getItem('access_token');
    flight.current = true; setBusy(true); setError('');
    try {
      await resetPassword(token, password, confirmation);
      if(!alive.current)return;
      clearResetToken(); setToken(''); setPassword(''); setConfirmation('');
      if(localStorage.getItem('access_token')===sessionAtSubmit)logout();
      setDone(true);
    } catch (e) { if(alive.current){setError(e.message);if(e.retryAfter)setCooldown(e.retryAfter);} }
    finally { flight.current = false; if(alive.current)setBusy(false); }
  };
  return <div className="password-reset-page page"><section className="auth-container card">
    <p className="eyebrow">Lunaria</p><h1 className="auth-title">Новый пароль</h1>
    {done ? <><p role="status">Пароль изменён. Войдите в аккаунт с новым паролем.</p><Link to="/authorization">Войти в аккаунт</Link></> : !token ?
      <><p role="alert">Ссылка недействительна или срок её действия истёк. Запросите новую ссылку.</p>
        <Link to="/authorization" state={{mode:'recover'}}>Восстановить пароль</Link></> :
      <><p className="auth-description">Задайте новый пароль для вашего аккаунта.</p>
      <form onSubmit={submit} className="auth-form" aria-busy={busy}>
        <label htmlFor="reset-password">Новый пароль</label>
        <input id="reset-password" type="password" autoComplete="new-password" required value={password}
          aria-describedby="password-requirements" onChange={e=>setPassword(e.target.value)} />
        <PasswordRequirements password={password}/>
        <label htmlFor="reset-confirmation">Повторите пароль</label>
        <input id="reset-confirmation" type="password" autoComplete="new-password" required value={confirmation}
          aria-describedby="reset-match" aria-invalid={!!confirmation && confirmation!==password} onChange={e=>setConfirmation(e.target.value)} />
        <p id="reset-match" className="password-confirmation" aria-live="polite">{confirmation ? confirmation===password ? 'Пароли совпадают.' : 'Пароли не совпадают.' : 'Введите пароль ещё раз.'}</p>
        {error && <p role="alert">{error}</p>}
        {cooldown>0 && <p className="auth-retry" role="status">Повторный запрос через {cooldown} сек.</p>}
        <button type="submit" className="auth-submit" disabled={busy || !valid || cooldown>0}>{busy ? 'Подождите...' : 'Сохранить пароль'}</button>
      </form><p className="auth-retry"><Link to="/authorization" state={{mode:'recover'}}>Запросить новую ссылку</Link></p></>}
  </section></div>;
}
