import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  newTemplate,
  parseEmailList,
  validateTemplate,
} from './validate';
import type { GmailTemplate, Template } from './types';

describe('isValidEmail & parseEmailList', () => {
  it('validates common email syntax correctly', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.co.jp')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('parses separated email string with deduplication', () => {
    const raw = 'a@test.com, b@test.com;\nc@test.com a@test.com';
    const list = parseEmailList(raw);
    expect(list).toEqual(['a@test.com', 'b@test.com', 'c@test.com']);
  });
});

describe('validateTemplate', () => {
  it('validates required fields and reports issues', () => {
    const t = newTemplate('gmail') as GmailTemplate;
    const issues = validateTemplate(t, []);
    expect(issues.some((i) => i.field === 'name')).toBe(true);
    expect(issues.some((i) => i.field === 'keyword')).toBe(true);
  });

  it('detects duplicate keyword within the same platform', () => {
    const existing: Template = {
      id: '1',
      platform: 'teams',
      name: 'Existing',
      keyword: ';dup',
      tags: [],
      bodyHtml: '',
      bodyAst: [],
      createdAt: 10,
      updatedAt: 10,
    };

    const target: Template = {
      id: '2',
      platform: 'teams',
      name: 'Target',
      keyword: ';dup',
      tags: [],
      bodyHtml: '',
      bodyAst: [],
      createdAt: 20,
      updatedAt: 20,
    };

    const issues = validateTemplate(target, [existing]);
    expect(issues.some((i) => i.messageKey === 'validate_keyword_duplicate')).toBe(true);
  });

  it('validates email addresses in Gmail fields', () => {
    const t = newTemplate('gmail') as GmailTemplate;
    t.name = 'Valid Name';
    t.keyword = ';test';
    t.from = 'invalid-from';
    t.to = { mode: 'replace', emails: ['bad@', 'good@example.com'] };

    const issues = validateTemplate(t, []);
    expect(issues.some((i) => i.field === 'from')).toBe(true);
    expect(issues.some((i) => i.field === 'to')).toBe(true);
  });
});
