import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PricingPage from './PricingPage';
import FreeBetaNotice from '../components/FreeBetaNotice';
let mockUsage, mockUser, mockPublicBeta;
const mockNavigate=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../context/UsageContext',()=>({useUsage:()=>({usage:mockUsage,openUpgrade:jest.fn()})}));
jest.mock('../context/ServiceConfigContext',()=>({useServiceConfig:()=>({freeBetaEnabled:mockPublicBeta})}));
jest.mock('../context/BillingContext',()=>({useBilling:()=>({configured:true,lavaConfigured:true})}));
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate}),{virtual:true});
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;mockUsage=null;mockUser=null;mockPublicBeta=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();jest.clearAllMocks();});
test('guests see the free beta and optional recurring Premium without claiming paid entitlement',async()=>{
 await act(async()=>root.render(<><FreeBetaNotice/><PricingPage/></>));
 expect(container.textContent).toContain('Бесплатный бета-тест');
 expect(container.querySelector('.free-beta-notice strong').textContent).toBe('Бесплатный бета-тест');
 expect(container.querySelector('.free-beta-notice span').textContent).toBe('Карты и AI-вопросы без лимита после входа в аккаунт.');
 expect(container.textContent).not.toContain('кнопку обратной связи');
 const cards=container.querySelectorAll('.pricing-card');
 expect(cards[0].querySelector('h3').textContent).toBe('Бесплатно');
 expect(container.textContent).not.toContain('Free');
 expect(cards[0].textContent).toContain('Сохранённые карты без лимита');
 expect(cards[0].textContent).toContain('AI-вопросы без лимита');
 expect(cards[1].textContent).toContain('Покупка Premium необязательна');
 expect(cards[1].textContent).toContain('Обычные лимиты Premium вне бета-теста');
 expect(container.textContent).not.toContain('Infinity');expect(container.textContent).not.toContain('/ null');
});
test('authenticated account state wins over stale public beta configuration',async()=>{
 mockUser={id:1};mockUsage={plan:'free',free_beta_enabled:false,saved_charts_used:1,saved_charts_limit:3,gpt_messages_used:1,gpt_messages_limit:10};
 await act(async()=>root.render(<><FreeBetaNotice/><PricingPage/></>));
 expect(container.querySelector('.free-beta-notice')).toBeNull();
 expect(container.textContent).not.toContain('Покупка Premium необязательна');
 expect(container.querySelector('.pricing-card').textContent).toContain('10 AI-вопросов за всё время аккаунта');
});

test('the feedback button hint is shown only to signed-in users, who actually have the button',async()=>{
 mockUser={id:1};mockUsage={plan:'free',free_beta_enabled:true,saved_charts_used:1,saved_charts_limit:null,gpt_messages_used:1,gpt_messages_limit:null};
 await act(async()=>root.render(<FreeBetaNotice/>));
 expect(container.querySelector('.free-beta-notice span').textContent).toBe('Карты и AI-вопросы без лимита. Поделитесь впечатлениями через кнопку «Есть идея?».');
});
test('outside the beta the pricing eyebrow is Russian and the menu name «Тарифы» matches',async()=>{
 mockPublicBeta=false;
 await act(async()=>root.render(<PricingPage/>));
 expect(container.querySelector('.eyebrow').textContent).toBe('Тарифы');
 expect(container.textContent).not.toContain('Free');
});
test('a disabled Premium button says why while account data loads',async()=>{
 mockUser={id:1};mockUsage=null;
 await act(async()=>root.render(<PricingPage/>));
 const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Перейти на Premium');
 expect(button.disabled).toBe(true);
 const reason=container.querySelector('#premium-unavailable');
 expect(button.getAttribute('aria-describedby')).toBe('premium-unavailable');
 expect(reason.textContent).toBe('Кнопка станет доступна, когда загрузятся данные аккаунта. Если этого не происходит, обновите страницу.');
});
test('an enabled Premium button carries no stale explanation',async()=>{
 mockUser=null;mockUsage=null;
 await act(async()=>root.render(<PricingPage/>));
 const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Перейти на Premium');
 expect(button.disabled).toBe(false);expect(container.querySelector('#premium-unavailable')).toBeNull();
});
