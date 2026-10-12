import { afterEach, describe, expect, it } from 'vitest';
import { setMessageCatalog, t } from './i18n';
import { applyUiLanguage, helpPagePath, resolveHelpLanguage } from './ui-language';

describe('ui language', () => {
  afterEach(() => {
    setMessageCatalog(null);
  });

  it('resolves help language from the saved choice or the browser language', () => {
    expect(resolveHelpLanguage('ja', 'en-US')).toBe('ja');
    expect(resolveHelpLanguage('en', 'ja')).toBe('en');
    expect(resolveHelpLanguage('auto', 'ja-JP')).toBe('ja');
    expect(resolveHelpLanguage('auto', 'en-GB')).toBe('en');
    expect(resolveHelpLanguage('auto', 'fr')).toBe('en');
    expect(resolveHelpLanguage('auto', '')).toBe('en');
  });

  it('builds a help page path for each language', () => {
    expect(helpPagePath('en', 'gmail')).toBe('/help/en/gmail.html');
    expect(helpPagePath('ja', 'backup')).toBe('/help/ja/backup.html');
  });

  it('switches t() to the saved catalog and restores browser lookup', () => {
    applyUiLanguage('en');
    expect(t('options_open_help')).toBe('Help');
    applyUiLanguage('ja');
    expect(t('options_open_help')).toBe('ヘルプ');
    applyUiLanguage('auto');
    expect(t('options_open_help')).toBe('options_open_help');
  });
});
