import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import AuthorizationPage from './AuthorizationPage';
import PasswordResetPage from './PasswordResetPage';
import {clearResetToken} from '../security/passwordResetToken';

let mockMode='login';
const mockRequest=jest.fn(),mockReset=jest.fn(),mockLogout=jest.fn(),mockLogin=jest.fn();
jest.mock('../api/authApi',()=>({requestPasswordReset:(...args)=>mockRequest(...args),resetPassword:(...args)=>mockReset(...args)}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,logout:mockLogout,login:mockLogin})}));
jest.mock('../components/GoogleSignIn',()=>()=>null);
jest.mock('react-router-dom',()=>({useNavigate:()=>jest.fn(),useLocation:()=>({state:{mode:mockMode}}),Link:({children,to})=><a href={to}>{children}</a>}),{virtual:true});
let root,container;
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();jest.clearAllMocks();mockMode='login';clearResetToken();
  window.history.replaceState({},'','/authorization');
  mockRequest.mockResolvedValue({message:'Если аккаунт с таким email существует, мы отправим письмо со ссылкой для восстановления пароля.'});
  mockReset.mockResolvedValue({message:'Пароль изменён.'});
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();clearResetToken();jest.useRealTimers();});
const render=component=>act(async()=>root.render(component));
const change=(id,value)=>act(async()=>Simulate.change(container.querySelector('#'+id),{target:{value}}));
const submit=()=>act(async()=>Simulate.submit(container.querySelector('form')));
const click=text=>act(async()=>Simulate.click([...container.querySelectorAll('button')].find(b=>b.textContent===text)));

test('forgot password opens recovery, preserves guest state, sends only email and returns to login',async()=>{
  localStorage.setItem('session_token','guest-token');localStorage.setItem('chart_id','7');
  await render(<AuthorizationPage/>);await click('Забыли пароль?');
  expect(container.textContent).toContain('Восстановление пароля');expect(container.querySelector('#auth-password')).toBeNull();
  await change('auth-email','owner@example.com');await submit();
  expect(mockRequest).toHaveBeenCalledWith('owner@example.com');expect(container.textContent).toContain('Если аккаунт');
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  expect(localStorage.getItem('session_token')).toBe('guest-token');expect(localStorage.getItem('chart_id')).toBe('7');
  await click('Войти в аккаунт');expect(container.querySelector('#auth-password')).not.toBeNull();expect(container.querySelector('button[type=submit]').disabled).toBe(false);
});

test('rate limited request displays Russian message and waits for Retry-After',async()=>{
  jest.useFakeTimers();mockMode='recover';mockRequest.mockRejectedValue(Object.assign(new Error('Слишком много запросов. Попробуйте позже.'),{retryAfter:3}));
  await render(<AuthorizationPage/>);await change('auth-email','owner@example.com');await submit();
  expect(container.textContent).toContain('Слишком много запросов');expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  for(let i=0;i<3;i++)await act(async()=>jest.advanceTimersByTime(1000));
  expect(container.querySelector('button[type=submit]').disabled).toBe(false);
});

test('reset token remains in memory only and is removed from URL before form submission',async()=>{
  const token='a'.repeat(43);window.history.replaceState({},'','/reset-password#token='+token);
  await render(<PasswordResetPage/>);
  expect(window.location.hash).toBe('');expect(window.location.search).toBe('');
  expect(document.querySelector('meta[name=referrer]').content).toBe('no-referrer');
  expect(container.textContent).not.toContain(token);expect(JSON.stringify(localStorage)).not.toContain(token);
  await change('reset-password','Abcdef1!');await change('reset-confirmation','different');await submit();expect(mockReset).not.toHaveBeenCalled();
  await change('reset-confirmation','Abcdef1!');await submit();
  expect(mockReset).toHaveBeenCalledWith(token,'Abcdef1!','Abcdef1!');expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Пароль изменён');expect(container.querySelector('form')).toBeNull();
});

test.each(['', '#token=short', '#token='+encodeURIComponent('<script>')])('invalid/missing reset token does not submit %#',async fragment=>{
  window.history.replaceState({},'','/reset-password'+fragment);await render(<PasswordResetPage/>);
  expect(container.textContent).toContain('Ссылка недействительна');expect(container.querySelector('form')).toBeNull();expect(mockReset).not.toHaveBeenCalled();
});

test('expired server token shows error without logging out or losing retry input',async()=>{
  window.history.replaceState({},'','/reset-password#token='+'b'.repeat(43));mockReset.mockRejectedValue(new Error('Ссылка недействительна или срок её действия истёк. Запросите новую ссылку.'));
  await render(<PasswordResetPage/>);await change('reset-password','Abcdef1!');await change('reset-confirmation','Abcdef1!');await submit();
  expect(container.textContent).toContain('Запросите новую ссылку');expect(mockLogout).not.toHaveBeenCalled();expect(container.querySelector('button[type=submit]').disabled).toBe(false);
});

test('double submit is ignored and a later login in another tab is preserved',async()=>{
  window.history.replaceState({},'','/reset-password#token='+'d'.repeat(43));
  let finish;mockReset.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  await render(<PasswordResetPage/>);await change('reset-password','Abcdef1!');await change('reset-confirmation','Abcdef1!');
  await submit();await submit();expect(mockReset).toHaveBeenCalledTimes(1);
  localStorage.setItem('access_token','another-session');await act(async()=>finish({}));
  expect(mockLogout).not.toHaveBeenCalled();expect(localStorage.getItem('access_token')).toBe('another-session');
});

test.each(['Abcde1!','Ab1!'+'x'.repeat(61),'abcdef1!','ABCDEF1!','Abcdefg!','Abcdef12','Abcdef1!я','Abcdef1!é','Abcd 12!'])('reset rejects invalid password %#',async password=>{
  window.history.replaceState({},'','/reset-password#token='+'c'.repeat(43));await render(<PasswordResetPage/>);
  await change('reset-password',password);await change('reset-confirmation',password);await submit();
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);expect(mockReset).not.toHaveBeenCalled();
});
