import { astToChatText, astToDom, astToPlainText } from './html/ast';
import { dispatchInput, sleep, waitFor } from './dom';
import { armFallbackUndo, clearFallbackUndo } from './fallback-undo';
import { tOr } from './i18n';
import {
  CURSOR_MARK,
  type AstNode,
  type InsertMethod,
  type InsertResult,
  type RenderedContent,
} from './types';
import { showToast } from './ui/toast';

function collectCursorMarkedTextNodes(root: Node, doc: Document): Text[] {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n as Text).data.includes(CURSOR_MARK)) found.push(n as Text);
  }
  return found;
}

/**
 * Removes every cursor mark and returns the position of the first one.
 */
function consumeCursorMarks(nodes: Text[]): { node: Text; offset: number } | null {
  let target: { node: Text; offset: number } | null = null;
  for (const node of nodes) {
    const offset = node.data.indexOf(CURSOR_MARK);
    node.data = node.data.split(CURSOR_MARK).join('');
    if (!target && offset >= 0) target = { node, offset };
  }
  return target;
}

/**
 * Number of text characters after the first cursor mark, or null if there is no mark.
 */
function countTextAfterCursorMark(root: Node, doc: Document): number | null {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let after: number | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const data = (n as Text).data;
    if (after === null) {
      const idx = data.indexOf(CURSOR_MARK);
      if (idx >= 0) after = data.slice(idx + 1).split(CURSOR_MARK).join('').length;
    } else {
      after += data.split(CURSOR_MARK).join('').length;
    }
  }
  return after;
}

/**
 * Moves the collapsed caret back by `chars` text characters within the editor.
 * insertHTML leaves the caret at the end of the inserted content, so this lands on the {{cursor}} spot.
 */
function moveCaretBack(editor: HTMLElement, chars: number): void {
  if (chars <= 0) return;
  const doc = editor.ownerDocument || document;
  const sel = (doc.defaultView || window).getSelection();
  if (!sel || sel.rangeCount === 0) return;

  try {
    const head = doc.createRange();
    head.selectNodeContents(editor);
    const caret = sel.getRangeAt(0);
    head.setEnd(caret.endContainer, caret.endOffset);
    const target = head.toString().length - chars;
    if (target < 0) return;

    const walker = doc.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let pos = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = (n as Text).data.length;
      if (pos + len >= target) {
        const r = doc.createRange();
        r.setStart(n, target - pos);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        return;
      }
      pos += len;
    }
  } catch {
    // Leave the caret at the end of the inserted content
  }
}

/**
 * Gmail merges edits made shortly after typing into the same undo step, so an expansion
 * right after the keyword would be undone together with the keyword, and an undo pressed
 * right after the expansion would land mid-keyword. Synthetic focus events close the current
 * step; a real blur would make Gmail's undo drop the caret at the start.
 */
function sealUndoGroup(editor: HTMLElement): void {
  editor.dispatchEvent(new FocusEvent('blur'));
  editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  editor.dispatchEvent(new FocusEvent('focus'));
  editor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

/**
 * Puts extracted content back where it was and selects it, so the next insert method
 * replaces it instead of leaving the keyword behind.
 */
function restoreExtracted(range: Range, sel: Selection, extracted: DocumentFragment): void {
  const first = extracted.firstChild;
  const last = extracted.lastChild;
  range.insertNode(extracted);
  if (first && last) {
    range.setStartBefore(first);
    range.setEndAfter(last);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function findCursorMarkOffset(ast: AstNode[], useChatText: boolean): number | null {
  const rawText = useChatText ? astToChatText(ast) : astToPlainText(ast);
  const idx = rawText.indexOf(CURSOR_MARK);
  return idx >= 0 ? idx : null;
}

function setCaretPosition(editor: HTMLElement, targetOffset: number): void {
  const doc = editor.ownerDocument || document;
  const win = doc.defaultView || window;

  if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
    try {
      editor.focus();
      editor.setSelectionRange(targetOffset, targetOffset);
      return;
    } catch {
      // Ignore
    }
  }

  try {
    editor.focus();
    const sel = win.getSelection();
    if (!sel) return;

    const walker = doc.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let targetNode: Text | null = null;
    let nodeOffset = 0;

    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const textNode = n as Text;
      const len = textNode.data.length;
      if (currentOffset + len >= targetOffset) {
        targetNode = textNode;
        nodeOffset = targetOffset - currentOffset;
        break;
      }
      currentOffset += len;
    }

    const range = doc.createRange();
    if (targetNode) {
      range.setStart(targetNode, nodeOffset);
      range.collapse(true);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Ignore selection error
  }
}

/**
 * Attempts to insert rendered template content into the editor
 * trying the specified insertion methods in order.
 */
export async function insertContent(
  editor: HTMLElement,
  content: RenderedContent,
  order: InsertMethod[],
  useChatText: boolean,
  isPlain = false
): Promise<InsertResult> {
  const plainText = useChatText ? content.chatText : content.text;
  const htmlContent = useChatText && content.chatHtml ? content.chatHtml : content.html;
  const doc = editor.ownerDocument || document;
  const win = doc.defaultView || window;
  clearFallbackUndo();

  for (const method of order) {
    try {
      if (method === 'html') {
        if (isPlain) continue;        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) continue;

        const charsAfterMark = countTextAfterCursorMark(astToDom(content.ast, doc), doc);
        const beforeText = editor.textContent ?? '';
        sealUndoGroup(editor);
        if (!doc.execCommand('insertHTML', false, htmlContent)) continue;
        if ((editor.textContent ?? '') === beforeText) continue;

        if (charsAfterMark !== null) moveCaretBack(editor, charsAfterMark);
        sealUndoGroup(editor);
        return { ok: true, method: 'html' };
      }

      if (method === 'dom') {
        if (isPlain) continue;

        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) continue;

        const range = sel.getRangeAt(0);
        const domNode = astToDom(content.ast, doc);
        const markedNodes = collectCursorMarkedTextNodes(domNode, doc);
        const insertedNodes = Array.from(domNode.childNodes);
        if (insertedNodes.length === 0) continue;

        const original = range.extractContents();
        const originalCopy = original.cloneNode(true) as DocumentFragment;
        try {
          range.insertNode(domNode);
        } catch (err) {
          restoreExtracted(range, sel, original);
          throw err;
        }

        const cursorTarget = consumeCursorMarks(markedNodes);

        dispatchInput(editor, 'insertFromPaste');
        console.warn('[FluxSnip] Inserted via direct DOM; only an immediate Ctrl+Z can undo it.');
        armFallbackUndo(editor, insertedNodes, originalCopy);

        try {
          if (cursorTarget) {
            const targetRange = doc.createRange();
            targetRange.setStart(cursorTarget.node, cursorTarget.offset);
            targetRange.setEnd(cursorTarget.node, cursorTarget.offset);
            targetRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(targetRange);
          } else {
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {
          // Ignore range collapse/addRange failure
        }

        return { ok: true, method: 'dom' };
      }

      if (method === 'paste') {
        const dt = new DataTransfer();
        if (!isPlain) {
          dt.setData('text/html', htmlContent);
        }
        dt.setData('text/plain', plainText);

        const beforeText = editor.innerText || editor.textContent || '';
        const ev = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        });

        const notPrevented = editor.dispatchEvent(ev);
        const readText = () => editor.innerText || editor.textContent || '';

        if (notPrevented) {
          // A synthetic paste has no default action, so unless a listener inserted
          // synchronously, nothing is coming: fall back right away.
          if (readText() !== beforeText) {
            return { ok: true, method: 'paste' };
          }
          continue;
        }

        // The editor took the paste and may apply it asynchronously (e.g. Teams CKEditor).
        // Falling back too early would insert the content twice.
        const changed = await waitFor(() => readText() !== beforeText, { timeout: 500, interval: 20 });
        if (changed) {
          return { ok: true, method: 'paste' };
        }
        console.warn('[FluxSnip] Paste was accepted by the editor but produced no change; falling back.');
      }

      if (method === 'insertText') {
        const beforeText = editor.innerText || editor.textContent || '';
        let success = false;

        const cursorOffset = findCursorMarkOffset(content.ast, useChatText);

        if ((useChatText || isPlain) && plainText.includes('\n')) {
          // Dispatch line-by-line with insertLineBreak (Shift+Enter equivalent) to prevent premature submission
          const lines = plainText.split('\n');
          success = true;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i]) {
              success = doc.execCommand('insertText', false, lines[i]) && success;
            }
            if (i < lines.length - 1) {
              const brSuccess = doc.execCommand('insertLineBreak');
              if (!brSuccess) {
                doc.execCommand('insertParagraph');
              }
            }
          }
        } else {
          success = doc.execCommand('insertText', false, plainText);
        }

        await sleep(30);

        if (cursorOffset !== null && cursorOffset >= 0) {
          setCaretPosition(editor, cursorOffset);
        }

        const afterText = editor.innerText || editor.textContent || '';
        if (success && beforeText !== afterText) {
          return { ok: true, method: 'insertText' };
        }
      }

      if (method === 'clipboard') {
        // Delete current selection / token range first
        const sel = win.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.getRangeAt(0).deleteContents();
        }

        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);

        showToast(tOr('toast_clipboard_ready', 'Copied to clipboard. Press Ctrl+V to paste.'), 'info');
        return { ok: true, method: 'clipboard' };
      }
    } catch (err) {
      console.warn(`[FluxSnip] Insert method "${method}" failed:`, err);
    }
  }

  return { ok: false, message: 'All insertion methods failed' };
}
