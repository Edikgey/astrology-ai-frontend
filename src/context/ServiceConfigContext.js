import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '../config/api';

const ServiceConfigContext = createContext({ freeBetaEnabled: false });
export const useServiceConfig = () => useContext(ServiceConfigContext);

export function ServiceConfigProvider({ children }) {
  const [freeBetaEnabled, setBeta] = useState(false);
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
        if (active && !controller.signal.aborted) setBeta(data.free_beta_enabled === true);
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
  return <ServiceConfigContext.Provider value={{ freeBetaEnabled }}>{children}</ServiceConfigContext.Provider>;
}
