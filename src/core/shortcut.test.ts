import { describe, expect, it } from 'vitest';
import { comboFromEvent, comboToLabel, matchesCombo } from './shortcut';
import type { KeyCombo } from './types';

describe('shortcut', () => {
  const targetCombo: KeyCombo = {
    code: 'KeyJ',
    ctrl: false,
    alt: true,
    shift: false,
    meta: false,
  };

  it('matches KeyboardEvent against KeyCombo exactly', () => {
    const validEvent = new KeyboardEvent('keydown', {
      code: 'KeyJ',
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
    });
    expect(matchesCombo(validEvent, targetCombo)).toBe(true);

    const extraShift = new KeyboardEvent('keydown', {
      code: 'KeyJ',
      altKey: true,
      shiftKey: true,
    });
    expect(matchesCombo(extraShift, targetCombo)).toBe(false);
  });

  it('returns null from comboFromEvent if only modifier key is pressed', () => {
    const altOnly = new KeyboardEvent('keydown', { code: 'AltLeft', altKey: true });
    expect(comboFromEvent(altOnly)).toBe(null);

    const keyWithAlt = new KeyboardEvent('keydown', { code: 'KeyJ', altKey: true });
    expect(comboFromEvent(keyWithAlt)).toEqual({
      code: 'KeyJ',
      ctrl: false,
      alt: true,
      shift: false,
      meta: false,
    });
  });

  it('formats label for Mac and Windows appropriately', () => {
    expect(comboToLabel(targetCombo, false)).toBe('Alt+J');
    expect(comboToLabel(targetCombo, true)).toBe('⌥J');

    const complexCombo: KeyCombo = {
      code: 'KeyK',
      ctrl: true,
      alt: false,
      shift: true,
      meta: true,
    };
    expect(comboToLabel(complexCombo, false)).toBe('Ctrl+Shift+Win+K');
    expect(comboToLabel(complexCombo, true)).toBe('⌃⇧⌘K');
  });
});
