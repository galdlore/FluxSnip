import type { PlatformAdapter } from '@/core/adapter';
import type { InsertMethod, TemplateVars } from '@/core/types';
import { matchesAny, q, SEL } from './selectors';

/**
 * Platform adapter for Google Chat (chat.google.com and embedded chat panels).
 */
export const chatAdapter: PlatformAdapter = {
  platform: 'chat',

  // Prefers paste (synthesized ClipboardEvent with text/html) to preserve rich text (Bold, Italic, Underline, Strike)
  // Falls back to line-by-line insertText to prevent premature submission on platforms without paste support
  insertOrder: ['paste', 'insertText', 'clipboard'] as InsertMethod[],

  findEditor(node: Node | null): HTMLElement | null {
    if (!node) return null;

    let el: Element | null = node instanceof Element ? node : node.parentElement;

    while (el) {
      // Ignore search bar or other comboboxes
      if (matchesAny(el, SEL.ignore)) {
        return null;
      }

      // Check if this element matches Chat message input
      if (matchesAny(el, SEL.body)) {
        // Disambiguation with Gmail compose window:
        // If it's inside Gmail compose dialog (.M9 / table.aoI) and has Gmail body class, let GmailAdapter handle it
        if (el.classList.contains('Am') && el.closest('.M9, table.aoI')) {
          return null;
        }

        // Verify it is an editable textbox
        if (el instanceof HTMLElement && (el.isContentEditable || el.getAttribute('contenteditable') === 'true')) {
          return el;
        }
      }

      // Focus is elsewhere in a message box (e.g. send button): only search inside that box,
      // never in arbitrary ancestors, or any textbox on the page would be claimed.
      if (matchesAny(el, SEL.container)) {
        const innerEditor = q<HTMLElement>(el, SEL.body);
        if (innerEditor && (innerEditor.isContentEditable || innerEditor.getAttribute('contenteditable') === 'true')) {
          if (!(innerEditor.classList.contains('Am') && innerEditor.closest('.M9, table.aoI'))) {
            return innerEditor;
          }
        }
      }

      el = el.parentElement;
    }

    return null;
  },

  async collectVars(_editor: HTMLElement): Promise<Partial<TemplateVars>> {
    // Google Chat does not have dynamic To/Cc/Subject headers
    return {};
  },
};
