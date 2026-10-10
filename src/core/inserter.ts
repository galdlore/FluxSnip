import { astToDom } from './html/ast';
import { dispatchInput, sleep } from './dom';
import { t } from './i18n';
import type { InsertMethod, InsertResult, RenderedContent } from './types';
import { showToast } from './ui/toast';

/**
 * Attempts to insert rendered template content into the editor
 * trying the specified insertion methods in order.
 */
export async function insertContent(
  editor: HTMLElement,
  content: RenderedContent,
  order: InsertMethod[],
  useChatText: boolean
): Promise<InsertResult> {
  const plainText = useChatText ? content.chatText : content.text;

  for (const method of order) {
    try {
      if (method === 'dom') {
        const doc = editor.ownerDocument || document;
        const win = doc.defaultView || window;
        const sel = win.getSelection();
        if (!sel || sel.rangeCount === 0) continue;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const domNode = astToDom(content.ast, doc);
        range.insertNode(domNode);

        // Move caret after inserted node
        try {
          range.collapse(false);
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
        dt.setData('text/html', content.html);
        dt.setData('text/plain', plainText);

        const beforeText = editor.innerText || editor.textContent || '';
        const ev = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        });

        const notPrevented = editor.dispatchEvent(ev);
        // Wait a tick for async handlers (e.g. Teams/Slack)
        await sleep(60);

        const afterText = editor.innerText || editor.textContent || '';
        const changed = beforeText !== afterText;

        // If defaultPrevented (listener handled it) and DOM changed, it succeeded
        if ((!notPrevented && changed) || changed) {
          return { ok: true, method: 'paste' };
        }
      }

      if (method === 'insertText') {
        const beforeText = editor.innerText || editor.textContent || '';
        const success = document.execCommand('insertText', false, plainText);
        await sleep(30);

        const afterText = editor.innerText || editor.textContent || '';
        if (success && beforeText !== afterText) {
          return { ok: true, method: 'insertText' };
        }
      }

      if (method === 'clipboard') {
        // Delete current selection / token range first
        const sel = window.getSelection();
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

        showToast(t('toast_clipboard_ready') || 'Copied to clipboard. Press Ctrl+V to paste.', 'info');
        return { ok: true, method: 'clipboard' };
      }
    } catch (err) {
      console.warn(`[FluxSnip] Insert method "${method}" failed:`, err);
    }
  }

  return { ok: false, message: 'All insertion methods failed' };
}
