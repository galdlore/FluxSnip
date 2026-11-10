import type { PlatformAdapter } from './adapter';
import { extractTrailingToken, findTemplateMatch } from './keyword';
import type { Template } from './types';

/**
 * Finds the rightmost descendant Text node within node, up to a certain child offset if node is an Element.
 */
function findPrecedingTextNode(container: Node, offset: number): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) {
    return { node: container as Text, offset };
  }

  // If container is an Element and offset is 0, caret is at the start of container; no preceding child exists
  if (offset <= 0) {
    return null;
  }

  const child = container.childNodes[offset - 1];
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

interface TextChunk {
  node: Text;
  startOffset: number;
  endOffset: number;
  text: string;
}

/**
 * Collects text chunks backwards from caret within the editor to support keywords
 * that span multiple Text nodes (e.g. Gmail spell check, IME split, or inline span tags).
 */
function collectPrecedingTextChunks(
  startNode: Text,
  caretOffset: number,
  editor: HTMLElement,
  maxChars = 64
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let remainingChars = maxChars;

  const curText = startNode.data.slice(0, caretOffset);
  chunks.push({
    node: startNode,
    startOffset: 0,
    endOffset: caretOffset,
    text: curText,
  });
  remainingChars -= curText.length;

  if (remainingChars <= 0) return chunks;

  const doc = editor.ownerDocument || document;
  const walker = doc.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  walker.currentNode = startNode;

  while (walker.previousNode() && remainingChars > 0) {
    const prev = walker.currentNode as Text;
    if (!editor.contains(prev)) break;
    const len = prev.data.length;
    if (len === 0) continue;

    chunks.unshift({
      node: prev,
      startOffset: 0,
      endOffset: len,
      text: prev.data,
    });
    remainingChars -= len;
  }

  return chunks;
}

/**
 * Resolves Range covering the given character length backwards from the caret.
 */
function createRangeForTrailingLength(
  chunks: TextChunk[],
  endNode: Text,
  endOffset: number,
  targetLength: number
): Range | null {
  const range = document.createRange();
  range.setEnd(endNode, endOffset);

  let remaining = targetLength;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i]!;
    const chunkLen = chunk.text.length;
    if (remaining <= chunkLen) {
      const startOffset = chunk.endOffset - remaining;
      range.setStart(chunk.node, startOffset);
      return range;
    }
    remaining -= chunkLen;
  }

  return null;
}

/**
 * Checks if the caret is preceded by a valid template keyword upon Tab press.
 * Returns the matched template and the Range spanning the keyword, or null if no expansion applies.
 */
export function tryExpand(
  e: KeyboardEvent,
  adapter: PlatformAdapter,
  editor: HTMLElement,
  templates: Template[]
): { template: Template; range: Range } | null {
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

  // Collect preceding text (including earlier Text nodes if needed)
  const chunks = collectPrecedingTextChunks(textNode, caretOffset, editor, 64);
  const fullTextBefore = chunks.map((c) => c.text).join('');
  const token = extractTrailingToken(fullTextBefore);
  if (!token) {
    return null;
  }

  const match = findTemplateMatch(token, templates);
  if (!match) {
    return null;
  }

  const tokenRange = createRangeForTrailingLength(
    chunks,
    textNode,
    caretOffset,
    match.matchedToken.length
  );

  if (!tokenRange) {
    return null;
  }

  return { template: match.template, range: tokenRange };
}
