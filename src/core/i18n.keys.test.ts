import { describe, expect, it } from 'vitest';
import en from '../../public/_locales/en/messages.json' with { type: 'json' };
import ja from '../../public/_locales/ja/messages.json' with { type: 'json' };

describe('locale message keys', () => {
  const enKeys = Object.keys(en).sort();
  const jaKeys = Object.keys(ja).sort();

  it('uses the same keys in English and Japanese', () => {
    expect(jaKeys).toEqual(enKeys);
  });

  it('gives every key a non-empty message in both locales', () => {
    for (const key of enKeys) {
      expect(en[key as keyof typeof en].message.length, key).toBeGreaterThan(0);
      expect(ja[key as keyof typeof ja].message.length, key).toBeGreaterThan(0);
    }
  });
});
