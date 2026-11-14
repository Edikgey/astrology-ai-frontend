import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config/api';

// Which new options the server sells; an older server sends nothing and shows none.
const NO_OFFERS = { premium_year: false, question_pack: false };
const ServiceConfigContext = createContext({ freeBetaEnabled: false, offers: NO_OFFERS });
export const useServiceConfig = () => useContext(ServiceConfigContext);

export function ServiceConfigProvider({ children }) {
  const [freeBetaEnabled, setBeta] = useState(false);
  const [offers, setOffers] = useState(NO_OFFERS);
  useEffect(() => {
    let active = true;
    let request;
    const refresh = async () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch(`${API_URL}/public-config`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (active && !controller.signal.aborted) {
          setBeta(data.free_beta_enabled === true);
          setOffers({ premium_year: data.offers?.premium_year === true, question_pack: data.offers?.question_pack === true });
        }
      } catch (_) { /* No client-side grants: authenticated usage remains server-owned. */ }
    };
    const onFocus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false; request?.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);
  return <ServiceConfigContext.Provider value={{ freeBetaEnabled, offers }}>{children}</ServiceConfigContext.Provider>;
}
