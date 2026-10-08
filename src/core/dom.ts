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
export function getCaretRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  try {
    return sel.getRangeAt(0).cloneRange();
  } catch {
    return null;
  }
}

/**
 * Restores selection to the given Range in the editor.
 * If the range is disconnected or invalid, positions caret at the end of the editor.
 */
export function restoreRange(editor: HTMLElement, range: Range): void {
  editor.focus();
  const sel = window.getSelection();
  if (!sel) return;

  sel.removeAllRanges();

  const isConnected =
    range.startContainer.isConnected &&
    (editor.contains(range.startContainer) || editor === range.startContainer);

  if (isConnected) {
    sel.addRange(range);
  } else {
    // Fallback: place caret at the end of the editor
    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(editor);
    fallbackRange.collapse(false);
    sel.addRange(fallbackRange);
  }
}
