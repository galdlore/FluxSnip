/**
 * CSS Selectors for Gmail Web interface.
 * All selectors for Gmail must be defined in this file ONLY.
 * Priority order:
 *  1. Semantic attributes (name, role, g_editable, contenteditable)
 *  2. Accessibility labels (aria-label in Japanese and English)
 *  3. Obfuscated class names (.Am, .M9, etc.) as the very last fallback.
 */

export const SEL = {
  /**
   * Gmail compose body element candidates.
   */
  body: [
    'div[contenteditable="true"][role="textbox"][g_editable="true"]',
    'div[contenteditable="true"][g_editable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label*="本文"]',
    'div[contenteditable="true"][aria-label*="Body"]',
    // Fallback obfuscated class names (last resort)
    'div.Am.Al.editable[contenteditable="true"]',
    'div.editable[contenteditable="true"]',
  ],

  /**
   * Subject box input within compose window.
   */
  subjectBox: [
    'input[name="subjectbox"]',
    'input[name="subject"]',
  ],

  /**
   * Compose window dialog / container root.
   */
  composeRoot: [
    'div[role="dialog"]',
    'div[role="region"][aria-label*="新規"]',
    'div[role="region"][aria-label*="New"]',
    // Fallback obfuscated class names
    'div.M9',
    'table.aoI',
  ],

  /**
   * Inputs to ignore (search bar, etc.)
   */
  ignore: [
    'input[name="q"]',
    'header input',
    'div[role="combobox"]',
  ],
} as const;

/**
 * Queries the first matching element for the provided selector candidates.
 */
export function q<T extends Element = HTMLElement>(
  root: ParentNode,
  keys: readonly string[]
): T | null {
  for (const selector of keys) {
    try {
      const el = root.querySelector(selector);
      if (el) return el as unknown as T;
    } catch {
      // Ignore invalid selector in older browsers
    }
  }
  return null;
}

/**
 * Checks if the given element matches any selector in the candidates list.
 */
export function matchesAny(el: Element, keys: readonly string[]): boolean {
  for (const selector of keys) {
    try {
      if (el.matches(selector)) return true;
    } catch {
      // Ignore match errors
    }
  }
  return false;
}
