import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentity } from '../api/googleIdentity';

export default function GoogleSignIn({ onSignIn, disabled = false, clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID }) {
  const button = useRef(null);
  const handler = useRef(onSignIn);
  handler.current = onSignIn;
  const blocked = useRef(disabled);
  blocked.current = disabled;
  const working = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(null);
  const [password, setPassword] = useState('');
  const alive = useRef(false);

  const submit = async (credential, nonce, confirmation) => {
    if (working.current || blocked.current) return;
    working.current = true;
    setError(''); setNotice('Проверяем вход Google…');
    try {
      await handler.current(credential, nonce, confirmation);
      if (alive.current) { setPending(null); setPassword(''); setNotice(''); }
    } catch (err) {
      if (!alive.current) return;
      setNotice('');
      if (err.code === 'google_link_confirmation_required') setPending({ credential, nonce });
      setError(err.message || 'Не удалось войти через Google. Попробуйте снова.');
    } finally { working.current = false; }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    setReady(false); setError('');
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    loadGoogleIdentity().then(gis => {
      if (!active || !button.current) return;
      gis.initialize({ client_id: clientId, ux_mode: 'popup', auto_select: false, nonce,
        callback: response => {
          if (!active) return;
          if (!response?.credential) { setError('Google не подтвердил вход. Повторите попытку.'); return; }
          submitRef.current(response.credential, nonce);
        },
      });
      button.current.replaceChildren();
      gis.renderButton(button.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'ru',
        width: Math.min(360, Math.max(200, button.current.clientWidth)),
        click_listener: () => { if (active) { setError(''); setNotice('Завершите вход в окне Google. Если вы закрыли его, можно нажать кнопку снова.'); } },
      });
      setReady(true);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [clientId, retry]);

  if (!clientId) return null; // No fake or non-working button without configuration.
  return <section className="google-auth" aria-label="Вход через Google">
    <div ref={button} inert={disabled ? '' : undefined} style={disabled ? { pointerEvents: 'none', opacity: .5 } : undefined} />
    {!ready && !error && <p role="status">Загрузка Google…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {!ready && error && <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>Повторить загрузку Google</button>}
    {pending && <form onSubmit={event => { event.preventDefault(); submit(pending.credential, pending.nonce, password); }}>
      <label htmlFor="google-link-password">Пароль существующего аккаунта Lunaria</label>
      <input id="google-link-password" type="password" autoComplete="current-password" required value={password} disabled={disabled} onChange={event => setPassword(event.target.value)} />
      <button type="submit" disabled={disabled || !password}>Подтвердить и связать Google</button>
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => { setPending(null); setPassword(''); setError(''); }}>Отмена</button>
    </form>}
    <p className="google-divider">или используйте email</p>
  </section>;
}
