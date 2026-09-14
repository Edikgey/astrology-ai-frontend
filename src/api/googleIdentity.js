let loading;
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const fail = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error('Google не загрузился. Проверьте соединение или войдите по email.')); };
    const timer = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      if (!window.google?.accounts?.id) { fail(); return; }
      clearTimeout(timer); resolve(window.google.accounts.id);
    };
    document.head.appendChild(script);
  });
  return loading;
}
