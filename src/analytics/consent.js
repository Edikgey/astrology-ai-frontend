// The existing banner cookie remains canonical. Legacy generic acceptance is not Clarity consent.
export const CONSENT_COOKIE = 'userCookieConsent';
const POLICY_COOKIE = 'lunariaAnalyticsPolicy';
const VERSION = 'posthog-v1';
const SYNC_KEY = 'lunaria.analytics.consent-change';
export const EXCLUDE_KEY = 'lunaria.analytics.exclude';
export const CHANGE_EVENT = 'lunaria:analytics-consent';
export const PREFERENCES_EVENT = 'lunaria:cookie-preferences';

function cookie(name) {
  return document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
}
export function readConsent() {
  const decision=cookie(CONSENT_COOKIE);
  if(decision==='false') return 'rejected';
  return decision==='true'&&cookie(POLICY_COOKIE)===VERSION?'accepted':'undecided';
}
export function isExcluded() {
  try{return localStorage.getItem(EXCLUDE_KEY)==='true';}catch{return true;}
}
export function saveConsent(accepted) {
  const options=`; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  document.cookie=`${CONSENT_COOKIE}=${accepted?'true':'false'}${options}`;
  document.cookie=`${POLICY_COOKIE}=${VERSION}${options}`;
  try{localStorage.setItem(SYNC_KEY,`${Date.now()}:${accepted}`);}catch{/* Cookie remains canonical. */}
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT,{detail:{analyticsAccepted:accepted}}));
}
export function setExcluded(value) {
  try{localStorage.setItem(EXCLUDE_KEY,value?'true':'false');}catch{/* Fail closed via isExcluded. */}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function openCookiePreferences() { window.dispatchEvent(new Event(PREFERENCES_EVENT)); }
export function onPreferenceChange(listener) {
  const storage=e=>{if([SYNC_KEY,EXCLUDE_KEY,null].includes(e.key))listener();};
  window.addEventListener(CHANGE_EVENT,listener);window.addEventListener('storage',storage);
  window.addEventListener('focus',listener);
  return ()=>{window.removeEventListener(CHANGE_EVENT,listener);window.removeEventListener('storage',storage);window.removeEventListener('focus',listener);};
}
export function clearClarityStorage() {
  // Never clear all storage: account JWTs, guest-session state and drafts are essential.
  const names=['_clck','_clsk','CLID','ANONCHK','MR','MUID','SM'];
  const host=location.hostname;
  const domains=['',host,...host.split('.').slice(1).map((_,i)=>host.split('.').slice(i+1).join('.')).filter(d=>d.includes('.'))];
  for(const name of names)for(const domain of domains){
    document.cookie=`${name}=; Max-Age=0; Path=/${domain?`; Domain=${domain}`:''}; SameSite=Lax`;
  }
  for(const type of ['localStorage','sessionStorage']) {
    try{const storage=window[type];Object.keys(storage).filter(k=>/^_cl(ck|sk|tk)$|^clarity[._:-]/i.test(k)).forEach(k=>storage.removeItem(k));}catch{/* Browser restrictions. */}
  }
}
