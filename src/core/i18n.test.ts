import { describe, it, expect } from 'vitest';
import { t, tOr } from './i18n';

describe('i18n', () => {
  it('returns key when message is not found or in test environment', () => {
    expect(t('some_unknown_key')).toBe('some_unknown_key');
  });

  it('tOr returns the fallback instead of the key when message is not found', () => {
    expect(tOr('some_unknown_key', 'Fallback text')).toBe('Fallback text');
  });
});
