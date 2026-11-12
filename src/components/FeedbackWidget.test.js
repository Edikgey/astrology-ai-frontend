import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import FeedbackWidget from './FeedbackWidget';
let mockAuth,mockBilling,mockPath;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('../context/BillingContext',()=>({useBilling:()=>mockBilling}));
jest.mock('react-router-dom',()=>({useLocation:()=>({pathname:mockPath})}),{virtual:true});
let root,container,originalFetch,originalCrypto,frame;
const ok=data=>({ok:true,status:200,json:async()=>data});
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  mockAuth={user:{id:1},token:'jwt',loading:false};mockBilling={};mockPath='/my-charts';
  originalFetch=global.fetch;global.fetch=jest.fn(async()=>ok({remaining:3,limit:3,retry_after_seconds:0}));
  jest.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frame=fn;return 1;});
  jest.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  originalCrypto=global.crypto;
  Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:jest.fn(()=> '00000000-0000-4000-8000-000000000001')}});
  HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button').focus();};
  HTMLDialogElement.prototype.close=function(){this.open=false;};
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();global.fetch=originalFetch;Object.defineProperty(global,'crypto',{configurable:true,value:originalCrypto});jest.restoreAllMocks();});
const render=()=>act(async()=>root.render(<React.StrictMode><FeedbackWidget /></React.StrictMode>));
const click=selector=>act(async()=>container.querySelector(selector).click());
const input=async(value,selector='textarea')=>act(async()=>{
  const el=container.querySelector(selector);
  const prototype=selector==='textarea'?HTMLTextAreaElement.prototype:HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);
  el.dispatchEvent(new Event(selector==='textarea'?'input':'change',{bubbles:true}));
});
const open=async()=>{await render();await click('.feedback-trigger');};
const posts=()=>global.fetch.mock.calls.filter(([,o])=>o?.method==='POST');

test('closed by default; accessible trigger opens dialog and close restores focus',async()=>{
  await render();expect(container.querySelector('dialog').open).toBe(false);expect(global.fetch).not.toHaveBeenCalled();
  const trigger=container.querySelector('.feedback-trigger');expect(trigger.getAttribute('aria-label')).toContain('Есть идея?');
  await click('.feedback-trigger');expect(container.querySelector('dialog').open).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(container.textContent).toContain('Помогите улучшить Lunaria');
  await act(async()=>container.querySelector('dialog').dispatchEvent(new Event('cancel',{bubbles:true,cancelable:true})));
  expect(container.querySelector('dialog').open).toBe(false);expect(document.activeElement).toBe(trigger);
});
test.each(['/authorization','/checkout','/terms','/unknown','/daily-horoscope'])('hidden on non-app or critical route %s',async path=>{
  mockPath=path;await render();expect(container.querySelector('button')).toBeNull();
});
test.each(['/','/pricing','/try-free','/relationships/new','/dashboard','/my-charts','/natal-chart-result/7','/relationships/8'])('visible on app route %s',async path=>{
  mockPath=path;await render();expect(container.querySelector('.feedback-trigger')).not.toBeNull();
});
test('every visible text addresses the user as «вы», not «ты»',async()=>{
  await open();await input('!!!');
  const text=container.querySelector('dialog').textContent;
  for(const part of ['Помогите улучшить','Расскажите, чего вам не хватает','Ваш отзыв','Не указывайте','Добавьте текст отзыва'])expect(text).toContain(part);
  expect(text).not.toMatch(/Помоги |Расскажи,|тебе|Твой |указывай |Добавь /);
});
test.each(['/','/pricing','/try-free','/relationships/new'])('submission on %s omits unsupported optional context',async path=>{
  mockPath=path;await open();await input('Новая идея');
  await click('button[type=submit]');
  expect(JSON.parse(posts()[0][1].body)).not.toHaveProperty('page_path');
  expect(container.textContent).toContain('Спасибо! Ваш отзыв отправлен.');
});
test.each(['busy form','aria modal','cookie banner'])('temporarily hides for %s and returns afterwards',async kind=>{
  mockPath='/try-free';await render();
  const el=document.createElement(kind==='busy form'?'form':'div');
  if(kind==='busy form')el.setAttribute('aria-busy','true');
  if(kind==='aria modal'){el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');}
  if(kind==='cookie banner')el.className='cookie-banner';
  document.body.appendChild(el);
  try{
    await act(async()=>frame());expect(container.querySelector('.feedback-trigger').hidden).toBe(true);
    el.hidden=true;await act(async()=>frame());expect(container.querySelector('.feedback-trigger').hidden).toBe(false);
  }finally{el.remove();}
});
test('guest, loading, checkout and busy billing hide widget',async()=>{
  for(const variant of ['guest','loading','checkout','busy']){
    mockAuth={user:{id:1},token:'jwt',loading:variant==='loading'};mockBilling={checkoutVisible:variant==='checkout',busy:variant==='busy'};
    if(variant==='guest')mockAuth.user=null;
    await render();expect(container.querySelector('.feedback-trigger')).toBeNull();
  }
});
test('other dialogs and cookie notices hide the trigger',async()=>{
  await render();const other=document.createElement('dialog');other.open=true;document.body.appendChild(other);
  await act(async()=>frame());expect(container.querySelector('.feedback-trigger').hidden).toBe(true);other.remove();
});
test.each([[390,60],[1280,60],[390,250],[1280,250]])('moves clear of bottom controls at viewport width %s and obstruction height %s',async(width,height)=>{
  await render();
  const trigger=container.querySelector('.feedback-trigger');
  const size=width<600?44:140;
  jest.spyOn(trigger,'getBoundingClientRect').mockReturnValue({left:width-16-size,right:width-16,width:size,height:44});
  const control=document.createElement('button');document.body.appendChild(control);
  jest.spyOn(control,'getBoundingClientRect').mockReturnValue({left:width-180,right:width,width:180,height,top:window.innerHeight-height,bottom:window.innerHeight});
  try{
    await act(async()=>frame());
    expect(container.querySelector('.feedback-widget').style.getPropertyValue('--feedback-bottom')).toBe(`${Math.ceil((height+8)/16)*16}px`);
    expect(trigger.hidden).toBe(false);
  }finally{control.remove();}
});
test.each(['idea','bug','feedback'])('submits %s with auth, safe fields and resets after success',async category=>{
  await open();await input(category,'select');await input('  Моя идея  ');
  global.fetch.mockResolvedValueOnce(ok({accepted:true,remaining:2}));
  await click('button[type=submit]');const [url,options]=posts()[0];
  expect(url.endsWith('/feedback')).toBe(true);expect(options.headers.Authorization).toBe('Bearer jwt');
  expect(JSON.parse(options.body)).toEqual({category,message:'Моя идея',page_path:'/my-charts',request_id:expect.any(String)});
  expect(container.textContent).toContain('Спасибо! Ваш отзыв отправлен.');
  await click('.feedback-close');expect(container.querySelector('dialog').open).toBe(false);
  await click('.feedback-trigger');expect(container.querySelector('textarea').value).toBe('');
});
test('whitespace and nontext rejected; counter and 2000-codepoint boundary',async()=>{
  await open();
  for(const value of ['','   ','\n\t','!!!','\u200b']){
    await input(value);expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  }
  await input('я'.repeat(2001));expect(container.querySelector('textarea').value.length).toBe(2000);
  expect(container.querySelector('#feedback-counter').textContent).toBe('2000 / 2000');
  expect(container.querySelector('button[type=submit]').disabled).toBe(false);
  expect(container.querySelector('input[type=file]')).toBeNull();
});
test('duplicate click blocked and ambiguous retry keeps idempotency key',async()=>{
  await open();await input('Моя идея');let reject;
  global.fetch.mockImplementationOnce(()=>new Promise((resolve,r)=>{reject=r;}));
  await click('button[type=submit]');await click('button[type=submit]');expect(posts()).toHaveLength(1);
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  await act(async()=>reject(new TypeError('network')));
  expect(container.textContent).toContain('Нет соединения');
  global.fetch.mockResolvedValueOnce(ok({accepted:true,remaining:2}));await click('button[type=submit]');
  expect(JSON.parse(posts()[0][1].body).request_id).toBe(JSON.parse(posts()[1][1].body).request_id);
});
test('server exhausted limit prevents frontend submission',async()=>{
  global.fetch.mockResolvedValue(ok({remaining:0,retry_after_seconds:10}));
  await open();await input('Моя идея');expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  expect(container.textContent).toContain('до 3 отзывов за 24 часа');expect(posts()).toHaveLength(0);
});
test('three submissions exhaust the form and a fourth cannot be sent',async()=>{
  let remaining=3;
  global.fetch.mockImplementation(async(url,options)=>ok({remaining:options?.method==='POST'?--remaining:remaining,retry_after_seconds:remaining?0:60}));
  await open();
  for(let i=0;i<3;i++){
    await input(`Идея ${i}`);await click('button[type=submit]');
    await click('.feedback-close');await click('.feedback-trigger');
  }
  await input('Четвёртая идея');await click('button[type=submit]');
  expect(posts()).toHaveLength(3);expect(container.querySelector('button[type=submit]').disabled).toBe(true);
});
test('expiry rechecks the server before allowing another submission',async()=>{
  jest.useFakeTimers();
  try{
    global.fetch.mockResolvedValueOnce(ok({remaining:0,retry_after_seconds:10}));
    await open();await input('Идея после ожидания');
    expect(container.querySelector('button[type=submit]').disabled).toBe(true);
    await act(async()=>jest.advanceTimersByTime(10100));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector('button[type=submit]').disabled).toBe(false);
  }finally{jest.useRealTimers();}
});
test.each([401,429,422,500])('Russian error for HTTP %s; input retained',async status=>{
  await open();await input('Текст отзыва');
  global.fetch.mockResolvedValueOnce({ok:false,status,json:async()=>({detail:{retry_after_seconds:30}})});
  await click('button[type=submit]');expect(container.querySelector('[role=alert]')).not.toBeNull();
  expect(container.querySelector('textarea').value).toBe('Текст отзыва');
  if(status===429)expect(container.querySelector('button[type=submit]').disabled).toBe(true);
});
test('failed limit check blocks sending and offers retry',async()=>{
  global.fetch.mockRejectedValueOnce(new TypeError('network'));await open();await input('Текст');
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  expect(container.textContent).toContain('Проверить лимит снова');
});
test('changing account clears draft and closes widget',async()=>{
  await open();await input('Private draft');mockAuth={user:{id:2},token:'other'};await render();
  expect(container.querySelector('dialog').open).toBe(false);expect(container.querySelector('textarea').value).toBe('');
});
