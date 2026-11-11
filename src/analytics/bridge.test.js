/* Exercise the shipped bridge, including its fail-closed URL/referrer boundary. */
const fs=require('fs');const path=require('path');const vm=require('vm');
const source=fs.readFileSync(path.join(process.cwd(),'public/clarity-events.js'),'utf8');
function fixture({url='https://astrology-ai-frontend-production.up.railway.app/clarity-events.html',referrer='',readable=false,top=false}={}) {
  const output={textContent:'Waiting',dataset:{}},scripts=[],messages=[],timers=[];let listener;
  const parent={postMessage:(...args)=>messages.push(args)};
  Object.defineProperty(parent,'document',{get(){if(readable)return {};throw new Error('SOP');}});
  const doc={referrer,cookie:'',getElementById:()=>output,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
  const context={document:doc,location:new URL(url),parent:top?null:parent,URL,localStorage:{},sessionStorage:{},
    setTimeout:fn=>{timers.push(fn);},XMLHttpRequest:function(){},addEventListener:(name,fn)=>{listener=fn;}};
  context.XMLHttpRequest.prototype.open=()=>{};context.window=context;if(top)context.parent=context;
  vm.runInNewContext(source,context);
  const message=(data,overrides={})=>listener?.({data,origin:'https://mylunariaai.com',source:parent,...overrides});
  return {context,output,scripts,messages,message,parent,timers};
}
const init={type:'lunaria:init',consent:true,projectId:'yyahbvhd4l'};
test.each([
  {referrer:'https://mylunariaai.com/chart?token=CANARY'}, {readable:true},{top:true},
  {url:'https://mylunariaai.com/clarity-events.html'},
  {url:'https://astrology-ai-frontend-production.up.railway.app/clarity-events.html?secret=CANARY'},
  {url:'https://astrology-ai-frontend-production.up.railway.app/clarity-events.html#CANARY'},
  {url:'https://astrology-ai-frontend-production.up.railway.app/authorization'},
])('no tag or ready message on unsafe context %j',options=>{
  const f=fixture(options);f.message(init);expect(f.output.textContent).toBe('Blocked');expect(f.scripts).toEqual([]);expect(f.messages).toEqual([]);
});
test('untrusted origin/source, denied consent and extra data cannot start SDK',()=>{
  const f=fixture();f.message(init,{origin:'https://evil.example'});f.message(init,{source:{}});
  f.message({...init,consent:false});f.message({...init,email:'CANARY'});expect(f.scripts).toEqual([]);
});
test('SDK gets only its static isolated URL, denied ads and fixed events; batches cannot add PII',()=>{
  const f=fixture();f.message(init);f.message(init);expect(f.scripts).toHaveLength(1);
  expect(f.scripts[0]).toMatchObject({src:'https://www.clarity.ms/tag/yyahbvhd4l',referrerPolicy:'no-referrer'});
  const send=(events,seq=1,extra={})=>f.message({type:'lunaria:events',events,seq,...extra});
  send(['registration_started','public_page_pricing']);send(['registration_started'],1);
  send(['CANARY_EMAIL'],2);send(['checkout_failed'],2,{email:'CANARY'});send(['checkout_failed'],-1);send(Array(51).fill('checkout_failed'),2);
  const calls=f.context.clarity.q.map(args=>Array.from(args));
  expect(calls).toEqual([['consentv2',{ad_Storage:'denied',analytics_Storage:'granted'}],['set','lunaria_mode','isolated_events_only'],['event','registration_started'],['event','public_page_pricing']]);
  expect(f.output.dataset.acceptedEvents).toBe('2');expect(JSON.stringify(calls)).not.toContain('CANARY');
});
test('cleanup document never initializes SDK, even on later init messages',()=>{
  const f=fixture({url:'https://astrology-ai-frontend-production.up.railway.app/clarity-events.html#cleanup'});
  f.message(init);expect(f.scripts).toEqual([]);expect(f.output.textContent).toBe('Cleaned');
});

test('failed async tag stops event delivery and bounds the pre-SDK queue',()=>{
 const f=fixture();f.message(init);for(let i=1;i<200;i++)f.message({type:'lunaria:events',seq:i,events:['landing_cta_chart']});
 expect(f.context.clarity.q.length).toBeLessThanOrEqual(100);f.scripts[0].onerror();
 expect(f.output.textContent).toBe('Unavailable');expect(f.messages.some(([m])=>m.type==='lunaria:unavailable')).toBe(true);
 const length=f.context.clarity.q.length;f.message({type:'lunaria:events',seq:999,events:['landing_scroll_90']});expect(f.context.clarity.q).toHaveLength(length);
});

test('blocked nested SDK or collector becomes unavailable after bounded startup window',()=>{
 const f=fixture();f.message(init);expect(f.timers).toHaveLength(1);f.timers[0]();
 expect(f.output.textContent).toBe('Collector unconfirmed');expect(f.messages.at(-1)[0]).toEqual({type:'lunaria:unavailable'});
});
