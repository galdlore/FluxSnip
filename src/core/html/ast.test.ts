import { describe, expect, it } from 'vitest';
import {
  astToChatHtml,
  astToChatText,
  astToDom,
  astToHtml,
  astToPlainText,
  joinSplitPlaceholders,
} from './ast';
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

  it('ensures word-boundary space around underscore italics when adjacent to CJK or alphanumeric text', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        c: [
          { t: '#text', v: '書体テスト' },
          { t: 'i', c: [{ t: '#text', v: 'を実施' }] },
          { t: '#text', v: 'いたします' },
        ],
      },
    ];

    const chatText = astToChatText(ast);
    expect(chatText).toBe('書体テスト _を実施_ いたします');
  });

  it('keeps literal underscores in snake_case and URLs intact', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'see file_name_here and https://ex.com/a_b_c and ' },
          { t: 'em', c: [{ t: '#text', v: 'real' }] },
          { t: '#text', v: '!' },
        ],
      },
    ];

    expect(astToChatText(ast)).toBe('see file_name_here and https://ex.com/a_b_c and _real_ !');
  });

  it('joins placeholders split across formatting into the first text node', () => {
    const ast: AstNode[] = [
      {
        t: 'p',
        c: [
          { t: '#text', v: 'Dear {{to.' },
          { t: 'b', c: [{ t: '#text', v: 'last' }] },
          { t: '#text', v: 'Name}} and {{date}}' },
        ],
      },
    ];

    expect(astToHtml(joinSplitPlaceholders(ast))).toBe('<p>Dear {{to.lastName}}<b></b> and {{date}}</p>');
    // Input is not mutated
    expect(astToHtml(ast)).toBe('<p>Dear {{to.<b>last</b>Name}} and {{date}}</p>');
  });

  it('does not join braces across block boundaries', () => {
    const ast: AstNode[] = [
      { t: 'p', c: [{ t: '#text', v: 'open {{' }] },
      { t: 'p', c: [{ t: '#text', v: 'date}} close' }] },
    ];

    expect(astToHtml(joinSplitPlaceholders(ast))).toBe(astToHtml(ast));
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

  describe('astToChatHtml', () => {
    it('converts <ol> into numbered <div> blocks while preserving inline styling', () => {
      const ast: AstNode[] = [
        {
          t: 'ol',
          c: [
            {
              t: 'li',
              c: [
                { t: '#text', v: 'First ' },
                { t: 'strong', c: [{ t: '#text', v: 'important' }] },
                { t: '#text', v: ' item' },
              ],
            },
            {
              t: 'li',
              c: [
                {
                  t: 'span',
                  a: { style: 'color: #dc2626' },
                  c: [{ t: '#text', v: 'Second colored item' }],
                },
              ],
            },
          ],
        },
      ];

      const html = astToChatHtml(ast);
      expect(html).toBe(
        '<div>1. First <strong>important</strong> item</div><div>2. <span style="color: #dc2626">Second colored item</span></div>'
      );
    });

    it('keeps native <ul> and <li> for bullet lists', () => {
      const ast: AstNode[] = [
        {
          t: 'ul',
          c: [
            { t: 'li', c: [{ t: '#text', v: 'Alpha' }] },
            { t: 'li', c: [{ t: '#text', v: 'Beta' }] },
          ],
        },
      ];

      const html = astToChatHtml(ast);
      expect(html).toBe('<ul><li>Alpha</li><li>Beta</li></ul>');
    });

    it('unwraps block tags (p, div) inside <li> so prefix and text stay on one line', () => {
      const ast: AstNode[] = [
        {
          t: 'ol',
          c: [
            {
              t: 'li',
              c: [
                {
                  t: 'p',
                  c: [{ t: '#text', v: 'Paragraph item' }],
                },
              ],
            },
          ],
        },
      ];

      const html = astToChatHtml(ast);
      expect(html).toBe('<div>1. Paragraph item</div>');
    });

    it('flattens nested <ol> with non-breaking space indentation', () => {
      const ast: AstNode[] = [
        {
          t: 'ol',
          c: [
            {
              t: 'li',
              c: [
                { t: '#text', v: 'Parent 1' },
                {
                  t: 'ol',
                  c: [
                    { t: 'li', c: [{ t: '#text', v: 'Child 1.1' }] },
                    { t: 'li', c: [{ t: '#text', v: 'Child 1.2' }] },
                  ],
                },
              ],
            },
            {
              t: 'li',
              c: [{ t: '#text', v: 'Parent 2' }],
            },
          ],
        },
      ];

      const html = astToChatHtml(ast);
      expect(html).toBe(
        '<div>1. Parent 1</div><div>&nbsp;&nbsp;1. Child 1.1</div><div>&nbsp;&nbsp;2. Child 1.2</div><div>2. Parent 2</div>'
      );
    });

    it('converts <hr> and headings to Chat-compatible representations', () => {
      const ast: AstNode[] = [
        { t: 'h2', c: [{ t: '#text', v: 'Section Title' }] },
        { t: 'hr' },
        { t: 'p', c: [{ t: '#text', v: 'Content' }] },
      ];

      const html = astToChatHtml(ast);
      expect(html).toBe('<div><b>Section Title</b></div><div>---</div><p>Content</p>');
    });

    it('indents nested <ol> properly in astToChatText as well', () => {
      const ast: AstNode[] = [
        {
          t: 'ol',
          c: [
            {
              t: 'li',
              c: [
                { t: '#text', v: 'Parent 1' },
                {
                  t: 'ol',
                  c: [
                    { t: 'li', c: [{ t: '#text', v: 'Child 1.1' }] },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const text = astToChatText(ast);
      expect(text).toContain('1. Parent 1');
      expect(text).toContain('  1. Child 1.1');
    });
  });
});
