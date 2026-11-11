import {productAnalytics, PRODUCT_ANALYTICS_STATE} from '../analytics/productAnalytics';
import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {clarityAnalytics,newAnalyticsFlow} from '../analytics/clarity';
import {observeLanding} from '../analytics/behavior';
import {onPreferenceChange} from '../analytics/consent';

export default function PublicBehavior() {
  const {pathname}=useLocation();
  useEffect(()=>{
    let stop=null;
    const refresh=()=>{
      const enabled=pathname==='/'&&(clarityAnalytics.canTrack()||productAnalytics.canTrack());
      if(enabled&&!stop)stop=observeLanding({eligible:()=>clarityAnalytics.canTrack()||productAnalytics.canTrack(),
        emit:(name,flow)=>{const product=productAnalytics.forward(name,flow);return clarityAnalytics.track(name,flow)||product;},newFlow:newAnalyticsFlow});
      if(!enabled&&stop){stop();stop=null;}
    };
    refresh();const unsubscribe=onPreferenceChange(refresh);
    window.addEventListener(PRODUCT_ANALYTICS_STATE,refresh);
    return ()=>{unsubscribe();window.removeEventListener(PRODUCT_ANALYTICS_STATE,refresh);if(stop)stop();};
  },[pathname]);
  return null;
}
