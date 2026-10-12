/**
 * CSS Selectors for Google Chat (chat.google.com and embedded chat panels).
 * Based on real-world DOM snapshots and PWA specifications.
 */

export const SEL = {
  /**
   * Google Chat message input field candidates.
   */
  body: [
    // Obfuscated class names and attributes from real-world DOM snapshot
    'div[contenteditable="true"][role="textbox"][jsname="yrriRe"]',
    'div.hj99tb[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"][g_editable="true"]',
    'div[contenteditable="true"][role="textbox"][aria-multiline="true"]',
    'div.editable[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
  ],

  /**
   * Chat message box container / group.
   */
  container: [
    'div[data-group-id]',
    'div.KCm9Q',
    'div.tAVIoc',
    'div[jsname="AAsgyb"]',
  ],

  /**
   * Send button adjacent to message input.
   */
  sendButton: [
    'button[aria-label*="送信"]',
    'button[aria-label*="Send"]',
    'button[jsname="GBTyxb"]',
  ],

  /**
   * Search and navigation elements to ignore.
   */
  ignore: [
    'input[name="q"]',
    'input[type="text"]',
    'input[role="combobox"]',
    'div[role="combobox"]',
    'header input',
  ],
} as const;

/**
 * Helper to test if an element matches any selector in a list.
 */
export function matchesAny(el: Element, selectors: readonly string[]): boolean {
  for (const s of selectors) {
    try {
      if (el.matches(s)) return true;
    } catch {
      // Ignore invalid selectors
    }
  }
  return false;
}

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
      // Ignore
    }
  }
  return null;
}
