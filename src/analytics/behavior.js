// Fixed, aggregate signals only. This never reads text, values, hrefs, URLs or account data.
export const BEHAVIOR_EVENTS=new Set(['landing_cta_chart','landing_cta_relationships','landing_cta_pricing',
  'landing_cta_login','landing_demo_selected','landing_scroll_25','landing_scroll_50','landing_scroll_75',
  'landing_scroll_90','landing_engaged_30s','landing_engaged_60s']);
const CLICKS=new Set([...BEHAVIOR_EVENTS].filter(n=>n.startsWith('landing_cta_')||n==='landing_demo_selected'));
const BLOCKED='dialog[open], [role="dialog"][aria-modal="true"], .cookie-banner, [data-feedback-critical="true"]';

export function observeLanding({win=window,doc=document,emit,newFlow,eligible,clock=()=>performance.now()}) {
  let stopped=false,raf=null,lastTick=clock(),lastActivity=null,engaged=0;
  const milestones=new Set();
  const allowed=()=>!stopped&&eligible()&&win.location.pathname==='/'&&
    Boolean(doc.querySelector('.home-page'))&&!doc.querySelector(BLOCKED);
  const send=name=>{if(allowed())try{return emit(name,newFlow());}catch{/* Analytics must never affect input/navigation. */}return false;};
  const once=name=>{if(!milestones.has(name)&&send(name))milestones.add(name);};
  const activity=e=>{if(e.isTrusted&&allowed())lastActivity=clock();};
  const click=e=>{
    if(!e.isTrusted||!allowed()||!e.target?.closest)return;
    if(e.target.closest('form,input,textarea,select,[contenteditable="true"],.feedback-widget'))return;
    const name=e.target.closest('[data-analytics]')?.getAttribute('data-analytics');
    if(CLICKS.has(name))send(name);
  };
  const scroll=e=>{
    if(!e.isTrusted)return;
    activity(e);if(raf!==null||!allowed())return;
    raf=win.requestAnimationFrame(()=>{
      raf=null;if(!allowed())return;
      const root=doc.scrollingElement||doc.documentElement;
      // Furthest viewport bottom reached, not a native Clarity scroll heatmap.
      if(root.scrollHeight<=root.clientHeight)return;
      const depth=100*(root.scrollTop+root.clientHeight)/root.scrollHeight;
      for(const n of [25,50,75,90])if(depth>=n)once('landing_scroll_'+n);
    });
  };
  const tick=()=>{
    const now=clock(),elapsed=Math.max(0,Math.min(1000,now-lastTick));lastTick=now;
    // Foreground, focused, recently interacted time. Idle/background/suspended time is excluded.
    if(!allowed()||doc.visibilityState!=='visible'||!doc.hasFocus()||lastActivity===null||now-lastActivity>30000)return;
    engaged+=elapsed;
    for(const n of [30,60])if(engaged>=n*1000)once('landing_engaged_'+n+'s');
  };
  doc.addEventListener('click',click,true);
  for(const name of ['pointerdown','keydown'])doc.addEventListener(name,activity,{passive:true});
  win.addEventListener('scroll',scroll,{passive:true});
  const timer=win.setInterval(tick,1000);
  return ()=>{
    stopped=true;doc.removeEventListener('click',click,true);
    for(const name of ['pointerdown','keydown'])doc.removeEventListener(name,activity);
    win.removeEventListener('scroll',scroll);win.clearInterval(timer);
    if(raf!==null)win.cancelAnimationFrame(raf);
  };
}
