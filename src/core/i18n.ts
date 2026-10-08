import { browser } from 'wxt/browser';

/**
 * Get localized message by key with optional substitutions.
 * Returns the key itself if not found.
 */
export function t(key: string, subs?: string | string[]): string {
  try {
    // browser.i18n.getMessage in WXT generates a union of known message keys.
    // We allow any string key dynamically at runtime, falling back to the key name.
    const msg = (browser?.i18n?.getMessage as (messageName: string, substitutions?: any) => string)?.(key, subs);
    return msg || key;
  } catch {
    return key;
  }
}
