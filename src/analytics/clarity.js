import {productAnalytics} from './productAnalytics';
import {readConsent,isExcluded,clearClarityStorage} from './consent';
import {BEHAVIOR_EVENTS} from './behavior';

export const EVENTS = new Set(['registration_started','registration_completed','chart_creation_started',
  'chart_creation_completed','premium_modal_opened','stripe_selected','lava_selected',
  'checkout_initiated','checkout_failed','premium_activated']);
const SAFE_PAGES={'/':'home','/pricing':'pricing','/privacy':'privacy','/terms':'terms','/refunds':'refunds','/support':'support'};
export const BRIDGE_URL='https://astrology-ai-frontend-production.up.railway.app/clarity-events.html';
const JOURNEY_KEY='lunaria.analytics.journey';

export function createClarity({win=window,doc=document,config,consent=readConsent,excluded=isExcluded,clear=clearClarityStorage}) {
  let frame=null,ready=false,lastPage=null,batch=null,sequence=0;
  let cleared=false;
  const settings=config||{production:process.env.NODE_ENV==='production',enabled:process.env.REACT_APP_CLARITY_ENABLED==='true',
    privacyVerified:process.env.REACT_APP_CLARITY_PRIVACY_VERIFIED==='true',projectId:process.env.REACT_APP_CLARITY_PROJECT_ID,
    bridgeUrl:BRIDGE_URL,hosts:['mylunariaai.com','www.mylunariaai.com']};
  const eligible=()=>settings.production&&settings.enabled&&settings.privacyVerified&&settings.hosts.includes(win.location.hostname)&&consent()==='accepted'&&!excluded();
  const bridge=()=>{
    try{
      const u=new URL(settings.bridgeUrl||BRIDGE_URL);
      const local=settings.testTransport&&['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:';
      if((u.protocol!=='https:'&&!local)||u.origin===win.location.origin||u.search||u.hash||u.pathname!=='/clarity-events.html')return null;
      return u;
    }catch{return null;}
  };
  const read=()=>{
    try{
      const data=JSON.parse(win.sessionStorage.getItem(JOURNEY_KEY)||'null');
      if(!data||!Number.isFinite(data.at)||Date.now()-data.at>86400000||data.at>Date.now())return {at:Date.now(),pending:[],seen:[],checkout:null};
      return {at:data.at,pending:(data.pending||[]).filter(n=>EVENTS.has(n)||BEHAVIOR_EVENTS.has(n)||Object.values(SAFE_PAGES).some(p=>n==='public_page_'+p)).slice(-50),
        seen:(data.seen||[]).filter(k=>typeof k==='string'&&/^[a-z_]+:[a-f0-9-]{36}$/.test(k)).slice(-100),
        checkout:typeof data.checkout==='string'&&/^[a-f0-9-]{36}$/.test(data.checkout)?data.checkout:null};
    }catch{return {at:Date.now(),pending:[],seen:[],checkout:null};}
  };
  const write=data=>{try{win.sessionStorage.setItem(JOURNEY_KEY,JSON.stringify(data));}catch{/* No persistent analytics if storage blocked. */}};
  const clearJourney=()=>{try{win.sessionStorage.removeItem(JOURNEY_KEY);}catch{/* Optional storage. */}};
  const post=data=>{if(frame?.contentWindow)frame.contentWindow.postMessage(data,bridge().origin);};
  function cleanupRemote() {
    const u=bridge();if(!u)return;
    const clean=doc.createElement('iframe');clean.hidden=true;clean.title='Analytics storage cleanup';
    clean.setAttribute('sandbox','allow-scripts allow-same-origin');clean.referrerPolicy='no-referrer';
    clean.src=u.href+'#cleanup';
    const finish=()=>{win.removeEventListener('message',ack);clean.remove();win.clearTimeout(timer);};
    const ack=e=>{if(e.origin===u.origin&&e.source===clean.contentWindow&&e.data?.type==='lunaria:cleaned')finish();};
    const timer=win.setTimeout(finish,2500);win.addEventListener('message',ack);doc.body.appendChild(clean);
  }
  function halt() {
    if(!cleared){clearJourney();clear();cleared=true;}
    if(frame){
      // Destroying the isolated browsing context removes the SDK, all observers and timers.
      // No reload or history interception: auth, drafts and checkout stay intact.
      win.removeEventListener('message',receive);frame.remove();frame=null;ready=false;batch=null;lastPage=null;
      cleanupRemote();
    }
  }
  function flush() {
    if(!eligible()||!ready||batch)return;
    const data=read();if(!data.pending.length)return;
    batch={seq:++sequence,events:data.pending.slice(0,50)};
    post({type:'lunaria:events',...batch});
  }
  function receive(e) {
    const u=bridge();
    if(!u||!frame||e.origin!==u.origin||e.source!==frame.contentWindow||!eligible())return;
    if(e.data?.type==='lunaria:ready')post({type:'lunaria:init',projectId:settings.projectId,consent:true});
    if(e.data?.type==='lunaria:initialized'){ready=true;flush();}
    if(e.data?.type==='lunaria:unavailable'){ready=false;batch=null;frame.dataset.analyticsState='unavailable';}
    if(e.data?.type==='lunaria:health'&&Number.isInteger(e.data.collectorStatus)&&e.data.collectorStatus>=0&&e.data.collectorStatus<=599){
      frame.dataset.collectorStatus=String(e.data.collectorStatus);
      if(e.data.collectorStatus>=200&&e.data.collectorStatus<300){
        frame.dataset.analyticsState='connected';
        if(!ready){ready=true;flush();}
      }
    }
    if(e.data?.type==='lunaria:accepted'&&batch&&e.data.seq===batch.seq){
      frame.dataset.acceptedEvents=String(Number(frame.dataset.acceptedEvents||0)+batch.events.length);
      const data=read();data.pending=data.pending.slice(batch.events.length);write(data);batch=null;flush();
    }
  }
  function refresh() {
    if(!eligible()){halt();return false;}
    cleared=false;
    const u=bridge();if(!u||!/^[a-z0-9]{6,20}$/.test(settings.projectId||''))return false;
    if(!frame){
      frame=doc.createElement('iframe');frame.id='lunaria-clarity-events';frame.title='Optional analytics';frame.hidden=true;
      frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
      frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.referrerPolicy='no-referrer';frame.src=u.href;
      win.addEventListener('message',receive);
      try{doc.body.appendChild(frame);}catch{win.removeEventListener('message',receive);frame=null;return false;}
    }
    // Only fixed public page categories, never URLs, IDs, queries, fragments or referrers.
    const page=SAFE_PAGES[win.location.pathname]||null;
    if(page!==lastPage){
      lastPage=page;
      if(page){const data=read();data.pending=[...data.pending,'public_page_'+page].slice(-50);write(data);}
    }
    flush();return true;
  }
  function track(name,flow) {
    if(!eligible()||(!EVENTS.has(name)&&!BEHAVIOR_EVENTS.has(name))||typeof flow!=='string'||!/^[a-f0-9-]{36}$/.test(flow))return false;
    const data=read(),key=`${name}:${flow}`;
    if(data.seen.includes(key))return false;
    data.seen=[...data.seen,key].slice(-100);data.pending=[...data.pending,name].slice(-50);write(data);
    refresh();
    return true;
  }
  const beginCheckout=flow=>{if(eligible()){const data=read();data.checkout=flow;write(data);}};
  const confirmPremium=usage=>{
    if(!eligible()||usage?.plan!=='premium'||usage.subscription_status!=='active'||usage.gpt_period_valid!==true)return false;
    const data=read();if(!data.checkout)return false;
    const flow=data.checkout;data.checkout=null;write(data);return track('premium_activated',flow);
  };
  const safe=fn=>(...args)=>{try{return fn(...args);}catch{return false;}};
  return {refresh:safe(refresh),track:safe(track),halt:safe(halt),clearJourney:safe(clearJourney),
    beginCheckout:safe(beginCheckout),confirmPremium:safe(confirmPremium),canTrack:safe(eligible),needsReload:()=>false,isStarted:()=>Boolean(frame),
    status:()=>({enabled:settings.enabled,privacyVerified:settings.privacyVerified,started:Boolean(frame),mode:'isolated_events_only',consent:consent()})};
}
export const clarityAnalytics=createClarity({});
export const newAnalyticsFlow=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():null;
export const trackEvent=(name,flow)=>{productAnalytics.forward(name,flow);return clarityAnalytics.track(name,flow);};
