import { describe, expect, it } from 'vitest';
import { astToChatText, astToDom, astToHtml, astToPlainText } from './ast';
import type { AstNode } from '../types';

describe('ast serializers', () => {
  it('escapes special characters in text and attributes in astToHtml', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        a: { title: 'Tom & "Jerry"' },
        c: [{ t: '#text', v: '1 < 2 && 4 > 3' }],
      },
    ];
    const html = astToHtml(ast);
    expect(html).toBe('<p title="Tom &amp; &quot;Jerry&quot;">1 &lt; 2 &amp;&amp; 4 &gt; 3</p>');
  });

  it('renders void elements without closing tags', () => {
    const ast: AstNode[] = [
      { t: 'p', c: [{ t: '#text', v: 'First line' }, { t: 'br' }, { t: '#text', v: 'Second line' }] },
      { t: 'hr' },
      { t: 'img', a: { src: 'https://example.com/logo.png', alt: 'logo' } },
    ];
    const html = astToHtml(ast);
    expect(html).toBe('<p>First line<br>Second line</p><hr><img src="https://example.com/logo.png" alt="logo">');
  });

  it('converts lists, tables, and links to plain text properly', () => {
    const ast: AstNode[] = [
      {
        t: 'ul',
        c: [
          { t: 'li', c: [{ t: '#text', v: 'Apple' }] },
          { t: 'li', c: [{ t: '#text', v: 'Banana' }] },
        ],
      },
      {
        t: 'table',
        c: [
          {
            t: 'tr',
            c: [
              { t: 'th', c: [{ t: '#text', v: 'Item' }] },
              { t: 'th', c: [{ t: '#text', v: 'Price' }] },
            ],
          },
          {
            t: 'tr',
            c: [
              { t: 'td', c: [{ t: '#text', v: 'Tea' }] },
              { t: 'td', c: [{ t: '#text', v: '$2' }] },
            ],
          },
        ],
      },
      {
        t: 'p',
        c: [
          {
            t: 'a',
            a: { href: 'https://example.com' },
            c: [{ t: '#text', v: 'Visit Website' }],
          },
        ],
      },
    ];

    const text = astToPlainText(ast);
    expect(text).toContain('• Apple');
    expect(text).toContain('• Banana');
    expect(text).toContain('Item\tPrice');
    expect(text).toContain('Tea\t$2');
    expect(text).toContain('Visit Website (https://example.com)');
  });

  it('converts formatting tags to Google Chat markdown and moves whitespace outside markers', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'Prefix' },
          { t: 'strong', c: [{ t: '#text', v: '  Bold text  ' }] },
          { t: '#text', v: ' and ' },
          { t: 'em', c: [{ t: '#text', v: 'Italic' }] },
          { t: '#text', v: ' and ' },
          { t: 's', c: [{ t: '#text', v: 'Deleted' }] },
          { t: '#text', v: ' and ' },
          { t: 'code', c: [{ t: '#text', v: 'inlineCode' }] },
        ],
      },
      {
        t: 'pre',
        c: [{ t: '#text', v: 'console.log("hi");' }],
      },
    ];

    const chatText = astToChatText(ast);
    expect(chatText).toContain('Prefix  *Bold text*   and _Italic_ and ~Deleted~ and `inlineCode`');
    expect(chatText).toContain('```\nconsole.log("hi");\n```');
  });

  it('astToDom safely creates DOM nodes without innerHTML and drops unsafe href', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        c: [
          {
            t: 'a',
            a: { href: 'javascript:alert(1)' },
            c: [{ t: '#text', v: 'Dangerous Link' }],
          },
          {
            t: 'a',
            a: { href: 'https://example.com' },
            c: [{ t: '#text', v: 'Safe Link' }],
          },
        ],
      },
    ];

    const frag = astToDom(ast, document);
    const div = document.createElement('div');
    div.appendChild(frag);

    const links = div.querySelectorAll('a');
    expect(links.length).toBe(2);
    const firstLink = links[0];
    const secondLink = links[1];
    expect(firstLink?.hasAttribute('href')).toBe(false);
    expect(secondLink?.getAttribute('href')).toBe('https://example.com');
  });
});
