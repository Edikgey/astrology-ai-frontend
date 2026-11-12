import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import AuthorizationPage from './AuthorizationPage';

let mockMode='register', mockBeta=false;
const mockRegister=jest.fn(), mockVerify=jest.fn(), mockLogin=jest.fn(), mockNavigate=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,registerEmail:mockRegister,verifyRegistration:mockVerify,login:mockLogin})}));
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate,useLocation:()=>({state:{mode:mockMode}})}),{virtual:true});
jest.mock('../context/ServiceConfigContext',()=>({useServiceConfig:()=>({freeBetaEnabled:mockBeta})}));
jest.mock('../components/GoogleSignIn',()=>()=>null);
let root,container;
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();mockMode='register';mockBeta=false;jest.clearAllMocks();
  mockRegister.mockResolvedValue({});mockVerify.mockResolvedValue({});mockLogin.mockResolvedValue({});
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=()=>act(async()=>root.render(<AuthorizationPage/>));
const change=(id,value)=>act(async()=>Simulate.change(container.querySelector('#'+id),{target:{value}}));
const submit=()=>act(async()=>Simulate.submit(container.querySelector('form')));

test('registration promises the real limits outside the beta and no limits during it',async()=>{
  await render();
  expect(container.querySelector('.auth-description').textContent).toBe('Бесплатный аккаунт: до 3 карт и 10 AI-вопросов за всё время.');
  mockBeta=true;await act(async()=>root.render(<AuthorizationPage key="beta"/>));
  const text=container.querySelector('.auth-description').textContent;
  expect(text).toBe('Бесплатный аккаунт: карты и AI-вопросы без лимита на время бета-теста.');
  expect(text).not.toMatch(/3 карт|10 AI/);
});

test('Russian live checklist, confirmation mismatch, and both registration stages',async()=>{
  await render();
  expect(container.textContent).toContain('Пароль должен содержать:');
  expect(container.querySelectorAll('.password-requirements .is-unmet')).toHaveLength(7);
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);
  await change('auth-email','new@example.com');await change('auth-password','Abcdef1!');
  expect(container.querySelectorAll('.password-requirements .is-valid')).toHaveLength(7);
  await change('auth-password-confirmation','different');await submit();
  expect(container.textContent).toContain('Пароли не совпадают.');expect(mockRegister).not.toHaveBeenCalled();
  await change('auth-password-confirmation','Abcdef1!');
  expect(container.querySelector('button[type=submit]').disabled).toBe(false);
  await submit();expect(mockRegister).toHaveBeenCalledWith('new@example.com','Abcdef1!','Abcdef1!');
  await change('auth-code','123456');await change('auth-password','bad');await submit();
  expect(mockVerify).not.toHaveBeenCalled();
  await change('auth-password','Abcdef1!');await submit();
  expect(mockVerify).toHaveBeenCalledWith('123456','new@example.com','Abcdef1!',null,'Abcdef1!');
});

test.each(['Abcde1!','Ab1!'+'x'.repeat(61),'abcdef1!','ABCDEF1!','Abcdefg!','Abcdef12','Abcdef1!я','Abcdef1!é','Abcd 12!'])('form cannot submit invalid password %# even via submit event',async password=>{
  await render();await change('auth-email','new@example.com');await change('auth-password',password);await change('auth-password-confirmation',password);
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);await submit();expect(mockRegister).not.toHaveBeenCalled();
});
test('exactly 64 characters accepted and editing reverses completed state',async()=>{
  await render();const password='Ab1!'+'x'.repeat(60);
  await change('auth-password',password);await change('auth-password-confirmation',password);
  expect(container.querySelector('button[type=submit]').disabled).toBe(false);
  await change('auth-password',password+'x');
  expect(container.querySelector('[data-rule=length]').className).toBe('is-unmet');
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);
});
test('existing-user login keeps old weak or non-Latin passwords and has no new-policy restriction',async()=>{
  mockMode='login';await render();await change('auth-email','old@example.com');await change('auth-password','старый пароль');
  expect(container.querySelector('#password-requirements')).toBeNull();expect(container.querySelector('#auth-password-confirmation')).toBeNull();
  await submit();expect(mockLogin).toHaveBeenCalledWith('old@example.com','старый пароль',null);
});

test('OTP throttle disables verification while mail resend cooldown still allows entering a valid code',async()=>{
  await render();await change('auth-email','new@example.com');await change('auth-password','Abcdef1!');await change('auth-password-confirmation','Abcdef1!');await submit();
  expect(container.querySelector('button[type=submit]').disabled).toBe(false);
  mockVerify.mockRejectedValueOnce(Object.assign(new Error('Слишком много запросов. Попробуйте позже.'),{retryAfter:120}));
  await change('auth-code','123456');await submit();
  expect(container.querySelector('button[type=submit]').disabled).toBe(true);await submit();expect(mockVerify).toHaveBeenCalledTimes(1);
});
