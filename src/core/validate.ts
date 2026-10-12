import {
  KEYWORD_PATTERN,
  MAX_BODY_HTML_BYTES,
  type GmailTemplate,
  type Platform,
  type Template,
} from './types';

export interface ValidationIssue {
  field: string;
  messageKey: string;
}

/**
 * Practical email syntax check.
 */
export function isValidEmail(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length > 254) return false;
  // Standard pragmatic email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Parses a comma, semicolon, newline, or whitespace delimited string of emails into a unique array.
 */
export function parseEmailList(s: string): string[] {
  if (!s || typeof s !== 'string') return [];
  const rawList = s.split(/[,;\r\n\s]+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawList) {
    const trimmed = item.trim();
    if (trimmed.length > 0) {
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
  }

  return result;
}

/**
 * Creates a blank new template for the specified platform.
 */
export function newTemplate(platform: Platform): Template {
  const now = Date.now();
  const base = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${now}-${Math.random().toString(36).slice(2)}`,
    platform,
    name: '',
    keyword: '',
    tags: [] as string[],
    bodyHtml: '',
    bodyAst: [],
    createdAt: now,
    updatedAt: now,
  };

  if (platform === 'gmail') {
    const gmailTpl: GmailTemplate = {
      ...base,
      platform: 'gmail',
    };
    return gmailTpl;
  }

  return base as Template;
}

/**
 * Validates a template against schema and uniqueness within its platform.
 */
export function validateTemplate(t: Template, others: Template[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Name check
  if (!t.name || !t.name.trim()) {
    issues.push({ field: 'name', messageKey: 'validate_name_required' });
  } else if (t.name.length > 100) {
    issues.push({ field: 'name', messageKey: 'validate_name_too_long' });
  }

  // Keyword check
  if (!t.keyword || !t.keyword.trim()) {
    issues.push({ field: 'keyword', messageKey: 'validate_keyword_required' });
  } else if (!KEYWORD_PATTERN.test(t.keyword)) {
    issues.push({ field: 'keyword', messageKey: 'validate_keyword_invalid' });
  } else {
    // Check duplicates among other templates on the same platform
    const duplicate = others.some(
      (o) => o.id !== t.id && o.platform === t.platform && o.keyword === t.keyword
    );
    if (duplicate) {
      issues.push({ field: 'keyword', messageKey: 'validate_keyword_duplicate' });
    }
  }

  // Body HTML size check
  const byteLength = new TextEncoder().encode(t.bodyHtml || '').length;
  if (byteLength > MAX_BODY_HTML_BYTES) {
    issues.push({ field: 'bodyHtml', messageKey: 'validate_body_too_large' });
  }

  // Gmail specific fields
  if (t.platform === 'gmail') {
    const g = t as GmailTemplate;
    if (g.from && !isValidEmail(g.from)) {
      issues.push({ field: 'from', messageKey: 'validate_from_invalid' });
    }

    const checkRecipients = (field: 'to' | 'cc' | 'bcc', list?: string[]) => {
      if (list && list.length > 0) {
        for (const email of list) {
          if (!isValidEmail(email)) {
            issues.push({ field, messageKey: `validate_${field}_invalid` });
            break;
          }
        }
      }
    };

    checkRecipients('to', g.to?.emails);
    checkRecipients('cc', g.cc?.emails);
    checkRecipients('bcc', g.bcc?.emails);
  }

  return issues;
}
