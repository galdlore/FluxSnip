import type { PlatformAdapter } from '@/core/adapter';
import type { InsertMethod, TemplateVars } from '@/core/types';
import { matchesAny, q, SEL } from './selectors';

/**
 * Platform adapter for Microsoft Teams (teams.microsoft.com and teams.cloud.microsoft).
 * Supports chat messages, channel new posts, and channel replies.
 * Uses paste strategy to feed HTML into CKEditor 5's internal document model.
 */
export const teamsAdapter: PlatformAdapter = {
  platform: 'teams',

  // CKEditor 5 requires paste (synthesized ClipboardEvent with text/html)
  // Direct DOM insertion is omitted because it corrupts CKEditor internal model
  insertOrder: ['paste', 'insertText', 'clipboard'] as InsertMethod[],

  findEditor(node: Node | null): HTMLElement | null {
    if (!node) return null;

    let el: Element | null = node instanceof Element ? node : node.parentElement;
    if (!el) return null;

    // 1. Guard against global search bar or header inputs
    for (const ignoreSel of SEL.ignore) {
      if (el.closest(ignoreSel)) {
        return null;
      }
    }

    // 2. Direct editor check (cursor is directly inside or on the CKEditor element)
    let curr: Element | null = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (matchesAny(curr, SEL.editor)) {
        if (curr instanceof HTMLElement && (curr.isContentEditable || curr.getAttribute('contenteditable') === 'true')) {
          return curr;
        }
      }
      curr = curr.parentElement;
    }

    // 3. Fallback: cursor is in channel subject input or compose layout controls
    const container = el.closest(SEL.composeContainer.join(','));
    if (container) {
      const editor = q<HTMLElement>(container, SEL.editor);
      if (editor && (editor.isContentEditable || editor.getAttribute('contenteditable') === 'true')) {
        return editor;
      }
    }

    return null;
  },

  async collectVars(_editor: HTMLElement): Promise<Partial<TemplateVars>> {
    // Teams messages do not have recipient or subject template headers
    return {};
  },
};
