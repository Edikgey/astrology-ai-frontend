import {createClarity,EVENTS,BRIDGE_URL} from './clarity';
import {readConsent,saveConsent,isExcluded,setExcluded,clearClarityStorage,EXCLUDE_KEY} from './consent';
const FLOW='00000000-0000-4000-8000-000000000001';
const config={production:true,enabled:true,privacyVerified:true,projectId:'yyahbvhd4l',hosts:['mylunariaai.com']};
let win,engine,decision,excluded,frames;
const origin=new URL(BRIDGE_URL).origin;
const current=()=>document.querySelector('#lunaria-clarity-events');
function message(type,extra={},override={}) {
  window.dispatchEvent(new MessageEvent('message',{origin,source:current()?.contentWindow,data:{type,...extra},...override}));
}
function connect(){engine.refresh();message('lunaria:ready');message('lunaria:initialized');}
const sent=()=>frames.flatMap(f=>f.contentWindow.postMessage.mock.calls.map(c=>c[0]));
beforeEach(()=>{
  jest.useFakeTimers();localStorage.clear();sessionStorage.clear();document.body.innerHTML='';
  for(const name of document.cookie.split(';').map(v=>v.trim().split('=')[0]))document.cookie=`${name}=; Max-Age=0; Path=/`;
  decision='accepted';excluded=false;frames=[];
  const append=document.body.appendChild.bind(document.body);
  jest.spyOn(document.body,'appendChild').mockImplementation(node=>{
    const result=append(node);if(node.tagName==='IFRAME'){jest.spyOn(node.contentWindow,'postMessage').mockImplementation(()=>{});frames.push(node);}return result;
  });
  win={location:new URL('https://mylunariaai.com/'),sessionStorage:window.sessionStorage,
    addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window),
    setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window)};
  engine=createClarity({win,config,consent:()=>decision,excluded:()=>excluded,clear:jest.fn()});
});
afterEach(()=>{engine.halt();jest.runOnlyPendingTimers();jest.useRealTimers();jest.restoreAllMocks();});
test.each(['undecided','rejected'])('no analytics document or event storage with %s consent',state=>{
  decision=state;expect(engine.refresh()).toBe(false);expect(frames).toHaveLength(0);
  expect(engine.track('registration_started',FLOW)).toBe(false);expect(sessionStorage.length).toBe(0);
});
test('acceptance loads only one isolated blank iframe, no SDK in app',()=>{
  connect();engine.refresh();expect(frames).toHaveLength(1);expect(current().src).toBe(BRIDGE_URL);
  expect(current().referrerPolicy).toBe('no-referrer');expect(current().getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  expect(document.querySelector('script[src*=clarity]')).toBeNull();expect(win.clarity).toBeUndefined();
  expect(sent()).toContainEqual({type:'lunaria:init',projectId:'yyahbvhd4l',consent:true});
});
test.each([{production:false},{enabled:false},{privacyVerified:false},{projectId:'bad/path'},
  {hosts:['another.example']},{bridgeUrl:'https://mylunariaai.com/clarity-events.html'},
  {bridgeUrl:BRIDGE_URL+'?email=bad'},{bridgeUrl:BRIDGE_URL+'#bad'},{bridgeUrl:BRIDGE_URL.replace('https:','http:')}])('fails closed for %j',override=>{
  const instance=createClarity({win,config:{...config,...override},consent:()=>decision,excluded:()=>false});
  expect(instance.refresh()).toBe(false);expect(current()).toBeNull();
});
test('origin and source are both required before initialization/event delivery',()=>{
  engine.refresh();message('lunaria:ready',{}, {origin:'https://evil.example'});message('lunaria:ready',{}, {source:window});
  expect(sent()).toEqual([]);message('lunaria:ready');expect(sent()).toHaveLength(1);
});
test('withdrawal destroys SDK context immediately without reload; reacceptance creates fresh frame',()=>{
  connect();const first=current();decision='rejected';engine.refresh();
  expect(first.isConnected).toBe(false);expect(current()).toBeNull();expect(sessionStorage.length).toBe(0);
  expect(frames[1].src).toBe(BRIDGE_URL+'#cleanup');expect(engine.track('checkout_initiated',FLOW)).toBe(false);
  decision='accepted';engine.refresh();expect(current()).not.toBe(first);expect(engine.needsReload()).toBe(false);
});
test.each(['/authorization','/try-free','/my-charts','/natal-chart-result/777','/relationships/8','/daily-horoscope','/dashboard','/unknown'])('private route %s never transmitted',route=>{
  win.location=new URL('https://mylunariaai.com'+route+'?email=CANARY_EMAIL#CANARY_TOKEN');
  document.body.innerHTML='<input value="CANARY_BIRTH"><dialog open>CANARY_AI</dialog>';
  jest.spyOn(document,'referrer','get').mockReturnValue('https://mylunariaai.com/checkout/CANARY_PAYMENT');
  connect();expect(sent().filter(m=>m.type==='lunaria:events')).toEqual([]);
  engine.track('registration_started',FLOW);expect(sent().at(-1).events).toEqual(['registration_started']);
  expect(JSON.stringify(sent())).not.toMatch(/CANARY|777|relationships|referrer|email|checkout\//);
  expect(win.clarity).toBeUndefined();
});
test('public categories omit all URL/query/fragment data and do not duplicate refreshes',()=>{
  win.location=new URL('https://mylunariaai.com/?email=CANARY#CANARY');connect();
  const first=sent().at(-1);expect(first.events).toEqual(['public_page_home']);message('lunaria:accepted',{seq:first.seq});
  engine.refresh();win.location=new URL('https://mylunariaai.com/my-charts');engine.refresh();
  win.location=new URL('https://mylunariaai.com/pricing?secret=CANARY#CANARY');engine.refresh();
  expect(sent().filter(m=>m.type==='lunaria:events').map(m=>m.events)).toEqual([['public_page_home'],['public_page_pricing']]);
  expect(JSON.stringify(sent())).not.toContain('CANARY');expect(frames).toHaveLength(1);
});
test('allowlisted event batches are deduplicated and never include local action IDs',()=>{
  win.location=new URL('https://mylunariaai.com/authorization');
  for(const name of EVENTS){expect(engine.track(name,FLOW)).toBe(true);expect(engine.track(name,FLOW)).toBe(false);}
  expect(engine.track('private@example.com',FLOW)).toBe(false);expect(engine.track('checkout_failed',{email:'bad'})).toBe(false);
  message('lunaria:ready');message('lunaria:initialized');const batch=sent().at(-1);
  expect(batch.events).toEqual([...EVENTS]);expect(JSON.stringify(sent())).not.toContain(FLOW);
  message('lunaria:accepted',{seq:batch.seq+1});expect(JSON.parse(sessionStorage.getItem('lunaria.analytics.journey')).pending).toHaveLength(EVENTS.size);
  message('lunaria:accepted',{seq:batch.seq});expect(JSON.parse(sessionStorage.getItem('lunaria.analytics.journey')).pending).toEqual([]);
});
test('Premium conversion requires checkout and backend-confirmed active period',()=>{
  const paid={plan:'premium',subscription_status:'active',gpt_period_valid:true};expect(engine.confirmPremium(paid)).toBe(false);engine.beginCheckout(FLOW);
  for(const override of [{plan:'free'},{subscription_status:'past_due'},{gpt_period_valid:false}])expect(engine.confirmPremium({...paid,...override})).toBe(false);
  expect(engine.confirmPremium(paid)).toBe(true);expect(engine.confirmPremium(paid)).toBe(false);
});
test('owner exclusion prevents any frame and events',()=>{
  excluded=true;expect(engine.refresh()).toBe(false);expect(engine.track('chart_creation_started',FLOW)).toBe(false);expect(frames).toEqual([]);
});
test('old generic acceptance requires a new explicit Clarity choice; rejection is respected',()=>{
  document.cookie='userCookieConsent=true; Path=/';expect(readConsent()).toBe('undecided');
  saveConsent(true);expect(readConsent()).toBe('accepted');expect(readConsent()).toBe('accepted');
  saveConsent(false);expect(readConsent()).toBe('rejected');
});
test('clearing analytics preserves essential account tokens, session and drafts',()=>{
  localStorage.setItem('access_token','secret');localStorage.setItem('session_token','guest');localStorage.setItem('natalChart','private');
  localStorage.setItem('clarity.session','optional');document.cookie='_clck=optional; Path=/';
  clearClarityStorage();expect(localStorage.getItem('clarity.session')).toBeNull();expect(document.cookie).not.toContain('_clck=');
  expect(localStorage.getItem('access_token')).toBe('secret');expect(localStorage.getItem('session_token')).toBe('guest');expect(localStorage.getItem('natalChart')).toBe('private');
  setExcluded(true);expect(isExcluded()).toBe(true);expect(localStorage.getItem(EXCLUDE_KEY)).toBe('true');
});

test('script failure pauses delivery and keeps a bounded queue without affecting product',()=>{
 connect();message('lunaria:unavailable');expect(current().dataset.analyticsState).toBe('unavailable');
 for(let i=0;i<120;i++)engine.track('landing_cta_chart',`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 expect(JSON.parse(sessionStorage.getItem('lunaria.analytics.journey')).pending).toHaveLength(50);
 expect(engine.canTrack()).toBe(true);expect(sent().filter(m=>m.type==='lunaria:events')).toHaveLength(1);
});
test('inaccessible storage and iframe creation failure never throw into application',()=>{
 const broken={...win,sessionStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}};
 const instance=createClarity({win:broken,config,consent:()=>decision,excluded:()=>false});
 jest.spyOn(document.body,'appendChild').mockImplementation(()=>{throw Error('CSP');});
 expect(()=>instance.refresh()).not.toThrow();expect(instance.isStarted()).toBe(false);
 expect(()=>instance.track('checkout_initiated',FLOW)).not.toThrow();expect(()=>instance.confirmPremium({})).not.toThrow();
});
