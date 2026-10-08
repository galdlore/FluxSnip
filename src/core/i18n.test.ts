import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('i18n', () => {
  it('returns key when message is not found or in test environment', () => {
    expect(t('some_unknown_key')).toBe('some_unknown_key');
  });
});
