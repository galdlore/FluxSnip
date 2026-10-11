import { describe, expect, it } from 'vitest';
import { expandText, renderTemplate, splitName } from './engine';
import { CURSOR_MARK, type Template, type TemplateVars } from './types';

describe('splitName', () => {
  it('correctly parses CJK names with half-width and full-width spaces', () => {
    expect(splitName('山田 太郎')).toEqual({ lastName: '山田', firstName: '太郎' });
    expect(splitName('山田　太郎')).toEqual({ lastName: '山田', firstName: '太郎' });
    expect(splitName('佐藤\u00A0花子')).toEqual({ lastName: '佐藤', firstName: '花子' });
  });

  it('correctly parses Western names', () => {
    expect(splitName('John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' });
    expect(splitName('Arthur Conan Doyle')).toEqual({ firstName: 'Arthur Conan', lastName: 'Doyle' });
  });

  it('handles single token names', () => {
    expect(splitName('Madonna')).toEqual({ firstName: 'Madonna', lastName: 'Madonna' });
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('expandText', () => {
  const vars: TemplateVars = {
    now: new Date(2026, 9, 8, 14, 30), // 2026-10-08 14:30
    locale: 'ja',
    to: {
      name: '山田 太郎',
      email: 'yamada@example.com',
    },
    from: {
      name: '佐藤 一郎',
      email: 'sato@example.com',
    },
  };

  it('expands built-in date, time, weekday', () => {
    expect(expandText('Date: {{date}} Time: {{time}}', vars)).toBe('Date: 2026/10/08 Time: 14:30');
    expect(expandText('Formatted: {{date:YYYY年M月D日 HH:mm}}', vars)).toBe('Formatted: 2026年10月8日 14:30');
  });

  it('expands to and from recipient variables', () => {
    expect(expandText('Hello {{to.firstName}} {{to.lastName}} ({{to.email}})', vars)).toBe(
      'Hello 太郎 山田 (yamada@example.com)'
    );
    expect(expandText('From: {{from.name}}', vars)).toBe('From: 佐藤 一郎');
  });

  it('falls back to email local part when name is missing', () => {
    const noNameVars: TemplateVars = {
      now: new Date(),
      locale: 'en',
      to: { email: 'alice@example.com' },
    };
    expect(expandText('Hi {{to.name}}!', noNameVars)).toBe('Hi alice!');
    expect(expandText('Hi {{to.firstName}}!', noNameVars)).toBe('Hi alice!');
  });

  it('leaves unknown variables intact and expands cursor to empty string', () => {
    expect(expandText('Unknown: {{custom.var}} End: {{cursor}}', vars)).toBe('Unknown: {{custom.var}} End: ');
  });

  it('replaces known empty variables with empty string', () => {
    const emptyVars: TemplateVars = { now: new Date(), locale: 'ja' };
    expect(expandText('To: [{{to.name}}]', emptyVars)).toBe('To: []');
  });
});

describe('renderTemplate', () => {
  it('substitutes variables across AST text nodes without affecting attributes', () => {
    const t: Template = {
      id: '1',
      platform: 'gmail',
      name: 'Greeting',
      keyword: ';hi',
      tags: [],
      bodyHtml: '<p title="{{date}}">Hello {{to.firstName}}!</p>',
      bodyAst: [
        {
          t: 'p',
          a: { title: '{{date}}' }, // Attribute should NOT be expanded per v1 spec
          c: [{ t: '#text', v: 'Hello {{to.firstName}}!' }],
        },
      ],
      createdAt: 100,
      updatedAt: 100,
    };

    const vars: TemplateVars = {
      now: new Date(2026, 9, 8),
      locale: 'ja',
      to: { name: '鈴木 一郎' },
    };

    const rendered = renderTemplate(t, vars);
    expect(rendered.html).toBe('<p title="{{date}}">Hello 一郎!</p>');
    expect(rendered.text).toBe('Hello 一郎!');
  });

  it('expands a variable whose name was partly formatted in the editor', () => {
    const t: Template = {
      id: '3',
      platform: 'gmail',
      name: 'Split',
      keyword: ';split',
      tags: [],
      bodyHtml: '<p>{{to.<b>last</b>Name}}様</p>',
      bodyAst: [
        {
          t: 'p',
          c: [
            { t: '#text', v: '{{to.' },
            { t: 'b', c: [{ t: '#text', v: 'last' }] },
            { t: '#text', v: 'Name}}様' },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    };

    const rendered = renderTemplate(t, { now: new Date(), locale: 'ja', to: { name: '鈴木 一郎' } });
    expect(rendered.text).toBe('鈴木様');
  });

  it('keeps a cursor mark in the AST only, stripped from html/text/chatText', () => {
    const t: Template = {
      id: '2',
      platform: 'gmail',
      name: 'Cursor',
      keyword: ';cur',
      tags: [],
      bodyHtml: '<p>Hi {{ cursor }}!</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Hi {{ cursor }}!' }] }],
      createdAt: 1,
      updatedAt: 1,
    };

    const rendered = renderTemplate(t, { now: new Date(), locale: 'ja' });
    expect(JSON.stringify(rendered.ast)).toContain(`Hi ${CURSOR_MARK}!`);
    expect(rendered.html).toBe('<p>Hi !</p>');
    expect(rendered.text).toBe('Hi !');
    expect(rendered.chatText).toBe('Hi !');
  });
});
