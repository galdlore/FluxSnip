/**
 * CSS Selectors for Gmail Web interface (mail.google.com).
 * All selectors for Gmail must be defined in this file ONLY.
 * Based on real-world DOM snapshots (including PeopleKit components).
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
    // Fallback obfuscated class names
    'div.Am.Al.editable[contenteditable="true"]',
    'div.editable[contenteditable="true"]',
  ],

  /**
   * Subject box input within compose window.
   */
  subjectBox: [
    'input[name="subjectbox"].aoT',
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
   * Recipient input fields (PeopleKit component).
   */
  recipients: {
    // Collapsed header row when body is focused (div.aoD.hl / div.oL.aDm "宛先")
    collapsedHeader: [
      'div.aoD.hl',
      'div.oL.aDm',
      'div.oL',
    ],
    toInput: [
      'input.agP.aFx[aria-label*="To"]',
      'input[peoplekit-id][aria-label*="To"]',
      'input[aria-label*="To の宛先"]',
      'input[aria-label*="To recipients"]',
      'input[name="to"]',
    ],
    ccInput: [
      'input.agP.aFx[aria-label*="Cc"]',
      'input[peoplekit-id][aria-label*="Cc"]',
      'input[aria-label*="Cc の宛先"]',
      'input[aria-label*="Cc recipients"]',
      'input[name="cc"]',
    ],
    bccInput: [
      'input.agP.aFx[aria-label*="Bcc"]',
      'input[peoplekit-id][aria-label*="Bcc"]',
      'input[aria-label*="Bcc の宛先"]',
      'input[aria-label*="Bcc recipients"]',
      'input[name="bcc"]',
    ],
    // Buttons to expand Cc / Bcc rows
    ccToggle: [
      'span[role="link"][data-tooltip*="Cc"]',
      'span[role="link"][aria-label*="Cc"]',
      'span.aB.gQ.pE',
    ],
    bccToggle: [
      'span[role="link"][data-tooltip*="Bcc"]',
      'span[role="link"][aria-label*="Bcc"]',
      'span.aB.gQ.pB',
    ],
    // Chip elements inside recipient fields
    chip: [
      'div[role="option"][data-hovercard-id]',
      'div.afV[data-hovercard-id]',
      'div.afV',
      'div.afZ',
      'div[peoplekit-id="hyPgpe"]',
      'div[data-hovercard-id]',
      'span[email]',
    ],
    // Email text element within chip
    chipEmail: [
      '[email]',
      '[data-hovercard-id]',
      'div.akl',
      'div.akk',
    ],
    // Display name element within chip
    chipName: [
      '[data-name]',
      'div.akl',
      'div.akk',
      '[name]',
    ],
    // Delete cross button within chip
    chipDeleteBtn: [
      'div.afX[aria-label*="Delete"]',
      'div.afX[aria-label*="削除"]',
      'div[peoplekit-id="bxvLg"]',
      'div.afX',
    ],
  },

  /**
   * From alias selection components.
   */
  from: {
    // Hidden input containing current From address
    hiddenInput: [
      'input[type="hidden"][name="from"]',
      'input[name="from"]',
    ],
    // Display button to open From dropdown
    triggerButton: [
      'tr.zm div[role="button"][aria-haspopup="true"]',
      'div.az3 div[role="button"]',
      'div.J-JN-M-I[aria-haspopup="true"]',
    ],
    // Current From display label
    currentDisplay: [
      'span.az1',
      'div.J-JN-M-I-Jm',
    ],
    // Popup menu container and option items
    menuContainer: [
      'div.J-M[role="menu"]',
      'div[role="menu"][aria-haspopup="true"]',
    ],
    menuItem: [
      'div[role="menuitem"][value]',
      'div.J-N[value]',
      'div[role="menuitem"]',
    ],
  },

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
      // Ignore
    }
  }
  return null;
}

/**
 * Queries all matching elements for the provided selector candidates.
 */
export function qAll<T extends Element = HTMLElement>(
  root: ParentNode,
  keys: readonly string[]
): T[] {
  for (const selector of keys) {
    try {
      const list = root.querySelectorAll(selector);
      if (list.length > 0) return Array.from(list) as unknown as T[];
    } catch {
      // Ignore
    }
  }
  return [];
}

/**
 * Checks if the given element matches any selector in the candidates list.
 */
export function matchesAny(el: Element, keys: readonly string[]): boolean {
  for (const selector of keys) {
    try {
      if (el.matches(selector)) return true;
    } catch {
      // Ignore
    }
  }
  return false;
}
