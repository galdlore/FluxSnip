import { browser } from 'wxt/browser';

function lookup(key: string, subs?: string | string[]): string {
  try {
    // browser.i18n.getMessage in WXT generates a union of known message keys.
    // We allow any string key dynamically at runtime.
    const msg = (browser?.i18n?.getMessage as (messageName: string, substitutions?: any) => string)?.(key, subs);
    return msg || '';
  } catch {
    return '';
  }
}

/**
 * Get localized message by key with optional substitutions.
 * Returns the key itself if not found.
 */
export function t(key: string, subs?: string | string[]): string {
  return lookup(key, subs) || key;
}

/**
 * Like t(), but returns the given fallback text instead of the key when the message is missing.
 */
export function tOr(key: string, fallback: string, subs?: string | string[]): string {
  return lookup(key, subs) || fallback;
}
