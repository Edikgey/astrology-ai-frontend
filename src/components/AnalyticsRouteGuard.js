import React,{useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {clarityAnalytics} from '../analytics/clarity';

export default function AnalyticsRouteGuard({children}) {
  const {pathname,search,hash}=useLocation();
  useLayoutEffect(()=>{clarityAnalytics.refresh();},[pathname,search,hash]);
  // The recorder is never in this document; route changes need no reload or interception.
  return children;
}
