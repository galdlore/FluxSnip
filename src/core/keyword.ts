import { KEYWORD_CHAR, type Template } from './types';

export interface KeywordMatchResult<T extends Template> {
  template: T;
  matchedToken: string;
}

/**
 * Extracts trailing continuous keyword characters from text preceding the caret.
 * Returns null if the trailing sequence is empty or invalid.
 */
export function extractTrailingToken(textBeforeCaret: string): string | null {
  if (!textBeforeCaret || textBeforeCaret.length === 0) {
    return null;
  }

  // Iterate backwards by Unicode code points to safely handle surrogate pairs
  const chars = Array.from(textBeforeCaret);
  let i = chars.length - 1;
  while (i >= 0) {
    const ch = chars[i];
    if (ch && KEYWORD_CHAR.test(ch)) {
      i--;
    } else {
      break;
    }
  }

  const token = chars.slice(i + 1).join('');
  return token.length > 0 ? token : null;
}

function normalizeSemi(s: string): string {
  return s.replace(/^[；;]/, ';');
}

/**
 * Finds a matching template and the matched token string.
 * Preference:
 * 1. Exact match (latest updatedAt)
 * 2. Embedded semicolon match (e.g. textBefore was "お疲れ様です;挨拶" -> subToken ";挨拶")
 * 3. Normalized semicolon match (half-width ';' <-> full-width '；')
 */
export function findTemplateMatch<T extends Template>(
  token: string,
  templates: T[]
): KeywordMatchResult<T> | null {
  if (!token || !templates || templates.length === 0) {
    return null;
  }

  // 1. Direct exact match
  let exactMatch: T | null = null;
  for (const t of templates) {
    if (t.keyword === token) {
      if (!exactMatch || t.updatedAt > exactMatch.updatedAt) {
        exactMatch = t;
      }
    }
  }
  if (exactMatch) {
    return { template: exactMatch, matchedToken: token };
  }

  // 2. Embedded semicolon match: if token contains ';' or '；' preceded by other characters
  const lastSemiIdx = Math.max(token.lastIndexOf(';'), token.lastIndexOf('；'));
  if (lastSemiIdx > 0) {
    const subToken = token.slice(lastSemiIdx);
    let subMatch: T | null = null;
    for (const t of templates) {
      if (t.keyword === subToken) {
        if (!subMatch || t.updatedAt > subMatch.updatedAt) {
          subMatch = t;
        }
      }
    }
    if (subMatch) {
      return { template: subMatch, matchedToken: subToken };
    }
  }

  // 3. Normalized semicolon match (full-width '；' <-> half-width ';')
  const normToken = normalizeSemi(token);
  let normMatch: T | null = null;
  for (const t of templates) {
    if (normalizeSemi(t.keyword) === normToken) {
      if (!normMatch || t.updatedAt > normMatch.updatedAt) {
        normMatch = t;
      }
    }
  }
  if (normMatch) {
    return { template: normMatch, matchedToken: token };
  }

  // 4. Normalized semicolon match on embedded subToken
  if (lastSemiIdx > 0) {
    const subToken = token.slice(lastSemiIdx);
    const normSub = normalizeSemi(subToken);
    let normSubMatch: T | null = null;
    for (const t of templates) {
      if (normalizeSemi(t.keyword) === normSub) {
        if (!normSubMatch || t.updatedAt > normSubMatch.updatedAt) {
          normSubMatch = t;
        }
      }
    }
    if (normSubMatch) {
      return { template: normSubMatch, matchedToken: subToken };
    }
  }

  return null;
}

/**
 * Finds a template whose keyword matches the given token.
 * If multiple templates match, returns the one with the latest updatedAt timestamp.
 */
export function findTemplateByKeyword<T extends Template>(token: string, templates: T[]): T | null {
  const res = findTemplateMatch(token, templates);
  return res ? res.template : null;
}
