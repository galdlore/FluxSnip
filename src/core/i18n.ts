import { browser } from 'wxt/browser';

export interface LocaleMessage {
  message: string;
}

let overrideCatalog: Record<string, LocaleMessage> | null = null;

/** When set, t() reads this catalog instead of the browser locale. Pass null to restore browser lookup. */
export function setMessageCatalog(catalog: Record<string, LocaleMessage> | null): void {
  overrideCatalog = catalog;
}

function applySubstitutions(message: string, subs?: string | string[]): string {
  const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
  return message.replace(/\$(\$|\d)/g, (match, token: string) => {
    if (token === '$') return '$';
    const index = Number(token) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return match;
    return list[index] ?? match;
  });
}

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

function messageFor(key: string, subs?: string | string[]): string {
  const entry = overrideCatalog?.[key];
  if (entry && entry.message.length > 0) {
    return applySubstitutions(entry.message, subs);
  }
  return lookup(key, subs);
}

/**
 * Get localized message by key with optional substitutions.
 * Returns the key itself if not found.
 */
export function t(key: string, subs?: string | string[]): string {
  return messageFor(key, subs) || key;
}

/**
 * Browser UI language (e.g. 'ja', 'en-US'), used for locale-aware template variables.
 */
export function getUiLocale(): string {
  try {
    const lang = browser?.i18n?.getUILanguage?.();
    if (lang) return lang;
  } catch {
    // Not running as an extension (tests, playground)
  }
  return (typeof navigator !== 'undefined' && navigator.language) || 'en';
}

/**
 * Like t(), but returns the given fallback text instead of the key when the message is missing.
 */
export function tOr(key: string, fallback: string, subs?: string | string[]): string {
  return messageFor(key, subs) || fallback;
}
