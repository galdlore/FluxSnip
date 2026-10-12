import { describe, expect, it } from 'vitest';
import { sanitizeHtml, sanitizeHtmlToAst } from './sanitize';
import { astToHtml } from './ast';

describe('sanitizeHtml', () => {
  it('removes <script> tags and contents entirely', () => {
    const raw = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('script');
    expect(html).not.toContain('alert');
    expect(html).toBe('<p>Hello</p><p>World</p>');
  });

  it('removes onclick and other inline event attributes', () => {
    const raw = '<button onclick="alert(1)">Click</button><p onclick="bad()">Text</p>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('button'); // button is also discarded
    expect(html).toBe('<p>Text</p>');
  });

  it('removes javascript: scheme from href', () => {
    const raw = '<a href="javascript:alert(1)">Click me</a><a href="https://example.com">Safe</a>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a>Click me</a>');
    expect(html).toContain('<a href="https://example.com">Safe</a>');
  });

  it('allows data:image/png and rejects data:text/html in img src', () => {
    const raw = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" alt="test"><img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="bad">';
    const { html } = sanitizeHtml(raw);
    expect(html).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(html).not.toContain('data:text/html');
  });

  it('unwraps unknown tags keeping children intact', () => {
    const raw = '<o:p><span>Excel converted text</span></o:p>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('o:p');
    expect(html).toContain('<span>Excel converted text</span>');
  });

  it('retains only allowed styles from Excel table pasted HTML', () => {
    const raw = '<table><tr><td style="mso-font-family: Calibri; color: red; font-weight: bold;">Cell</td></tr></table>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('mso-font-family');
    expect(html).toContain('color:red');
    expect(html).toContain('font-weight:bold');
  });

  it('removes url() patterns in style values', () => {
    const raw = '<div style="background-color: url(\'https://evil.com\'); color: blue;">Content</div>';
    const { html } = sanitizeHtml(raw);
    expect(html).not.toContain('url(');
    expect(html).toContain('color:blue');
  });
});
