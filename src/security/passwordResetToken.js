// Read before App/analytics mount. Fragments are never sent in HTTP requests.
let resetToken = '';
export function captureResetToken() {
  if (window.location.pathname !== '/reset-password') return resetToken;
  if (window.location.hash) {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    resetToken = /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : '';
  }
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, '', '/reset-password');
  }
  let policy = document.querySelector('meta[name="referrer"]');
  if (!policy) { policy = document.createElement('meta'); policy.name = 'referrer'; document.head.appendChild(policy); }
  policy.content = 'no-referrer';
  return resetToken;
}
export function clearResetToken() { resetToken = ''; }
captureResetToken();
