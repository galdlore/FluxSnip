import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insertContent } from './inserter';
import { CURSOR_MARK, type RenderedContent } from './types';

describe('inserter insertContent', () => {
  let editor: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="editor" contenteditable="true">Initial text</div>
    `;
    editor = document.getElementById('editor') as HTMLElement;
    editor.focus();

    // Setup initial selection in editor
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // caret at end
      sel.addRange(range);
    }
  });

  const mockContent: RenderedContent = {
    html: '<p>Inserted <strong>bold</strong></p>',
    text: 'Inserted bold',
    chatText: 'Inserted *bold*',
    chatHtml: '<div>Inserted <strong>bold</strong></div>',
    ast: [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'Inserted ' },
          { t: 'strong', c: [{ t: '#text', v: 'bold' }] },
        ],
      },
    ],
  };

  it('inserts DOM nodes directly when dom method is specified', async () => {
    const result = await insertContent(editor, mockContent, ['dom'], false);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('dom');

    expect(editor.innerHTML).toContain('<strong>bold</strong>');
    expect(editor.textContent).toContain('Inserted bold');
  });

  it('uses chatText when useChatText is true for plainText insertion', async () => {
    document.execCommand = vi.fn((cmd: string, showUI: boolean, val?: string) => {
      if (cmd === 'insertText' && val) {
        editor.textContent = val;
        return true;
      }
      return false;
    });

    const result = await insertContent(editor, mockContent, ['insertText'], true);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('insertText');
    expect(editor.textContent).toBe('Inserted *bold*');
  });

  it('falls back to clipboard when earlier methods fail', async () => {
    // Clear selection so dom method fails
    const sel = window.getSelection();
    sel?.removeAllRanges();

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock },
      configurable: true,
      writable: true,
    });

    // Provide ClipboardItem stub if missing in test environment
    if (typeof globalThis.ClipboardItem === 'undefined') {
      (globalThis as any).ClipboardItem = class ClipboardItem {
        constructor(public data: any) {}
      };
    }

    const result = await insertContent(editor, mockContent, ['dom', 'clipboard'], false);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('clipboard');
    expect(writeMock).toHaveBeenCalled();
  });

  it('waits for an editor that applies a paste asynchronously instead of inserting twice', async () => {
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      setTimeout(() => {
        editor.textContent += 'Inserted bold';
      }, 150);
    });
    const execMock = vi.fn(() => true);
    document.execCommand = execMock;

    const result = await insertContent(editor, mockContent, ['paste', 'insertText'], false);
    expect(result).toEqual({ ok: true, method: 'paste' });
    expect(execMock).not.toHaveBeenCalled();
    expect(editor.textContent).toBe('Initial textInserted bold');
  });

  it('falls back immediately when nobody handles the synthetic paste', async () => {
    document.execCommand = vi.fn((cmd: string, _showUI: boolean, val?: string) => {
      if (cmd === 'insertText' && val) {
        editor.textContent += val;
        return true;
      }
      return false;
    });

    const started = Date.now();
    const result = await insertContent(editor, mockContent, ['paste', 'insertText'], false);
    expect(result).toEqual({ ok: true, method: 'insertText' });
    expect(Date.now() - started).toBeLessThan(300);
  });

  it('places the caret at the {{cursor}} position and removes the mark', async () => {
    const content: RenderedContent = {
      ...mockContent,
      ast: [{ t: 'p', c: [{ t: '#text', v: `Dear ${CURSOR_MARK}, thanks` }] }],
    };

    const result = await insertContent(editor, content, ['dom'], false);
    expect(result.ok).toBe(true);
    expect(editor.textContent).toBe('Initial textDear , thanks');

    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.collapsed).toBe(true);
    expect(range?.startContainer.textContent).toBe('Dear , thanks');
    expect(range?.startOffset).toBe(5);
  });

  it('places the caret at the very beginning when {{cursor}} is at the start in dom method', async () => {
    const content: RenderedContent = {
      ...mockContent,
      ast: [{ t: 'p', c: [{ t: '#text', v: `${CURSOR_MARK}Long text following cursor` }] }],
    };

    const result = await insertContent(editor, content, ['dom'], false);
    expect(result.ok).toBe(true);
    expect(editor.textContent).toBe('Initial textLong text following cursor');

    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.collapsed).toBe(true);
    expect(range?.startContainer.textContent).toBe('Long text following cursor');
    expect(range?.startOffset).toBe(0);
  });

  it('positions caret at {{cursor}} offset during insertText method', async () => {
    editor.innerHTML = '';
    document.execCommand = vi.fn((cmd: string, _showUI: boolean, val?: string) => {
      if (cmd === 'insertText' && val) {
        editor.textContent = val;
        return true;
      }
      return false;
    });

    const content: RenderedContent = {
      ...mockContent,
      text: 'Long text following cursor',
      ast: [{ t: 'p', c: [{ t: '#text', v: `${CURSOR_MARK}Long text following cursor` }] }],
    };

    const result = await insertContent(editor, content, ['insertText'], false, true);
    expect(result.ok).toBe(true);

    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.collapsed).toBe(true);
    expect(range?.startOffset).toBe(0);
  });

  it('skips dom method and inserts plain text when isPlain is true', async () => {
    document.execCommand = vi.fn((cmd: string, _showUI: boolean, val?: string) => {
      if (cmd === 'insertText' && val) {
        editor.textContent = val;
        return true;
      }
      return false;
    });

    const result = await insertContent(editor, mockContent, ['dom', 'insertText'], false, true);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('insertText');
    expect(editor.textContent).toBe('Inserted bold');
  });

  describe('dom method rollback and one-shot undo', () => {
    const selectKeyword = () => {
      editor.textContent = 'Hello ;kw';
      const r = document.createRange();
      r.setStart(editor.firstChild!, 6);
      r.setEnd(editor.firstChild!, 9);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
    };
    const pressUndo = () => {
      const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
      editor.dispatchEvent(ev);
      return ev.defaultPrevented;
    };

    it('puts the keyword back and keeps it selected when the DOM insert throws', async () => {
      selectKeyword();
      const spy = vi.spyOn(Range.prototype, 'insertNode').mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await insertContent(editor, mockContent, ['dom'], false);
      spy.mockRestore();

      expect(result.ok).toBe(false);
      expect(editor.textContent).toBe('Hello ;kw');
      expect(window.getSelection()?.toString()).toBe(';kw');
    });

    it('restores the keyword on the Ctrl+Z right after a DOM insert', async () => {
      selectKeyword();
      await insertContent(editor, mockContent, ['dom'], false);
      expect(editor.textContent).toBe('Hello Inserted bold');

      expect(pressUndo()).toBe(true);
      expect(editor.textContent).toBe('Hello ;kw');
      expect(editor.querySelector('strong')).toBeNull();
    });

    it('leaves Ctrl+Z alone once the editor text has changed', async () => {
      selectKeyword();
      await insertContent(editor, mockContent, ['dom'], false);
      editor.append('typed');

      expect(pressUndo()).toBe(false);
      expect(editor.textContent).toBe('Hello Inserted boldtyped');
    });

    it('is disarmed by any other key before Ctrl+Z', async () => {
      selectKeyword();
      await insertContent(editor, mockContent, ['dom'], false);
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

      expect(pressUndo()).toBe(false);
      expect(editor.textContent).toBe('Hello Inserted bold');
    });

    it('handles only one Ctrl+Z', async () => {
      selectKeyword();
      await insertContent(editor, mockContent, ['dom'], false);
      expect(pressUndo()).toBe(true);
      expect(pressUndo()).toBe(false);
    });
  });

  it('uses chatHtml when useChatText is true for paste method', async () => {
    let pastedHtml = '';
    let pastedPlain = '';
    editor.addEventListener('paste', (e: Event) => {
      const ce = e as ClipboardEvent;
      pastedHtml = ce.clipboardData?.getData('text/html') || '';
      pastedPlain = ce.clipboardData?.getData('text/plain') || '';
      editor.innerHTML = pastedHtml;
    });

    const result = await insertContent(editor, mockContent, ['paste'], true);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('paste');
    expect(pastedHtml).toBe('<div>Inserted <strong>bold</strong></div>');
    expect(pastedPlain).toBe('Inserted *bold*');
  });
});
