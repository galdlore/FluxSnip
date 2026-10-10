import { beforeEach, describe, expect, it } from 'vitest';
import { astToDom, astToHtml } from './html/ast';
import { renderTemplate } from './engine';
import { insertContent } from './inserter';
import { readRecipients } from '@/adapters/gmail/recipients';
import type { Template, TemplateVars } from './types';

describe('XSS and injection security guarantees', () => {
  let editor: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="editor" contenteditable="true"></div>';
    editor = document.getElementById('editor') as HTMLElement;
    editor.focus();

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(editor);
      sel.addRange(r);
    }
  });

  const template: Template = {
    id: 'sec-tpl',
    platform: 'gmail',
    name: 'Security Test',
    keyword: ';sec',
    tags: [],
    bodyHtml: '<p>Dear {{to.lastName}} ({{to.name}}), reply to {{to.email}}</p>',
    bodyAst: [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'Dear ' },
          { t: '#text', v: '{{to.lastName}}' },
          { t: '#text', v: ' (' },
          { t: '#text', v: '{{to.name}}' },
          { t: '#text', v: '), reply to ' },
          { t: '#text', v: '{{to.email}}' },
        ],
      },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('neutralizes <script> and <img> injection in recipient names without executing', async () => {
    // Malicious contact with XSS payloads in lastName, name, and email
    const maliciousVars: TemplateVars = {
      now: new Date(),
      locale: 'ja',
      to: {
        lastName: '<script>window.__xss_executed = true;</script>',
        name: '"><img src="x" onerror="window.__xss_img = true;">',
        email: 'attacker" onfocus="alert(1)@evil.com',
      },
    };

    (window as any).__xss_executed = false;
    (window as any).__xss_img = false;

    // 1. Render template
    const rendered = renderTemplate(template, maliciousVars);

    // 2. Verify HTML serialization escapes all dangerous characters
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).toContain('&lt;img');

    // 3. Verify DOM conversion produces pure Text nodes, not Element nodes
    const domFrag = astToDom(rendered.ast, document);
    const scripts = domFrag.querySelectorAll('script');
    const images = domFrag.querySelectorAll('img');
    expect(scripts).toHaveLength(0);
    expect(images).toHaveLength(0);

    // 4. Insert into contenteditable editor
    const insertRes = await insertContent(editor, rendered, ['dom'], false);
    expect(insertRes.ok).toBe(true);

    // Check editor DOM
    expect(editor.querySelectorAll('script')).toHaveLength(0);
    expect(editor.querySelectorAll('img')).toHaveLength(0);
    expect((window as any).__xss_executed).toBe(false);
    expect((window as any).__xss_img).toBe(false);

    // Visible text contains the raw text safely without execution
    expect(editor.textContent).toContain('<script>');
    expect(editor.textContent).toContain('"><img');
  });

  it('prevents javascript: URLs in template body links when variables are injected into href', () => {
    const linkTemplate: Template = {
      id: 'link-tpl',
      platform: 'gmail',
      name: 'Link Test',
      keyword: ';link',
      tags: [],
      bodyHtml: '<p><a href="{{to.email}}">Contact</a></p>',
      bodyAst: [
        {
          t: 'p',
          c: [
            {
              t: 'a',
              a: { href: 'javascript:alert("pwned")' },
              c: [{ t: '#text', v: 'Contact' }],
            },
          ],
        },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    };

    const rendered = renderTemplate(linkTemplate, { now: new Date(), locale: 'ja' });
    const domFrag = astToDom(rendered.ast, document);
    const anchor = domFrag.querySelector('a');

    // astToDom drops javascript: href
    expect(anchor?.getAttribute('href')).toBeNull();
  });

  it('safely extracts contact names when chip contains malicious markup', () => {
    const root = document.createElement('div');
    root.className = 'M9';
    root.innerHTML = `
      <div class="wO nr">
        <div name="to" class="anm">
          <div role="option" class="afV" data-hovercard-id="victim@example.com" data-name="<script>alert('bad')</script>田中">
            <div class="afZ af1">
              <div class="akl">&lt;script&gt;alert('bad')&lt;/script&gt;田中</div>
            </div>
          </div>
          <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
        </div>
      </div>
    `;

    const recipients = readRecipients(root, 'to');
    expect(recipients).toHaveLength(1);
    expect(recipients[0]?.email).toBe('victim@example.com');
    // Name is extracted as pure text string, never executed
    expect(recipients[0]?.name).toBe("<script>alert</script>田中");
  });
});
