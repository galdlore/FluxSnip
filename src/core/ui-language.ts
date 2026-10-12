import enCatalog from '../../public/_locales/en/messages.json' with { type: 'json' };
import jaCatalog from '../../public/_locales/ja/messages.json' with { type: 'json' };
import { setMessageCatalog } from './i18n';
import { normalizeUiLanguage, type UiLanguage } from './types';

export const HELP_PAGES = ['index', 'gmail', 'teams', 'chat', 'settings', 'backup'] as const;
export type HelpPage = (typeof HELP_PAGES)[number];

const CATALOGS = {
  en: enCatalog,
  ja: jaCatalog,
} as const;

/**
 * Point t() at the saved language. `auto` keeps Chrome's UI language.
 */
export function applyUiLanguage(language: UiLanguage): void {
  const lang = normalizeUiLanguage(language);
  if (lang === 'auto') {
    setMessageCatalog(null);
    return;
  }
  setMessageCatalog(CATALOGS[lang]);
}

/** Language folder for Help HTML. Unknown browser languages fall back to English. */
export function resolveHelpLanguage(language: UiLanguage, browserLang: string): 'en' | 'ja' {
  const lang = normalizeUiLanguage(language);
  if (lang === 'en' || lang === 'ja') return lang;
  return browserLang.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/** Extension-relative path for browser.runtime.getURL. */
export function helpPagePath(language: 'en' | 'ja', page: HelpPage): `/help/${typeof language}/${HelpPage}.html` {
  return `/help/${language}/${page}.html`;
}
