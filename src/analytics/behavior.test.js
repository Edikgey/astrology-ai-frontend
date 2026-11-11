import {observeLanding,BEHAVIOR_EVENTS} from './behavior';
let now,visible,focus,allowed,handlers,doc,win,stop,emit,flow,frames,scrollRoot;
beforeEach(()=>{
 jest.useFakeTimers();now=0;visible='visible';focus=true;allowed=true;handlers=new Map();frames=[];
 document.body.innerHTML='<main class="home-page"><a data-analytics="landing_cta_chart" href="/try-free?CANARY_TOKEN"><span id="label">CANARY_NAME</span></a><input data-analytics="landing_cta_chart" value="CANARY_BIRTH"><p>CANARY_AI</p></main>';
 scrollRoot={scrollHeight:10000,clientHeight:1000,scrollTop:0};
 doc={querySelector:s=>document.querySelector(s),scrollingElement:scrollRoot,hasFocus:()=>focus,
  get visibilityState(){return visible;},addEventListener:(n,fn)=>handlers.set(n,fn),removeEventListener:jest.fn()};
 win={location:new URL('https://mylunariaai.com/?email=CANARY#CANARY_AUTH'),addEventListener:(n,fn)=>handlers.set(n,fn),removeEventListener:jest.fn(),
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:jest.fn(),setInterval,clearInterval};
 emit=jest.fn(()=>true);flow=jest.fn(()=> '00000000-0000-4000-8000-000000000001');
 stop=observeLanding({win,doc,emit,newFlow:flow,eligible:()=>allowed,clock:()=>now});
});
afterEach(()=>{stop();jest.useRealTimers();});
const click=(target=document.getElementById('label'),isTrusted=true)=>handlers.get('click')({target,isTrusted});
const scroll=top=>{scrollRoot.scrollTop=top;handlers.get('scroll')({isTrusted:true});frames.splice(0).forEach(f=>f());};
const advance=seconds=>{for(let i=0;i<seconds;i++){now+=1000;jest.advanceTimersByTime(1000);}};
test('real clicks transmit only allowlisted name, never text/value/href or URL',()=>{
 Object.defineProperty(document.querySelector('a'),'href',{get(){throw new Error('Must not read URL');}});
 click();click();expect(emit.mock.calls.map(c=>c[0])).toEqual(['landing_cta_chart','landing_cta_chart']);
 expect(JSON.stringify(emit.mock.calls)).not.toContain('CANARY');
 click(document.querySelector('input'));click(undefined,false);expect(emit).toHaveBeenCalledTimes(2);
 document.querySelector('a').setAttribute('data-analytics','CANARY_EMAIL');click();expect(emit).toHaveBeenCalledTimes(2);
});
test('scroll milestones fire once per page visit and scroll work is frame-coalesced',()=>{
 scroll(2000);scroll(4400);scroll(4400);scroll(8500);
 expect(emit.mock.calls.map(c=>c[0])).toEqual(['landing_scroll_25','landing_scroll_50','landing_scroll_75','landing_scroll_90']);
 handlers.get('scroll')({isTrusted:true});handlers.get('scroll')({isTrusted:true});expect(frames).toHaveLength(1);
});
test('no scroll events for non-scrollable pages',()=>{scrollRoot.scrollHeight=500;scroll(0);expect(emit).not.toHaveBeenCalled();});
test.each(['/authorization','/my-charts','/natal-chart-result/123','/relationships/4','/pricing'])('no behavioral data from %s',route=>{
 win.location=new URL('https://mylunariaai.com'+route+'?CANARY#CANARY');click();scroll(9000);advance(100);expect(emit).not.toHaveBeenCalled();
});
test('no behavior while consent is absent/rejected/withdrawn or owner excluded',()=>{allowed=false;click();scroll(9000);advance(100);expect(emit).not.toHaveBeenCalled();});
test.each(['<dialog open>CANARY_PAYMENT</dialog>','<div role="dialog" aria-modal="true">CANARY_AI</div>','<div class="cookie-banner"></div>','<form data-feedback-critical="true"></form>'])('pauses for protected UI %s',markup=>{
 document.body.insertAdjacentHTML('beforeend',markup);click();scroll(9000);advance(70);expect(emit).not.toHaveBeenCalled();
});
test('engagement excludes no-input, background, unfocused, idle and suspended time',()=>{
 advance(40);expect(emit).not.toHaveBeenCalled();handlers.get('pointerdown')({isTrusted:true});
 visible='hidden';advance(30);visible='visible';focus=false;advance(30);focus=true;
 handlers.get('keydown')({isTrusted:true});advance(20);expect(emit).not.toHaveBeenCalled();
 handlers.get('pointerdown')({isTrusted:true});advance(10);expect(emit.mock.calls.map(c=>c[0])).toEqual(['landing_engaged_30s']);
 advance(60);expect(emit).toHaveBeenCalledTimes(1); // Last interaction expired before a 60s threshold.
 handlers.get('pointerdown')({isTrusted:true});advance(20);expect(emit.mock.calls.map(c=>c[0])).toEqual(['landing_engaged_30s','landing_engaged_60s']);
});
test('cleanup removes all listeners, interval and pending animation frame',()=>{
 handlers.get('scroll')({isTrusted:true});stop();expect(doc.removeEventListener).toHaveBeenCalledTimes(3);
 expect(win.removeEventListener).toHaveBeenCalledTimes(1);expect(win.cancelAnimationFrame).toHaveBeenCalled();
 click();frames.forEach(f=>f());advance(100);expect(emit).not.toHaveBeenCalled();
});
test('blocked storage/transport errors cannot break clicks or scrolling',()=>{
 emit.mockImplementation(()=>{throw new Error('Blocked analytics');});expect(()=>click()).not.toThrow();expect(()=>scroll(9000)).not.toThrow();
});
test('all names are fixed non-personal strings',()=>{expect([...BEHAVIOR_EVENTS].every(n=>/^landing_[a-z0-9_]+$/.test(n))).toBe(true);});
