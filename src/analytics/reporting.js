import {productAnalytics} from './productAnalytics';

// Page code must keep working when analytics is broken: every call here swallows its own failure.
export function track(name, properties) {
  try {productAnalytics.emit(name, properties);} catch { /* Analytics is optional. */ }
}

// An error the boundary already reported must not be counted again when the same object
// reaches window «error» (React re-throws caught render errors there outside production).
const reported = new WeakSet();
export function reportSiteError(kind, error) {
  try {
    if (error && typeof error === 'object') {
      if (kind === 'render') reported.add(error);
      else if (reported.has(error)) return;
    }
    productAnalytics.reportError(kind);
  } catch { /* Analytics is optional. */ }
}
