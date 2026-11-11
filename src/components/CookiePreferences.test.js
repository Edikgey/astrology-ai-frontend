import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import CookiePreferences from './CookiePreferences';
import AnalyticsExclusion from './AnalyticsExclusion';
import {readConsent,openCookiePreferences,isExcluded} from '../analytics/consent';

let root,container;
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();sessionStorage.clear();
  for(const name of document.cookie.split(';').map(v=>v.trim().split('=')[0]))document.cookie=`${name}=; Max-Age=0; Path=/`;
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=()=>act(async()=>root.render(<CookiePreferences />));
const click=text=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===text).click());
test('one existing styled banner; explicit accept, persistence, reopen and withdrawal',async()=>{
  await render();expect(container.querySelectorAll('.cookie-banner')).toHaveLength(1);expect(readConsent()).toBe('undecided');
  await click('Принять');expect(readConsent()).toBe('accepted');expect(container.querySelector('.cookie-banner')).toBeNull();
  await act(async()=>openCookiePreferences());expect(container.querySelectorAll('.cookie-banner')).toHaveLength(1);
  await click('Отклонить');expect(readConsent()).toBe('rejected');
  await act(async()=>root.unmount());root=createRoot(container);await render();expect(container.querySelector('.cookie-banner')).toBeNull();
});
test('owner exclusion remains available on privacy page outside the two-button banner',async()=>{
  await act(async()=>root.render(<><CookiePreferences /><AnalyticsExclusion /></>));await click('Не учитывать мои посещения');expect(isExcluded()).toBe(true);expect(readConsent()).toBe('undecided');
  await click('Отклонить');expect(document.querySelector('script[src*="clarity.ms"]')).toBeNull();expect(readConsent()).toBe('rejected');
});

test('compact exact copy and only accept/reject, with working privacy link',async()=>{
  await render();const banner=container.querySelector('.cookie-banner');
  expect(banner.querySelector('.cookie-title').textContent).toBe('Файлы cookie');
  expect(banner.querySelector('.cookie-description').textContent).toBe('Мы используем cookie для работы сайта и улучшения вашего опыта. Подробнее — в Политике конфиденциальности.');
  expect([...banner.querySelectorAll('button')].map(b=>b.textContent).sort()).toEqual(['Отклонить','Принять'].sort());
  expect(banner.querySelector('a').getAttribute('href')).toBe('/privacy');
  expect([...banner.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')).sort()).toEqual(['Отклонить','Принять'].sort());
  expect(banner.textContent).not.toMatch(/Clarity|платёж|Microsoft|персональн/);
});
