import type { PlatformAdapter } from './adapter';
import { extractTrailingToken, findTemplateByKeyword } from './keyword';
import type { Template } from './types';

/**
 * Finds the rightmost descendant Text node within node, up to a certain child offset if node is an Element.
 */
function findPrecedingTextNode(container: Node, offset: number): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) {
    return { node: container as Text, offset };
  }

  // If container is an Element, inspect childNodes up to offset
  const child = offset > 0 ? container.childNodes[offset - 1] : container.firstChild;
  if (!child) return null;

  return findDeepestRightmostTextNode(child);
}

function findDeepestRightmostTextNode(node: Node): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    return { node: textNode, offset: textNode.data.length };
  }

  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i];
    if (child) {
      const res = findDeepestRightmostTextNode(child);
      if (res) return res;
    }
  }

  return null;
}

/**
 * Checks if the caret is preceded by a valid template keyword upon Tab press.
 * Returns the Range spanning the keyword token if matched, or null if no expansion applies.
 */
export function tryExpand(
  e: KeyboardEvent,
  adapter: PlatformAdapter,
  editor: HTMLElement,
  templates: Template[]
): Range | null {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) {
    return null;
  }

  const range = sel.getRangeAt(0);
  let textNode: Text | null = null;
  let caretOffset = 0;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    textNode = range.startContainer as Text;
    caretOffset = range.startOffset;
  } else {
    const preceding = findPrecedingTextNode(range.startContainer, range.startOffset);
    if (preceding) {
      textNode = preceding.node;
      caretOffset = preceding.offset;
    }
  }

  if (!textNode || !editor.contains(textNode)) {
    return null;
  }

  const textBefore = textNode.data.slice(0, caretOffset);
  const token = extractTrailingToken(textBefore);
  if (!token) {
    return null;
  }

  const matched = findTemplateByKeyword(token, templates);
  if (!matched) {
    return null;
  }

  // Construct Range covering the token
  try {
    const tokenRange = document.createRange();
    const startOffset = caretOffset - token.length;
    tokenRange.setStart(textNode, startOffset);
    tokenRange.setEnd(textNode, caretOffset);
    return tokenRange;
  } catch {
    return null;
  }
}
