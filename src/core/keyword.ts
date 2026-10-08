import { KEYWORD_CHAR, type Template } from './types';

/**
 * Extracts trailing continuous keyword characters from text preceding the caret.
 * Returns null if the trailing sequence is empty or invalid.
 */
export function extractTrailingToken(textBeforeCaret: string): string | null {
  if (!textBeforeCaret || textBeforeCaret.length === 0) {
    return null;
  }

  let i = textBeforeCaret.length - 1;
  while (i >= 0) {
    const ch = textBeforeCaret[i];
    if (ch && KEYWORD_CHAR.test(ch)) {
      i--;
    } else {
      break;
    }
  }

  const token = textBeforeCaret.slice(i + 1);
  return token.length > 0 ? token : null;
}

/**
 * Finds a template whose keyword exactly matches the given token.
 * If multiple templates match, returns the one with the latest updatedAt timestamp.
 */
export function findTemplateByKeyword<T extends Template>(token: string, templates: T[]): T | null {
  if (!token || !templates || templates.length === 0) {
    return null;
  }

  let matched: T | null = null;
  for (const t of templates) {
    if (t.keyword === token) {
      if (!matched || t.updatedAt > matched.updatedAt) {
        matched = t;
      }
    }
  }

  return matched;
}
