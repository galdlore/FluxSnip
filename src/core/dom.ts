/**
 * DOM utility functions for content scripts and UI components.
 * Strictly adheres to DOM methods without innerHTML or forbidden APIs.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  fn: () => T | null | undefined | false,
  opts?: { timeout?: number; interval?: number }
): Promise<T | null> {
  const timeout = opts?.timeout ?? 2000;
  const interval = opts?.interval ?? 50;
  const startTime = Date.now();

  while (Date.now() - startTime <= timeout) {
    try {
      const result = fn();
      if (result !== null && result !== undefined && result !== false) {
        return result;
      }
    } catch {
      // Ignore evaluation errors during waiting
    }
    await sleep(interval);
  }

  return null;
}

/**
 * Traverses recursively through shadow roots to find the actual active element.
 */
export function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  const active = root.activeElement;
  if (!active) return null;
  if (active.shadowRoot) {
    return deepActiveElement(active.shadowRoot);
  }
  return active;
}

/**
 * Determines whether an element is contenteditable.
 */
export function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  const attr = el.getAttribute('contenteditable');
  if (attr === 'true' || attr === '' || attr === 'plaintext-only') {
    return true;
  }
  return el.isContentEditable === true;
}

/**
 * Dispatches an InputEvent to notify frameworks/editors of changes.
 */
export function dispatchInput(el: HTMLElement, inputType: string = 'insertText'): void {
  try {
    const ev = new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType,
    });
    el.dispatchEvent(ev);
  } catch {
    // Fallback for older environments
    const ev = new Event('input', { bubbles: true, cancelable: false });
    el.dispatchEvent(ev);
  }
}

/**
 * Gets a clone of the current caret Range, if any.
 */
export function getCaretRange(target?: Node | null): Range | null {
  try {
    const doc = (target && 'ownerDocument' in target && target.ownerDocument) ? target.ownerDocument : document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0).cloneRange();
  } catch {
    return null;
  }
}

/**
 * Restores selection to the given Range in the editor.
 * If the range is disconnected or invalid, positions caret at the end of the editor.
 * Guarantees zero unhandled exceptions even if DOMException is thrown by Selection.addRange.
 */
export function restoreRange(editor: HTMLElement, range?: Range | null): void {
  try {
    if (!editor || !editor.isConnected) {
      return;
    }

    editor.focus();

    const doc = editor.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel) return;

    try {
      sel.removeAllRanges();
    } catch {
      // Ignore errors when clearing selection
    }

    let restored = false;

    // Check if range is valid, belongs to the same document, and is fully connected inside editor
    if (
      range &&
      range.startContainer &&
      range.endContainer &&
      range.startContainer.ownerDocument === doc &&
      range.endContainer.ownerDocument === doc &&
      range.startContainer.isConnected &&
      range.endContainer.isConnected &&
      (editor.contains(range.startContainer) || editor === range.startContainer) &&
      (editor.contains(range.endContainer) || editor === range.endContainer)
    ) {
      try {
        sel.addRange(range);
        restored = true;
      } catch {
        // addRange might throw DOMException ("The given range isn't in document")
        restored = false;
      }
    }

    // Fallback: place caret at the end of the editor if range restoration failed
    if (!restored && editor.isConnected) {
      try {
        const fallbackRange = doc.createRange();
        fallbackRange.selectNodeContents(editor);
        fallbackRange.collapse(false);
        try {
          sel.removeAllRanges();
        } catch {}
        sel.addRange(fallbackRange);
      } catch {
        // Silently swallow any Selection / Range DOMExceptions
      }
    }
  } catch (err) {
    console.warn('[FluxSnip] Safe guard in restoreRange:', err);
  }
}
