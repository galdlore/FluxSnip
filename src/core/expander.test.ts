import { describe, expect, it } from 'vitest';
import type { PlatformAdapter } from './adapter';
import { tryExpand } from './expander';
import type { GmailTemplate } from './types';

describe('expander tryExpand', () => {
  const dummyAdapter: PlatformAdapter = {
    platform: 'gmail',
    findEditor: () => null,
    collectVars: async () => ({}),
    insertOrder: ['dom'],
  };

  const templates: GmailTemplate[] = [
    {
      id: '1',
      platform: 'gmail',
      name: 'Thanks',
      keyword: ';thx',
      tags: [],
      bodyHtml: '<p>Thanks!</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Thanks!' }] }],
      createdAt: 100,
      updatedAt: 100,
    },
    {
      id: '2',
      platform: 'gmail',
      name: 'Meeting',
      keyword: ';mtg',
      tags: [],
      bodyHtml: '<p>Meeting details</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Meeting details' }] }],
      createdAt: 200,
      updatedAt: 200,
    },
  ];

  it('returns token range when keyword matches exactly before caret', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const textNode = document.createTextNode('Hello ;thx');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    // Place caret at the end of the text node
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, templates);

    expect(result).not.toBeNull();
    expect(result?.toString()).toBe(';thx');
    expect(result?.startOffset).toBe(6);
    expect(result?.endOffset).toBe(10);

    editor.remove();
  });

  it('returns null when trailing token does not match any template', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const textNode = document.createTextNode('Hello ;unknown');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const range = document.createRange();
    range.setStart(textNode, 14);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, templates);

    expect(result).toBeNull();
    editor.remove();
  });

  it('returns null when caret is not preceded by keyword chars', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const textNode = document.createTextNode('Hello ');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, templates);

    expect(result).toBeNull();
    editor.remove();
  });
});
