import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {UsageProvider} from '../context/UsageContext';
import UsageSummary from './UsageSummary';
import {createClarity} from '../analytics/clarity';
import {loadStripe} from '@stripe/stripe-js';
let mockEngine,mockOptions,mockAuth;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('../analytics/clarity',()=>{
 const real=jest.requireActual('../analytics/clarity');return {...real,
  newAnalyticsFlow:()=> '00000000-0000-4000-8000-000000000001',trackEvent:(...args)=>mockEngine.track(...args),
  clarityAnalytics:{beginCheckout:(...args)=>mockEngine.beginCheckout(...args),confirmPremium:(...args)=>mockEngine.confirmPremium(...args)}};
});
jest.mock('@stripe/stripe-js',()=>({loadStripe:jest.fn(async()=>({}))}));
jest.mock('@stripe/react-stripe-js',()=>({EmbeddedCheckoutProvider:({options,children})=>{mockOptions=options;return children;},EmbeddedCheckout:()=>null}));
jest.mock('../api/stripe',()=>{process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY='pk_live_fixture';return jest.requireActual('../api/stripe');});
let root,container,usage,originalFetch;
const ok=data=>({ok:true,status:200,json:async()=>data});
const pending=()=>JSON.parse(sessionStorage.getItem('lunaria.analytics.journey')||'{"pending":[]}').pending;
const click=text=>act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent===text).click());
beforeEach(async()=>{
 jest.useFakeTimers();loadStripe.mockResolvedValue({});global.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();sessionStorage.clear();localStorage.setItem('access_token','CANARY_JWT');
 mockAuth={user:{id:1,email:'CANARY_EMAIL'},token:'CANARY_JWT',loading:false};
 usage={plan:'free',gpt_messages_used:0,gpt_messages_limit:10,saved_charts_used:0,saved_charts_limit:3,gpt_limit_type:'lifetime',gpt_period_valid:true,stripe_checkout_available:true,lava_checkout_available:true};
 mockEngine=createClarity({config:{production:true,enabled:true,privacyVerified:true,hosts:['localhost'],projectId:'yyahbvhd4l'},consent:()=> 'accepted',excluded:()=>false,clear:jest.fn()});
 originalFetch=global.fetch;global.fetch=jest.fn(async url=>ok(url.endsWith('/account/usage')?usage:url.includes('/lava/')?{url:'https://pay.example.test/CANARY_INVOICE'}:{client_secret:'cs_live_CANARY_SESSION_secret_CANARY_SECRET',session_id:'cs_live_CANARY_SESSION'}));
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 jest.spyOn(window,'open').mockReturnValue({opener:null,location:{},close:jest.fn()});
 container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 await act(async()=>root.render(<UsageProvider><UsageSummary/></UsageProvider>));
});
afterEach(async()=>{await act(async()=>root.unmount());mockEngine.halt();jest.runOnlyPendingTimers();container.remove();global.fetch=originalFetch;jest.restoreAllMocks();jest.useRealTimers();localStorage.clear();sessionStorage.clear();});
test('Stripe initiation and onComplete cannot count as paid activation; confirmed backend state counts once',async()=>{
 expect(pending()).not.toContain('premium_activated');await click('Перейти на Premium');await click('Оплатить через Stripe');
 expect(pending()).toEqual(expect.arrayContaining(['premium_modal_opened','stripe_selected','checkout_initiated']));
 expect(pending()).not.toContain('premium_activated');await act(async()=>mockOptions.onComplete());expect(pending()).not.toContain('premium_activated');
 usage={...usage,plan:'premium',subscription_status:'active',payment_provider:'stripe'};
 await act(async()=>jest.advanceTimersByTime(3000));expect(pending().filter(n=>n==='premium_activated')).toHaveLength(1);
 await act(async()=>window.dispatchEvent(new Event('focus')));expect(pending().filter(n=>n==='premium_activated')).toHaveLength(1);
 expect(JSON.stringify(pending())).not.toContain('CANARY');
});
test('checkout failure is distinct from checkout initiation or paid conversion',async()=>{
 await click('Перейти на Premium');global.fetch.mockResolvedValueOnce({ok:false,status:502,json:async()=>({detail:'CANARY_PROVIDER_ERROR'})});
 await click('Оплатить через Stripe');expect(pending()).toContain('checkout_failed');expect(pending()).not.toContain('checkout_initiated');expect(pending()).not.toContain('premium_activated');
 expect(JSON.stringify(pending())).not.toContain('CANARY');
});
test('Lava uses the same consented event gate and only backend confirmation activates Premium',async()=>{
 await click('Перейти на Premium');await click('Оплатить в RUB');expect(pending()).toEqual(expect.arrayContaining(['lava_selected','checkout_initiated']));expect(pending()).not.toContain('premium_activated');
 usage={...usage,plan:'premium',subscription_status:'active',payment_provider:'lava'};await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(pending().filter(n=>n==='premium_activated')).toHaveLength(1);expect(JSON.stringify(pending())).not.toContain('CANARY');
});
