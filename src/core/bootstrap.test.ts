import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import type { PlatformAdapter } from './adapter';
import { startContent } from './bootstrap';
import { waitFor } from './dom';
import { saveTemplate } from './storage';
import type { Template } from './types';

describe('startContent Tab handling', () => {
  let editor: HTMLElement;
  let header: HTMLInputElement;
  let releaseFields: () => void;
  let fieldsStarted = false;
  let unmount: () => void;

  const template: Template = {
    id: 'tpl-tab',
    platform: 'gmail',
    name: 'Tab',
    keyword: ';tab',
    tags: [],
    bodyHtml: '<p>Body</p>',
    bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Body' }] }],
    createdAt: 1,
    updatedAt: 1,
  };

  const pressTab = (target: HTMLElement) => {
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  beforeEach(async () => {
    await browser.storage.local.clear();
    await saveTemplate(template);

    document.body.innerHTML = '<input id="to"><div id="editor" contenteditable="true">;tab</div>';
    editor = document.getElementById('editor') as HTMLElement;
    header = document.getElementById('to') as HTMLInputElement;
    fieldsStarted = false;

    const adapter: PlatformAdapter = {
      platform: 'gmail',
      findEditor: (node) => (node instanceof Node && editor.contains(node) ? editor : null),
      collectVars: async () => ({}),
      applyFields: () => {
        fieldsStarted = true;
        // Like Gmail recipients: the adapter drives a header field, so focus leaves the body
        header.focus();
        return new Promise((resolve) => {
          releaseFields = () => resolve({ failed: [] });
        });
      },
      insertOrder: ['dom'],
    };
    unmount = startContent([adapter]);
    await waitFor(() => true, { timeout: 50 });
  });

  afterEach(() => unmount());

  it('swallows Tab while a template is running, even outside the editor', async () => {
    editor.focus();
    const r = document.createRange();
    r.setStart(editor.firstChild!, 4);
    r.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);

    expect(pressTab(editor)).toBe(true);
    await waitFor(() => fieldsStarted, { timeout: 500 });

    expect(pressTab(header)).toBe(true);

    releaseFields();
    await waitFor(() => (editor.textContent ?? '').includes('Body'), { timeout: 500 });
    expect(pressTab(header)).toBe(false);
  });
});
