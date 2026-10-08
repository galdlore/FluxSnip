import type { AstElement, AstNode, AstText } from '../types';
import { astToHtml } from './ast';

// Tags to discard entirely along with all their children
const DISCARD_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'object', 'embed', 'noscript',
  'template', 'svg', 'math', 'head', 'title', 'meta', 'link', 'base',
  'form', 'input', 'button', 'select', 'textarea', 'option',
]);

// Allowed tags to keep
const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'del', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr',
  'th', 'td', 'caption', 'colgroup', 'col', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'blockquote', 'pre', 'code', 'hr', 'img', 'font', 'sub', 'sup',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'font-weight', 'font-style', 'text-decoration',
  'font-size', 'font-family', 'text-align', 'vertical-align', 'white-space',
  'width', 'height', 'border', 'border-collapse', 'border-top', 'border-right',
  'border-bottom', 'border-left', 'border-color', 'border-style', 'border-width',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
]);

const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

function sanitizeStyle(cssText: string): string {
  if (!cssText) return '';
  const declarations = cssText.split(';');
  const safeDecs: string[] = [];

  for (const dec of declarations) {
    const colonIndex = dec.indexOf(':');
    if (colonIndex === -1) continue;
    const prop = dec.slice(0, colonIndex).trim().toLowerCase();
    const val = dec.slice(colonIndex + 1).trim();

    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;

    // Check for dangerous patterns in style value
    const lowerVal = val.toLowerCase();
    if (
      lowerVal.includes('url(') ||
      lowerVal.includes('expression') ||
      lowerVal.includes('javascript:') ||
      lowerVal.includes('@import') ||
      lowerVal.includes('\\')
    ) {
      continue;
    }

    safeDecs.push(`${prop}:${val}`);
  }

  return safeDecs.join(';');
}

function sanitizeAttributes(tag: string, el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i);
    if (!attr) continue;
    const name = attr.name.toLowerCase();
    const val = attr.value;

    if (name.startsWith('on')) continue;

    // Global allowed attributes
    if (name === 'align' || name === 'dir') {
      attrs[name] = val;
      continue;
    }

    if (name === 'style') {
      const safeStyle = sanitizeStyle(val);
      if (safeStyle) {
        attrs.style = safeStyle;
      }
      continue;
    }

    // Tag specific attributes
    if (tag === 'a') {
      if (name === 'title') {
        attrs[name] = val;
      } else if (name === 'href') {
        const lowerVal = val.trim().toLowerCase();
        if (ALLOWED_URL_SCHEMES.some((scheme) => lowerVal.startsWith(scheme))) {
          attrs.href = val.trim();
        }
      }
    } else if (tag === 'img') {
      if (name === 'alt' || name === 'width' || name === 'height') {
        attrs[name] = val;
      } else if (name === 'src') {
        const trimmed = val.trim();
        const lowerVal = trimmed.toLowerCase();
        const isSafeImg =
          lowerVal.startsWith('https:') ||
          /^data:image\/(png|jpeg|gif|webp);base64,/i.test(trimmed);
        if (isSafeImg) {
          attrs.src = trimmed;
        }
      }
    } else if (tag === 'td' || tag === 'th') {
      if (['colspan', 'rowspan', 'width', 'height', 'valign'].includes(name)) {
        attrs[name] = val;
      }
    } else if (tag === 'table') {
      if (['border', 'cellpadding', 'cellspacing', 'width'].includes(name)) {
        attrs[name] = val;
      }
    } else if (tag === 'col' || tag === 'colgroup') {
      if (name === 'span' || name === 'width') {
        attrs[name] = val;
      }
    } else if (tag === 'font') {
      if (name === 'color' || name === 'face' || name === 'size') {
        attrs[name] = val;
      }
    }
  }

  return attrs;
}

function processNode(node: Node): AstNode[] {
  if (node.nodeType === 3) {
    // Text node
    const text = node.nodeValue || '';
    if (!text) return [];
    return [{ t: '#text', v: text } as AstText];
  }

  if (node.nodeType === 1) {
    // Element node
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Discard entire subtree
    if (DISCARD_TAGS.has(tag)) {
      return [];
    }

    // Collect sanitized children
    const children: AstNode[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes.item(i);
      if (child) {
        children.push(...processNode(child));
      }
    }

    // Allowed tag
    if (ALLOWED_TAGS.has(tag)) {
      const a = sanitizeAttributes(tag, el);
      const elementNode: AstElement = {
        t: tag,
        ...(Object.keys(a).length > 0 ? { a } : {}),
        ...(children.length > 0 ? { c: children } : {}),
      };
      return [elementNode];
    }

    // Unknown or unallowed tag: unwrap (remove tag, keep children)
    return children;
  }

  // Comment or other node types: drop
  return [];
}

/**
 * Sanitizes an HTML string using DOMParser and converts it into a safe AST.
 * (Options page and test only. Do not import in content scripts)
 */
export function sanitizeHtmlToAst(html: string): AstNode[] {
  if (!html || typeof html !== 'string') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const ast: AstNode[] = [];
  const body = doc.body;
  if (!body) return [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes.item(i);
    if (child) {
      ast.push(...processNode(child));
    }
  }

  return ast;
}

/**
 * Sanitizes HTML and returns both canonical serialized HTML and AST.
 */
export function sanitizeHtml(html: string): { html: string; ast: AstNode[] } {
  const ast = sanitizeHtmlToAst(html);
  return {
    html: astToHtml(ast),
    ast,
  };
}
