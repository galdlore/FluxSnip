import { afterEach, describe, expect, it } from 'vitest';
import { setMessageCatalog, t, tOr } from './i18n';

describe('i18n', () => {
  afterEach(() => {
    setMessageCatalog(null);
  });

  it('returns key when message is not found or in test environment', () => {
    expect(t('some_unknown_key')).toBe('some_unknown_key');
  });

  it('tOr returns the fallback instead of the key when message is not found', () => {
    expect(tOr('some_unknown_key', 'Fallback text')).toBe('Fallback text');
  });

  it('applies $n substitutions from an override catalog', () => {
    setMessageCatalog({
      greet: { message: 'Hello $1' },
      price: { message: '$$1' },
    });
    expect(t('greet', 'Ada')).toBe('Hello Ada');
    expect(t('greet', ['Ada'])).toBe('Hello Ada');
    expect(t('price')).toBe('$1');
    expect(tOr('missing', 'Fallback')).toBe('Fallback');
  });
});
