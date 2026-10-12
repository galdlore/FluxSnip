/**
 * DOM utility functions for content scripts and UI components.
 * Content scripts build nodes with DOM methods only and never assign innerHTML.
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
 * Whether the range is connected and lies entirely inside the editor.
 */
export function isRangeInside(editor: HTMLElement, range?: Range | null): range is Range {
  if (!editor || !editor.isConnected || !range) return false;
  const doc = editor.ownerDocument || document;
  const inside = (n: Node | null) =>
    !!n && n.ownerDocument === doc && n.isConnected && (n === editor || editor.contains(n));
  return inside(range.startContainer) && inside(range.endContainer);
}

/**
 * Restores selection to the given Range in the editor.
 * Returns false, without moving the caret elsewhere, if the range is no longer inside the editor:
 * inserting at another position would leave the keyword behind and put content in the wrong place.
 * Never throws, even if Selection.addRange raises a DOMException.
 */
export function restoreRange(editor: HTMLElement, range?: Range | null): boolean {
  try {
    if (!isRangeInside(editor, range)) return false;

    editor.focus();
    const doc = editor.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (!sel) return false;

    try {
      sel.removeAllRanges();
    } catch {
      // Ignore errors when clearing selection
    }
    sel.addRange(range);
    return sel.rangeCount > 0 && isRangeInside(editor, sel.getRangeAt(0));
  } catch (err) {
    console.warn('[FluxSnip] Safe guard in restoreRange:', err);
    return false;
  }
}
