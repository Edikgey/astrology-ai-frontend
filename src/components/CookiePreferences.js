import React,{useEffect,useState} from 'react';
import CookieConsent from 'react-cookie-consent';
import {readConsent,saveConsent,onPreferenceChange,PREFERENCES_EVENT} from '../analytics/consent';
import {clarityAnalytics} from '../analytics/clarity';

export default function CookiePreferences() {
  const [show,setShow]=useState(()=>readConsent()==='undecided');
  useEffect(()=>{
    const open=()=>setShow(true);
    window.addEventListener(PREFERENCES_EVENT,open);
    const unsubscribe=onPreferenceChange(()=>{clarityAnalytics.refresh();});
    return ()=>{window.removeEventListener(PREFERENCES_EVENT,open);unsubscribe();};
  },[]);
  const choose=accepted=>{saveConsent(accepted);setShow(false);clarityAnalytics.refresh();};
  return <CookieConsent visible={show?'show':'hidden'} location="bottom" buttonText="Принять" declineButtonText="Отклонить"
    ariaAcceptLabel="Принять" ariaDeclineLabel="Отклонить"
    enableDeclineButton cookieName="userCookieConsent" disableStyles containerClasses="cookie-banner"
    buttonWrapperClasses="cookie-actions" declineButtonClasses="button-secondary" expires={365}
    cookieSecurity={location.protocol==='https:'} sameSite="lax" onAccept={()=>choose(true)} onDecline={()=>choose(false)}>
    <strong className="cookie-title">Файлы cookie</strong>
    <p className="cookie-description">Мы используем cookie для работы сайта и улучшения вашего опыта. Подробнее — в <a href="/privacy">Политике конфиденциальности</a>.</p>
  </CookieConsent>;
}
