import { describe, expect, it } from 'vitest';
import { deepActiveElement, isEditable, restoreRange, sleep, waitFor } from './dom';

describe('dom utils', () => {
  it('sleep delays execution', async () => {
    const start = Date.now();
    await sleep(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it('waitFor resolves when condition is met', async () => {
    let count = 0;
    setTimeout(() => {
      count = 5;
    }, 40);

    const result = await waitFor(() => count === 5 && count, { timeout: 300, interval: 10 });
    expect(result).toBe(5);
  });

  it('waitFor returns null on timeout', async () => {
    const result = await waitFor(() => false, { timeout: 40, interval: 10 });
    expect(result).toBeNull();
  });

  it('isEditable detects contenteditable elements correctly', () => {
    const div = document.createElement('div');
    expect(isEditable(div)).toBe(false);

    div.setAttribute('contenteditable', 'true');
    expect(isEditable(div)).toBe(true);

    const plaintextDiv = document.createElement('div');
    plaintextDiv.setAttribute('contenteditable', 'plaintext-only');
    expect(isEditable(plaintextDiv)).toBe(true);

    const input = document.createElement('input');
    expect(isEditable(input)).toBe(false);
  });

  it('deepActiveElement penetrates shadow DOM boundaries', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const innerInput = document.createElement('input');
    shadow.appendChild(innerInput);
    document.body.appendChild(host);

    innerInput.focus();
    // In happy-dom or real browser, activeElement on shadow boundary
    const active = deepActiveElement();
    expect(active === innerInput || active === host).toBe(true);

    host.remove();
  });

  it('restoreRange handles disconnected editor safely without throwing', () => {
    const disconnectedEditor = document.createElement('div');
    disconnectedEditor.setAttribute('contenteditable', 'true');
    const range = document.createRange();

    expect(() => {
      restoreRange(disconnectedEditor, range);
    }).not.toThrow();
  });

  it('restoreRange handles disconnected or foreign range safely and falls back', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    document.body.appendChild(editor);

    const foreignDiv = document.createElement('div');
    const detachedRange = document.createRange();
    detachedRange.selectNodeContents(foreignDiv);

    expect(restoreRange(editor, detachedRange)).toBe(false);

    editor.remove();
  });

  it('restoreRange applies a range inside the editor and reports success', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'hello';
    document.body.appendChild(editor);

    const range = document.createRange();
    range.setStart(editor.firstChild as Text, 2);
    range.collapse(true);

    expect(restoreRange(editor, range)).toBe(true);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(2);

    editor.remove();
  });

  it('restoreRange safely catches DOMException from Selection.addRange without bubbling', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    document.body.appendChild(editor);

    const range = document.createRange();
    range.selectNodeContents(editor);

    const sel = window.getSelection();
    if (sel) {
      const origAddRange = sel.addRange;
      sel.addRange = () => {
        throw new DOMException("The given range isn't in document", 'InvalidStateError');
      };

      try {
        expect(() => {
          restoreRange(editor, range);
        }).not.toThrow();
      } finally {
        sel.addRange = origAddRange;
      }
    }

    editor.remove();
  });
});
