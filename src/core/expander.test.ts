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
    expect(result?.template.keyword).toBe(';thx');
    expect(result?.range.toString()).toBe(';thx');
    expect(result?.range.startOffset).toBe(6);
    expect(result?.range.endOffset).toBe(10);

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

  it('returns null when caret is at offset 0 of element preceding a keyword', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const p = document.createElement('p');
    p.textContent = ';thx';
    editor.appendChild(p);
    document.body.appendChild(editor);

    // Caret at the beginning of the <p> element (offset 0)
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, templates);

    expect(result).toBeNull();
    editor.remove();
  });

  it('expands Japanese keyword and returns correct token range', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const textNode = document.createTextNode('いつもお世話になっております。;挨拶');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const jaTemplates: GmailTemplate[] = [
      ...templates,
      {
        id: '3',
        platform: 'gmail',
        name: 'Aisatsu',
        keyword: ';挨拶',
        tags: [],
        bodyHtml: '<p>お世話になっております。</p>',
        bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'お世話になっております。' }] }],
        createdAt: 300,
        updatedAt: 300,
      },
    ];

    const range = document.createRange();
    range.setStart(textNode, textNode.data.length);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, jaTemplates);

    expect(result).not.toBeNull();
    expect(result?.template.keyword).toBe(';挨拶');
    expect(result?.range.toString()).toBe(';挨拶');

    editor.remove();
  });

  it('expands keyword that spans multiple Text nodes', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const span1 = document.createElement('span');
    span1.appendChild(document.createTextNode(';'));
    const span2 = document.createElement('span');
    const text2 = document.createTextNode('挨拶');
    span2.appendChild(text2);
    editor.appendChild(span1);
    editor.appendChild(span2);
    document.body.appendChild(editor);

    const jaTemplates: GmailTemplate[] = [
      {
        id: '3',
        platform: 'gmail',
        name: 'Aisatsu',
        keyword: ';挨拶',
        tags: [],
        bodyHtml: '<p>お世話になっております。</p>',
        bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'お世話になっております。' }] }],
        createdAt: 300,
        updatedAt: 300,
      },
    ];

    const range = document.createRange();
    range.setStart(text2, text2.data.length);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const ev = new KeyboardEvent('keydown', { key: 'Tab' });
    const result = tryExpand(ev, dummyAdapter, editor, jaTemplates);

    expect(result).not.toBeNull();
    expect(result?.template.keyword).toBe(';挨拶');
    expect(result?.range.toString()).toBe(';挨拶');

    editor.remove();
  });
});
