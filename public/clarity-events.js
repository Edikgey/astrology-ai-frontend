/* Clarity runs only here, on an origin separate from the application. No application bundle. */
(() => {
  'use strict';
  const HOSTS=['astrology-ai-frontend-production.up.railway.app'];
  const PARENTS=['https://mylunariaai.com','https://www.mylunariaai.com'];
  const EVENTS=new Set(['registration_started','registration_completed','chart_creation_started','chart_creation_completed',
    'premium_modal_opened','stripe_selected','lava_selected','checkout_initiated','checkout_failed','premium_activated',
    'landing_cta_chart','landing_cta_relationships','landing_cta_pricing','landing_cta_login',
    'landing_demo_selected','landing_scroll_25','landing_scroll_50','landing_scroll_75','landing_scroll_90',
    'landing_engaged_30s','landing_engaged_60s','public_page_home','public_page_pricing','public_page_privacy','public_page_terms','public_page_refunds','public_page_support']);
  let origin=null,initialized=false,failed=false,collectorObserved=false,lastSequence=0;
  const status=text=>{document.getElementById('bridge-status').textContent=text;};
  function clear() {
    for(const name of ['_clck','_clsk','CLID','ANONCHK','MR','MUID','SM']) {
      document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=None; Secure`;
      document.cookie=`${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=None; Secure`;
    }
    for(const type of ['localStorage','sessionStorage'])try{
      const storage=window[type];Object.keys(storage).filter(k=>/^_cl(ck|sk|tk)$|^clarity[._:-]/i.test(k)).forEach(k=>storage.removeItem(k));
    }catch{/* Third-party storage may be blocked. */}
  }
  // Refuse same-origin embedding or any referrer, including paths/query parameters.
  let parentReadable=false;
  try{void parent.document;parentReadable=true;}catch{/* Expected same-origin-policy isolation. */}
  if(!HOSTS.includes(location.hostname)||window===parent||parentReadable||document.referrer||location.search||
    location.pathname!=='/clarity-events.html'||(location.hash&&location.hash!=='#cleanup')){status('Blocked');return;}
  if(location.hash==='#cleanup'){
    clear();parent.postMessage({type:'lunaria:cleaned'},'*');status('Cleaned');return;
  }
  window.addEventListener('message',e=>{
    if(e.source!==parent||!PARENTS.includes(e.origin)||!e.data||typeof e.data!=='object'||Array.isArray(e.data))return;
    const data=e.data;
    if(data.type==='lunaria:init'&&!initialized&&Object.keys(data).sort().join(',')==='consent,projectId,type'&&
      data.consent===true&&/^[a-z0-9]{6,20}$/.test(data.projectId)) {
      initialized=true;origin=e.origin;
      // Diagnostics contain only the collector HTTP status, never request bodies or URLs.
      // Keep the native transport unchanged; this also permits production verification.
      const open=XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open=function(method,url,...args){
        try {
          const target=new URL(url,location.href);
          if(target.protocol==='https:'&&target.hostname.endsWith('.clarity.ms')&&target.pathname==='/collect') {
            this.addEventListener('loadend',()=>{
              document.getElementById('bridge-status').dataset.collectorStatus=String(this.status);
              if(this.status>=200&&this.status<300){collectorObserved=true;failed=false;}
              parent.postMessage({type:'lunaria:health',collectorStatus:this.status},origin);
            },{once:true});
          }
        }catch{/* Native XHR performs its own URL validation. */}
        return open.call(this,method,url,...args);
      };
      window.clarity=function(){const queue=window.clarity.q=window.clarity.q||[];if(queue.length<100)queue.push(arguments);};
      window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});
      window.clarity('set','lunaria_mode','isolated_events_only');
      const script=document.createElement('script');script.async=true;script.referrerPolicy='no-referrer';
      script.onerror=()=>{failed=true;status('Unavailable');parent.postMessage({type:'lunaria:unavailable'},origin);};
      script.src='https://www.clarity.ms/tag/'+data.projectId;document.head.appendChild(script);
      window.setTimeout(()=>{
        if(!collectorObserved){failed=true;status('Collector unconfirmed');parent.postMessage({type:'lunaria:unavailable'},origin);}
      },15000);
      status('Initialized; parent DOM inaccessible');
      parent.postMessage({type:'lunaria:initialized'},origin);
    }
    if(data.type==='lunaria:events'&&initialized&&!failed&&e.origin===origin&&Object.keys(data).sort().join(',')==='events,seq,type'&&
      Number.isSafeInteger(data.seq)&&data.seq>0&&Array.isArray(data.events)&&data.events.length<=50&&data.events.every(n=>EVENTS.has(n))) {
      if(data.seq>lastSequence){data.events.forEach(name=>window.clarity('event',name));lastSequence=data.seq;
        document.getElementById('bridge-status').dataset.acceptedEvents=String(Number(document.getElementById('bridge-status').dataset.acceptedEvents||0)+data.events.length);}
      parent.postMessage({type:'lunaria:accepted',seq:data.seq},origin);
    }
  });
  parent.postMessage({type:'lunaria:ready'},'*');
})();
