import type { KeyCombo } from './types';

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'ShiftLeft', 'ShiftRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
]);

/**
 * Checks whether a KeyboardEvent exactly matches the target KeyCombo.
 */
export function matchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  return (
    e.code === combo.code &&
    !!e.ctrlKey === !!combo.ctrl &&
    !!e.altKey === !!combo.alt &&
    !!e.shiftKey === !!combo.shift &&
    !!e.metaKey === !!combo.meta
  );
}

/**
 * Extracts a KeyCombo from a KeyboardEvent. Returns null if only modifier keys were pressed.
 */
export function comboFromEvent(e: KeyboardEvent): KeyCombo | null {
  if (MODIFIER_CODES.has(e.code)) {
    return null;
  }

  return {
    code: e.code,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  };
}

function formatKeyName(code: string): string {
  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    return `Num ${code.slice(6)}`;
  }

  const SPECIAL_MAP: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Escape: 'Esc',
    Backspace: 'Backspace',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };

  return SPECIAL_MAP[code] || code;
}

/**
 * Converts KeyCombo into human-readable label (e.g. 'Alt+J' or '⌥J' on Mac).
 */
export function comboToLabel(combo: KeyCombo, isMac: boolean): string {
  const keyName = formatKeyName(combo.code);

  if (isMac) {
    const parts: string[] = [];
    if (combo.ctrl) parts.push('⌃');
    if (combo.alt) parts.push('⌥');
    if (combo.shift) parts.push('⇧');
    if (combo.meta) parts.push('⌘');
    parts.push(keyName);
    return parts.join('');
  }

  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.alt) parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta) parts.push('Win');
  parts.push(keyName);
  return parts.join('+');
}
