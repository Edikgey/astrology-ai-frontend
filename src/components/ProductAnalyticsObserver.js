import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {onPreferenceChange, readConsent, isExcluded} from '../analytics/consent';
import {productAnalytics} from '../analytics/productAnalytics';

export default function ProductAnalyticsObserver() {
  const {user, loading} = useAuth();
  const {pathname} = useLocation();
  const pendingAccept = useRef(false);
  useEffect(() => {
    const refresh = event => {
      if (event?.detail?.analyticsAccepted === true) pendingAccept.current = true;
      if (readConsent() !== 'accepted' || isExcluded()) {
        pendingAccept.current = false;
        return productAnalytics.refresh({pathname});
      }
      if (loading) {productAnalytics.pause(); return;}
      const explicit = pendingAccept.current; pendingAccept.current = false;
      return productAnalytics.refresh({actorKey: user?.id ?? null, pathname, explicit});
    };
    refresh();
    const unsubscribe = onPreferenceChange(refresh);
    window.addEventListener('online', refresh);
    const leave = () => productAnalytics.pageLeave();
    window.addEventListener('pagehide', leave);
    return () => {unsubscribe(); window.removeEventListener('online', refresh); window.removeEventListener('pagehide', leave);};
  }, [user?.id, loading, pathname]);
  return null;
}
