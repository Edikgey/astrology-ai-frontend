import {analyticsHeaders} from '../analytics/productAnalytics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { API_URL } from '../config/api';
import './FeedbackWidget.css';

const LIMIT_TEXT = 'Можно отправить до 3 отзывов за 24 часа. Попробуйте позже.';
const meaningful = text => /[\p{L}\p{N}]/u.test(text.trim());
// Keep the optional context compatible with the deployed backend allowlist.
const contextPath = /^\/(my-charts|daily-horoscope|natal-chart-result(?:\/\d+)?|relationships\/\d+)$/;
const mainPages = new Set(['/', '/pricing', '/try-free', '/relationships/new', '/dashboard']);
export default function FeedbackWidget() {
  const { user, token, loading } = useAuth();
  const { checkoutVisible, busy } = useBilling();
  const { pathname } = useLocation();
  const allowed = mainPages.has(pathname) || contextPath.test(pathname);
  if (!user || !token || loading || !allowed || checkoutVisible || busy) return null;
  // Remount on route/account change: never retain another account's draft or response.
  return <FeedbackControl key={`${user.id}:${token}:${pathname}`} token={token} pathname={pathname} />;
}

function FeedbackControl({ token, pathname }) {
  const [blocked,setBlocked]=useState(false), [bottom,setBottom]=useState(16);
  const [open,setOpen]=useState(false), [category,setCategory]=useState('idea');
  const [message,setMessage]=useState(''), [sending,setSending]=useState(false);
  const [limits,setLimits]=useState(null), [error,setError]=useState(''), [success,setSuccess]=useState(false);
  const [checking,setChecking]=useState(false);
  const dialog=useRef(null), trigger=useRef(null), flight=useRef(false), alive=useRef(true);
  const request=useRef(null), attempt=useRef(null), limitsSequence=useRef(0);
  const count=Array.from(message).length;
  const valid=meaningful(message) && count<=2000;

  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;request.current?.abort();};},[]);
  useEffect(()=>{
    let frame;
    const measure=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const critical=[...document.querySelectorAll('dialog[open]:not(.feedback-dialog), [role="dialog"][aria-modal="true"], .cookie-banner, form[aria-busy="true"], [data-feedback-critical="true"]')]
          .some(el=>!el.closest('.feedback-widget')&&!el.closest('[hidden]')&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
        setBlocked(critical);
        if(critical || !trigger.current) return;
        // Hidden triggers keep their geometry so collision checks cannot toggle visibility repeatedly.
        const box=trigger.current.getBoundingClientRect();
        const controls=[...document.querySelectorAll('button,a,input,textarea,select,nav')]
          .filter(el=>!el.closest('.feedback-widget')).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
        const offsets=Array.from({length:Math.max(1,Math.floor((window.innerHeight-box.height-32)/16)+1)},(_,i)=>16+i*16);
        const free=offsets.find(offset=>{
          const top=window.innerHeight-offset-box.height;
          return !controls.some(r=>r.left<box.right+8&&r.right>box.left-8&&r.top<top+box.height+8&&r.bottom>top-8);
        });
        if(free===undefined) setBlocked(true); else setBottom(free);
      });
    };
    const observer=new MutationObserver(measure);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','hidden','style','aria-busy','aria-modal','data-feedback-critical']});
    window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);measure();
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[]);

  useEffect(()=>{
    if(blocked) {setOpen(false);dialog.current?.close();}
  },[blocked]);
  useEffect(()=>{
    if(open && !blocked) dialog.current?.showModal();
    else dialog.current?.close();
  },[open,blocked]);

  const loadLimits=useCallback(async()=>{
    const sequence=++limitsSequence.current;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    setChecking(true);
    try{
      const response=await fetch(`${API_URL}/feedback/limits`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
      if(!response.ok) throw new Error(response.status===401||response.status===404?'Сессия истекла. Войдите в аккаунт заново.':'Не удалось проверить лимит. Попробуйте ещё раз.');
      const data=await response.json();
      if(alive.current&&sequence===limitsSequence.current){setLimits(data);setError('');}
    }catch(e){if(alive.current&&sequence===limitsSequence.current){setLimits(null);setError(e instanceof TypeError||e.name==='AbortError'?'Не удалось проверить лимит. Попробуйте ещё раз.':e.message);}}
    finally{clearTimeout(timeout);if(alive.current&&sequence===limitsSequence.current)setChecking(false);}
  },[token]);
  useEffect(()=>{
    if(!open || !limits?.retry_after_seconds || limits.remaining>0)return;
    // Server supplies a relative duration; browser clock cannot grant submissions.
    const timer=setTimeout(()=>loadLimits(),Math.min(limits.retry_after_seconds*1000+100,86400100));
    return ()=>clearTimeout(timer);
  },[open,limits,loadLimits]);
  const close=()=>{setOpen(false);dialog.current?.close();trigger.current?.focus();};
  const show=()=>{setOpen(true);setSuccess(false);loadLimits();};
  const send=async event=>{
    event.preventDefault();
    if(flight.current||!valid||!limits?.remaining||checking)return;
    flight.current=true;setSending(true);setError('');
    const payload={category,message:message.trim(),...(contextPath.test(pathname)?{page_path:pathname}:{})};
    const signature=JSON.stringify(payload);
    if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
    const controller=new AbortController();request.current=controller;
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(`${API_URL}/feedback`,{method:'POST',headers:{...analyticsHeaders(),'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({...payload,request_id:attempt.current.id}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!alive.current)return;
      if(!response.ok){
        if(response.status===429){setLimits({remaining:0,retry_after_seconds:data.detail?.retry_after_seconds||86400});throw new Error(LIMIT_TEXT);}
        throw new Error(response.status===401||response.status===404?'Сессия истекла. Войдите в аккаунт заново.':
          [413,415,422].includes(response.status)?'Проверьте текст: от 1 до 2000 символов, без вложений.':
          'Не удалось отправить отзыв. Попробуйте ещё раз.');
      }
      limitsSequence.current++;setChecking(false);setLimits(data);setSuccess(true);setMessage('');setCategory('idea');attempt.current=null;
    }catch(e){if(alive.current)setError(e.name==='AbortError'||e instanceof TypeError?'Нет соединения с сервером. Попробуйте ещё раз.':e.message);}
    finally{clearTimeout(timer);flight.current=false;if(alive.current)setSending(false);}
  };
  return <div className="feedback-widget" style={{'--feedback-bottom':`${bottom}px`}}>
    <button ref={trigger} type="button" className="feedback-trigger" hidden={blocked} onClick={show}
      aria-label="Есть идея? Оставить отзыв" aria-haspopup="dialog" aria-expanded={open} aria-controls="feedback-dialog">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 18h8m-7 3h6M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7v1H8z" /></svg>
      <span>Есть идея?</span>
    </button>
    <dialog ref={dialog} id="feedback-dialog" className="feedback-dialog" aria-labelledby="feedback-title" aria-describedby="feedback-subtitle"
      onCancel={e=>{e.preventDefault();close();}}>
      <button type="button" className="button-secondary feedback-close" aria-label="Закрыть отзыв" onClick={close}>×</button>
      <h2 id="feedback-title">Помоги улучшить Lunaria</h2>
      <p id="feedback-subtitle">Расскажи, чего тебе не хватает или что можно улучшить.</p>
      {success?<div role="status" className="feedback-thanks">Спасибо! Твой отзыв отправлен.</div>:<form onSubmit={send}>
        <label htmlFor="feedback-category">Тип отзыва</label>
        <select id="feedback-category" value={category} disabled={sending} onChange={e=>setCategory(e.target.value)}>
          <option value="idea">Предложить идею</option><option value="bug">Сообщить о проблеме</option><option value="feedback">Поделиться впечатлением</option>
        </select>
        <label htmlFor="feedback-message">Твой отзыв</label>
        <textarea id="feedback-message" rows={5} maxLength={4000} value={message} disabled={sending}
          placeholder="Что можно добавить или улучшить?" aria-describedby="feedback-counter feedback-hint"
          onChange={e=>setMessage(Array.from(e.target.value).slice(0,2000).join(''))} />
        <p id="feedback-counter" className="feedback-counter">{count} / 2000</p>
        <p id="feedback-hint" className="feedback-hint">Не указывай пароли, платёжные данные или личные данные других людей. Без вложений.</p>
        {message&&!meaningful(message)&&<p role="alert">Добавь текст отзыва, а не только пробелы или символы.</p>}
        {limits?.remaining===0&&<p role="status">{LIMIT_TEXT}</p>}
        {limits?.remaining>0&&<p className="feedback-hint">Можно отправить ещё {limits.remaining} из 3 отзывов за 24 часа.</p>}
        {error&&<p role="alert">{error}</p>}
        {!limits&&!checking&&<button type="button" className="button-secondary" onClick={loadLimits}>Проверить лимит снова</button>}
        <button type="submit" disabled={!valid||sending||checking||!limits?.remaining}>{sending?'Отправляем…':checking?'Проверяем лимит…':'Отправить отзыв'}</button>
      </form>}
    </dialog>
  </div>;
}
