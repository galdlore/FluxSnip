import { dispatchInput } from './dom';
import { tOr } from './i18n';
import { showToast } from './ui/toast';

/**
 * One-shot undo for content inserted by direct DOM manipulation, which the browser's and
 * Gmail's undo history never see. Only the Ctrl/Cmd+Z pressed right after the insertion is
 * handled, and only while the inserted nodes and the editor text are exactly as left;
 * otherwise the key is passed through untouched rather than risking a wrong restore.
 */
interface PendingUndo {
  editor: HTMLElement;
  inserted: Node[];
  original: DocumentFragment;
  textAfter: string;
  dispose: () => void;
}

let pending: PendingUndo | null = null;

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'CapsLock']);

function isUndoKey(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z';
}

function isIntact(p: PendingUndo): boolean {
  return (
    p.editor.isConnected &&
    p.inserted.length > 0 &&
    p.inserted.every((n) => n.isConnected && p.editor.contains(n)) &&
    (p.editor.textContent ?? '') === p.textAfter
  );
}

function revert(p: PendingUndo): void {
  const doc = p.editor.ownerDocument || document;
  const first = p.inserted[0];
  const parent = first?.parentNode;
  if (!first || !parent) throw new Error('inserted node has no parent');

  parent.insertBefore(p.original, first);
  // A live range before the first inserted node ends up right after the restored content
  const caret = doc.createRange();
  caret.setStartBefore(first);
  caret.collapse(true);
  for (const n of p.inserted) n.parentNode?.removeChild(n);

  const sel = (doc.defaultView || window).getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(caret);
  }
  dispatchInput(p.editor, 'historyUndo');
}

export function clearFallbackUndo(): void {
  pending?.dispose();
  pending = null;
}

/**
 * @param inserted Top-level nodes that were inserted, in document order.
 * @param original What the insertion replaced (typically the keyword); it is reinserted on undo.
 */
export function armFallbackUndo(editor: HTMLElement, inserted: Node[], original: DocumentFragment): void {
  clearFallbackUndo();
  const doc = editor.ownerDocument || document;

  const onKeyDown = (e: KeyboardEvent) => {
    if (MODIFIER_KEYS.has(e.key)) return;
    const p = pending;
    clearFallbackUndo();
    if (!p || !isUndoKey(e) || !isIntact(p)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      revert(p);
    } catch (err) {
      console.warn('[FluxSnip] Fallback undo failed:', err);
      showToast(tOr('toast_undo_failed', 'Could not undo the expansion.'), 'error');
    }
  };
  const onOther = () => clearFallbackUndo();

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('mousedown', onOther, true);
  doc.addEventListener('paste', onOther, true);
  doc.addEventListener('drop', onOther, true);

  pending = {
    editor,
    inserted,
    original,
    textAfter: editor.textContent ?? '',
    dispose: () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('mousedown', onOther, true);
      doc.removeEventListener('paste', onOther, true);
      doc.removeEventListener('drop', onOther, true);
    },
  };
}
