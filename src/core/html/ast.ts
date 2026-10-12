import type { AstElement, AstNode, AstText } from '../types';

export function isAstText(node: AstNode): node is AstText {
  return node.t === '#text';
}

export function isAstElement(node: AstNode): node is AstElement {
  return node.t !== '#text';
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);
const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'table', 'tr', 'li', 'ul', 'ol', 'hr',
]);

const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/**
 * Serializes AST nodes to sanitized HTML string without DOM APIs.
 */
export function astToHtml(nodes: AstNode[]): string {
  let out = '';
  for (const node of nodes) {
    if (isAstText(node)) {
      out += escapeHtml(node.v);
    } else {
      const tag = node.t.toLowerCase();
      out += `<${tag}`;
      if (node.a) {
        for (const [k, v] of Object.entries(node.a)) {
          out += ` ${k.toLowerCase()}="${escapeAttr(String(v))}"`;
        }
      }
      if (VOID_TAGS.has(tag)) {
        out += '>';
      } else {
        out += '>';
        if (node.c && node.c.length > 0) {
          out += astToHtml(node.c);
        }
        out += `</${tag}>`;
      }
    }
  }
  return out;
}

/**
 * Recursively maps text node contents across an AST.
 */
export function mapAstText(nodes: AstNode[], fn: (s: string) => string): AstNode[] {
  return nodes.map((node): AstNode => {
    if (isAstText(node)) {
      return { t: '#text', v: fn(node.v) };
    }
    const elem: AstElement = {
      t: node.t,
      ...(node.a ? { a: { ...node.a } } : {}),
      ...(node.c ? { c: mapAstText(node.c, fn) } : {}),
    };
    return elem;
  });
}

const PLACEHOLDER_BOUNDARY_TAGS = new Set([...BLOCK_TAGS, 'td', 'th', 'br']);
const PLACEHOLDER_REGEX = /\{\{[^{}\n]{1,80}\}\}/g;

/**
 * Returns a copy of the AST where every {{...}} placeholder split across several text nodes
 * (e.g. `{{to.` bold and `name}}` plain) is moved whole into its first text node, so that
 * per-text-node variable expansion can see it. Placeholders never span block boundaries.
 */
export function joinSplitPlaceholders(nodes: AstNode[]): AstNode[] {
  const copy = mapAstText(nodes, (s) => s);
  const texts: Array<{ node: AstText; start: number }> = [];
  let joined = '';

  const walk = (list: AstNode[]) => {
    for (const n of list) {
      if (isAstText(n)) {
        texts.push({ node: n, start: joined.length });
        joined += n.v;
        continue;
      }
      const boundary = PLACEHOLDER_BOUNDARY_TAGS.has(n.t.toLowerCase());
      if (boundary) joined += '\n';
      if (n.c) walk(n.c);
      if (boundary) joined += '\n';
    }
  };
  walk(copy);

  const matches = Array.from(joined.matchAll(PLACEHOLDER_REGEX), (m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    text: m[0],
  }));
  if (matches.length === 0) return copy;

  for (const { node, start } of texts) {
    const end = start + node.v.length;
    let out = '';
    let g = start;
    while (g < end) {
      const m = matches.find((mm) => mm.start <= g && g < mm.end);
      if (!m) {
        out += joined[g];
        g++;
        continue;
      }
      if (g === m.start) out += m.text;
      g = Math.min(m.end, end);
    }
    node.v = out;
  }

  return copy;
}

interface PlainTextContext {
  listStack: Array<{ type: 'ul' | 'ol'; index: number }>;
}

function renderNodeToPlainText(node: AstNode, ctx: PlainTextContext): string {
  if (isAstText(node)) {
    return node.v;
  }

  const tag = node.t.toLowerCase();
  if (tag === 'br') {
    return '\n';
  }
  if (tag === 'hr') {
    return '\n---\n';
  }

  if (tag === 'ul' || tag === 'ol') {
    ctx.listStack.push({ type: tag, index: 1 });
    let content = '';
    if (node.c) {
      for (const child of node.c) {
        content += renderNodeToPlainText(child, ctx);
      }
    }
    ctx.listStack.pop();
    return `\n${content}\n`;
  }

  if (tag === 'li') {
    const currentList = ctx.listStack[ctx.listStack.length - 1];
    let prefix = '• ';
    if (currentList && currentList.type === 'ol') {
      prefix = `${currentList.index++}. `;
    }
    let childContent = '';
    if (node.c) {
      for (const child of node.c) {
        childContent += renderNodeToPlainText(child, ctx);
      }
    }
    return `\n${prefix}${childContent.trimStart()}`;
  }

  if (tag === 'tr') {
    const cells: string[] = [];
    if (node.c) {
      for (const child of node.c) {
        if (isAstElement(child) && (child.t.toLowerCase() === 'td' || child.t.toLowerCase() === 'th')) {
          cells.push(renderNodeToPlainText(child, ctx).trim());
        }
      }
    }
    return `\n${cells.join('\t')}`;
  }

  if (tag === 'a') {
    let text = '';
    if (node.c) {
      for (const child of node.c) {
        text += renderNodeToPlainText(child, ctx);
      }
    }
    const href = node.a?.href;
    if (href && href !== text && text.trim().length > 0) {
      return `${text} (${href})`;
    }
    return text || href || '';
  }

  let childrenText = '';
  if (node.c) {
    for (const child of node.c) {
      childrenText += renderNodeToPlainText(child, ctx);
    }
  }

  if (BLOCK_TAGS.has(tag)) {
    return `\n${childrenText}\n`;
  }

  return childrenText;
}

/**
 * Converts AST to human-readable plain text.
 */
export function astToPlainText(nodes: AstNode[]): string {
  const ctx: PlainTextContext = { listStack: [] };
  let raw = '';
  for (const node of nodes) {
    raw += renderNodeToPlainText(node, ctx);
  }
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wraps text in markdown marker, placing outer whitespaces outside the marker.
 */
function wrapMarker(text: string, marker: string, closeMarker: string = marker): string {
  if (!text || text.trim().length === 0) {
    return text;
  }
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return `${marker}${text}${closeMarker}`;
  const [, leading, content, trailing] = match;
  return `${leading}${marker}${content}${closeMarker}${trailing}`;
}

// Private-use placeholders for italic markers, so boundary spacing only touches real <i>/<em>
// and never literal underscores in text (snake_case, URLs).
const ITALIC_OPEN = '\uE000';
const ITALIC_CLOSE = '\uE001';

function renderNodeToChatText(node: AstNode, ctx: PlainTextContext): string {
  if (isAstText(node)) {
    return node.v;
  }

  const tag = node.t.toLowerCase();

  // Formatting markers
  if (tag === 'b' || tag === 'strong') {
    const inner = (node.c || []).map((child: AstNode) => renderNodeToChatText(child, ctx)).join('');
    return wrapMarker(inner, '*');
  }
  if (tag === 'i' || tag === 'em') {
    const inner = (node.c || []).map((child: AstNode) => renderNodeToChatText(child, ctx)).join('');
    return wrapMarker(inner, ITALIC_OPEN, ITALIC_CLOSE);
  }
  if (tag === 's' || tag === 'strike' || tag === 'del') {
    const inner = (node.c || []).map((child: AstNode) => renderNodeToChatText(child, ctx)).join('');
    return wrapMarker(inner, '~');
  }
  if (tag === 'code') {
    const inner = (node.c || []).map((child: AstNode) => renderNodeToChatText(child, ctx)).join('');
    return wrapMarker(inner, '`');
  }
  if (tag === 'pre') {
    const inner = (node.c || []).map((child: AstNode) => renderNodeToChatText(child, ctx)).join('');
    return `\n\`\`\`\n${inner.trim()}\n\`\`\`\n`;
  }

  if (tag === 'br') return '\n';
  if (tag === 'hr') return '\n---\n';

  if (tag === 'ul' || tag === 'ol') {
    ctx.listStack.push({ type: tag, index: 1 });
    let content = '';
    if (node.c) {
      for (const child of node.c) {
        content += renderNodeToChatText(child, ctx);
      }
    }
    ctx.listStack.pop();
    return `\n${content}\n`;
  }

  if (tag === 'li') {
    const currentList = ctx.listStack[ctx.listStack.length - 1];
    let prefix = '• ';
    if (currentList && currentList.type === 'ol') {
      const olDepth = ctx.listStack.filter((l) => l.type === 'ol').length;
      const indent = olDepth > 1 ? '  '.repeat(olDepth - 1) : '';
      prefix = `${indent}${currentList.index++}. `;
    }
    let childContent = '';
    if (node.c) {
      for (const child of node.c) {
        childContent += renderNodeToChatText(child, ctx);
      }
    }
    return `\n${prefix}${childContent.trimStart()}`;
  }

  if (tag === 'tr') {
    const cells: string[] = [];
    if (node.c) {
      for (const child of node.c) {
        if (isAstElement(child) && (child.t.toLowerCase() === 'td' || child.t.toLowerCase() === 'th')) {
          cells.push(renderNodeToChatText(child, ctx).trim());
        }
      }
    }
    return `\n${cells.join('\t')}`;
  }

  if (tag === 'a') {
    let text = '';
    if (node.c) {
      for (const child of node.c) {
        text += renderNodeToChatText(child, ctx);
      }
    }
    const href = node.a?.href;
    if (href && href !== text && text.trim().length > 0) {
      return `${text} (${href})`;
    }
    return text || href || '';
  }

  let childrenText = '';
  if (node.c) {
    for (const child of node.c) {
      childrenText += renderNodeToChatText(child, ctx);
    }
  }

  if (BLOCK_TAGS.has(tag)) {
    return `\n${childrenText}\n`;
  }

  return childrenText;
}

/**
 * Converts AST to Google Chat formatted plain text.
 */
export function astToChatText(nodes: AstNode[]): string {
  const ctx: PlainTextContext = { listStack: [] };
  let raw = '';
  for (const node of nodes) {
    raw += renderNodeToChatText(node, ctx);
  }
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Google Chat only renders '_' italics on word boundaries
    .replace(/([^\s*_~`\uE000\uE001])\uE000/g, `$1 ${ITALIC_OPEN}`)
    .replace(/\uE001([^\s*_~`\uE000\uE001])/g, `${ITALIC_CLOSE} $1`)
    .replace(/[\uE000\uE001]/g, '_')
    .trim();
}

interface ChatHtmlContext {
  listStack: Array<{ type: 'ul' | 'ol'; index: number }>;
}

function renderNodeToChatHtml(node: AstNode, ctx: ChatHtmlContext): string {
  if (isAstText(node)) {
    return escapeHtml(node.v);
  }

  const tag = node.t.toLowerCase();

  // 1. Ordered list: Google Chat does not natively support <ol>.
  // Instead of emitting <ol>, manage indices and let child <li> elements emit numbered blocks.
  if (tag === 'ol') {
    ctx.listStack.push({ type: 'ol', index: 1 });
    let content = '';
    if (node.c) {
      for (const child of node.c) {
        content += renderNodeToChatHtml(child, ctx);
      }
    }
    ctx.listStack.pop();
    return content;
  }

  // 2. Unordered list: Google Chat natively supports <ul> and <li>.
  if (tag === 'ul') {
    ctx.listStack.push({ type: 'ul', index: 1 });
    let content = '';
    if (node.c) {
      for (const child of node.c) {
        content += renderNodeToChatHtml(child, ctx);
      }
    }
    ctx.listStack.pop();
    return `<ul>${content}</ul>`;
  }

  // 3. List item
  if (tag === 'li') {
    const currentList = ctx.listStack[ctx.listStack.length - 1];
    if (currentList && currentList.type === 'ol') {
      const num = currentList.index++;
      const olDepth = ctx.listStack.filter((l) => l.type === 'ol').length;
      const indent = olDepth > 1 ? '&nbsp;&nbsp;'.repeat(olDepth - 1) : '';
      const prefix = `${indent}${num}. `;

      let inlineContent = '';
      let nestedListsContent = '';

      if (node.c) {
        for (const child of node.c) {
          if (isAstElement(child)) {
            const childTag = child.t.toLowerCase();
            if (childTag === 'ol' || childTag === 'ul') {
              nestedListsContent += renderNodeToChatHtml(child, ctx);
              continue;
            }
            if (childTag === 'p' || childTag === 'div') {
              if (child.c) {
                for (const grandChild of child.c) {
                  inlineContent += renderNodeToChatHtml(grandChild, ctx);
                }
              }
              continue;
            }
          }
          inlineContent += renderNodeToChatHtml(child, ctx);
        }
      }

      return `<div>${prefix}${inlineContent}</div>${nestedListsContent}`;
    }

    let childContent = '';
    if (node.c) {
      for (const child of node.c) {
        childContent += renderNodeToChatHtml(child, ctx);
      }
    }
    return `<li>${childContent}</li>`;
  }

  // 4. Horizontal line: Google Chat has no <hr> support, convert to text divider line
  if (tag === 'hr') {
    return '<div>---</div>';
  }

  // 5. Headings: Google Chat has no heading support, convert to bold line
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
    let inner = '';
    if (node.c) {
      for (const child of node.c) {
        inner += renderNodeToChatHtml(child, ctx);
      }
    }
    return `<div><b>${inner}</b></div>`;
  }

  // 6. Void tags
  if (VOID_TAGS.has(tag)) {
    let out = `<${tag}`;
    if (node.a) {
      for (const [k, v] of Object.entries(node.a)) {
        out += ` ${k.toLowerCase()}="${escapeAttr(String(v))}"`;
      }
    }
    return `${out}>`;
  }

  // 7. General elements
  let attrStr = '';
  if (node.a) {
    for (const [k, v] of Object.entries(node.a)) {
      const lowerK = k.toLowerCase();
      if (lowerK.startsWith('on')) continue;
      if (tag === 'a' && lowerK === 'href') {
        if (!isSafeUrl(String(v))) continue;
      }
      attrStr += ` ${lowerK}="${escapeAttr(String(v))}"`;
    }
  }

  let childrenHtml = '';
  if (node.c && node.c.length > 0) {
    for (const child of node.c) {
      childrenHtml += renderNodeToChatHtml(child, ctx);
    }
  }

  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

/**
 * Converts AST to Google Chat optimized HTML.
 * Preserves rich formatting while converting unsupported elements (<ol>, <hr>, headings)
 * into representations compatible with Google Chat's editor.
 */
export function astToChatHtml(nodes: AstNode[]): string {
  const ctx: ChatHtmlContext = { listStack: [] };
  let out = '';
  for (const node of nodes) {
    out += renderNodeToChatHtml(node, ctx);
  }
  return out;
}

function isSafeUrl(url: string): boolean {
  try {
    const trimmed = url.trim().toLowerCase();
    return ALLOWED_URL_SCHEMES.some((scheme) => trimmed.startsWith(scheme));
  } catch {
    return false;
  }
}

/**
 * Builds DOM DocumentFragment safely using createElement/createTextNode only.
 * Safe for content scripts (Trusted Types compliant).
 */
export function astToDom(nodes: AstNode[], doc: Document = typeof document !== 'undefined' ? document : ({} as Document)): DocumentFragment {
  const fragment = doc.createDocumentFragment();

  function buildNode(n: AstNode): Node | null {
    if (isAstText(n)) {
      return doc.createTextNode(n.v);
    }

    const tag = n.t.toLowerCase();
    const el = doc.createElement(tag);

    if (n.a) {
      for (const [key, val] of Object.entries(n.a)) {
        const lowerKey = key.toLowerCase();
        const strVal = String(val);
        if (lowerKey.startsWith('on')) {
          continue; // Guard against event handlers
        }
        if (tag === 'a' && lowerKey === 'href') {
          if (!isSafeUrl(strVal)) {
            continue;
          }
        }
        if (tag === 'img' && lowerKey === 'src') {
          const lowerVal = strVal.trim().toLowerCase();
          const isSafeImg = lowerVal.startsWith('https:') || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(strVal.trim());
          if (!isSafeImg) {
            continue;
          }
        }
        el.setAttribute(lowerKey, strVal);
      }
    }

    if (n.c && !VOID_TAGS.has(tag)) {
      for (const child of n.c) {
        const childNode = buildNode(child);
        if (childNode) {
          el.appendChild(childNode);
        }
      }
    }

    return el;
  }

  for (const node of nodes) {
    const built = buildNode(node);
    if (built) {
      fragment.appendChild(built);
    }
  }

  return fragment;
}
