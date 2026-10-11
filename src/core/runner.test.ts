import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformAdapter } from './adapter';
import { runTemplate } from './runner';
import type { Template, TemplateVars } from './types';

describe('runner runTemplate pipeline', () => {
  let editor: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="editor" contenteditable="true">keyword</div>
    `;
    editor = document.getElementById('editor') as HTMLElement;
    editor.focus();
  });

  const mockTemplate: Template = {
    id: 'tpl-1',
    platform: 'gmail',
    name: 'Greeting',
    keyword: ';greet',
    tags: [],
    bodyHtml: '<p>Hello {{to.name}}!</p>',
    bodyAst: [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'Hello {{to.name}}!' },
        ],
      },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('executes full pipeline: applies fields, collects vars, and inserts content', async () => {
    const applyFieldsMock = vi.fn().mockResolvedValue({ failed: [] });
    const collectVarsMock = vi.fn().mockResolvedValue({
      to: { name: '山田 太郎', email: 'yamada@example.com' },
    });

    const mockAdapter: PlatformAdapter = {
      platform: 'gmail',
      findEditor: () => editor,
      insertOrder: ['dom'],
      applyFields: applyFieldsMock,
      collectVars: collectVarsMock,
    };

    const targetRange = document.createRange();
    targetRange.selectNodeContents(editor);

    await runTemplate(mockAdapter, editor, mockTemplate, targetRange);

    expect(applyFieldsMock).toHaveBeenCalledWith(editor, mockTemplate);
    expect(collectVarsMock).toHaveBeenCalledWith(editor);
    expect(editor.textContent).toContain('Hello 山田 太郎!');
  });

  it('proceeds with insertion even when applyFields encounters failures', async () => {
    const applyFieldsMock = vi.fn().mockResolvedValue({ failed: ['to'] });
    const collectVarsMock = vi.fn().mockResolvedValue({});

    const mockAdapter: PlatformAdapter = {
      platform: 'gmail',
      findEditor: () => editor,
      insertOrder: ['dom'],
      applyFields: applyFieldsMock,
      collectVars: collectVarsMock,
    };

    const targetRange = document.createRange();
    targetRange.selectNodeContents(editor);

    await runTemplate(mockAdapter, editor, mockTemplate, targetRange);

    expect(applyFieldsMock).toHaveBeenCalled();
    // Template content is still inserted even if field failed
    expect(editor.textContent).toContain('Hello !');
  });

  it('skips applyFields and invokes afterInsert when isPlainEditor is true', async () => {
    document.execCommand = vi.fn((cmd: string, _showUI: boolean, val?: string) => {
      if (cmd === 'insertText' && val) {
        editor.textContent = val;
        return true;
      }
      return false;
    });

    const applyFieldsMock = vi.fn().mockResolvedValue({ failed: [] });
    const afterInsertMock = vi.fn().mockResolvedValue(undefined);

    const mockAdapter: PlatformAdapter = {
      platform: 'gmail',
      findEditor: () => editor,
      insertOrder: ['insertText'],
      applyFields: applyFieldsMock,
      collectVars: vi.fn().mockResolvedValue({}),
      isPlainEditor: () => true,
      afterInsert: afterInsertMock,
    };

    const targetRange = document.createRange();
    targetRange.selectNodeContents(editor);

    await runTemplate(mockAdapter, editor, mockTemplate, targetRange);

    // applyFields must be skipped for plain editors (Gemini prompt box)
    expect(applyFieldsMock).not.toHaveBeenCalled();
    // afterInsert must be invoked
    expect(afterInsertMock).toHaveBeenCalledWith(editor, mockTemplate);
  });
});
