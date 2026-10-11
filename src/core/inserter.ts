import { astToDom } from './html/ast';
import { dispatchInput, sleep, waitFor } from './dom';
import { tOr } from './i18n';
import { CURSOR_MARK, type InsertMethod, type InsertResult, type RenderedContent } from './types';
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
  const doc = editor.ownerDocument || document;
  const win = doc.defaultView || window;

  for (const method of order) {
    try {
      if (method === 'dom') {
        if (isPlain) continue;

        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) continue;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const domNode = astToDom(content.ast, doc);
        const markedNodes = collectCursorMarkedTextNodes(domNode, doc);
        range.insertNode(domNode);

        const cursorTarget = consumeCursorMarks(markedNodes);

        try {
          if (cursorTarget) {
            range.setStart(cursorTarget.node, cursorTarget.offset);
          }
          range.collapse(cursorTarget !== null);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch {
          // Ignore range collapse/addRange failure
        }

        dispatchInput(editor, 'insertFromPaste');
        return { ok: true, method: 'dom' };
      }

      if (method === 'paste') {
        const dt = new DataTransfer();
        if (!isPlain) {
          dt.setData('text/html', content.html);
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

        const htmlBlob = new Blob([content.html], { type: 'text/html' });
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
