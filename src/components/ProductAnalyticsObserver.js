import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {onPreferenceChange, readConsent, isExcluded} from '../analytics/consent';
import {productAnalytics} from '../analytics/productAnalytics';
import {reportSiteError} from '../analytics/reporting';

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
  // Only errors from our own scripts count: silent «Script error.», other sites and browser extensions do not.
  // The check waits a tick so a render error the boundary is about to report is not counted twice.
  useEffect(() => {
    const own = filename => {try {return new URL(filename).origin === window.location.origin;} catch {return false;}};
    const onError = event => {
      if (!own(event.filename)) return;
      const error = event.error;
      Promise.resolve().then(() => reportSiteError('script', error));
    };
    const onRejection = event => {
      if (event.reason?.name !== 'AbortError') reportSiteError('script', event.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection);};
  }, []);
  return null;
}
