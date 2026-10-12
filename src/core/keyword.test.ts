import { describe, expect, it } from 'vitest';
import { extractTrailingToken, findTemplateByKeyword } from './keyword';
import type { Template } from './types';

describe('extractTrailingToken', () => {
  it('extracts trailing continuous keyword characters correctly', () => {
    expect(extractTrailingToken('hello ;thx')).toBe(';thx');
    expect(extractTrailingToken('abc')).toBe('abc');
    expect(extractTrailingToken('日本語;thx')).toBe(';thx');
    expect(extractTrailingToken('a b ')).toBe(null);
    expect(extractTrailingToken('')).toBe(null);
  });
});

describe('findTemplateByKeyword', () => {
  it('finds template by exact keyword matching and prefers newer updatedAt', () => {
    const older: Template = {
      id: '1',
      platform: 'gmail',
      name: 'Old Thanks',
      keyword: ';thx',
      tags: [],
      bodyHtml: '<p>Old</p>',
      bodyAst: [],
      createdAt: 100,
      updatedAt: 100,
    };

    const newer: Template = {
      id: '2',
      platform: 'gmail',
      name: 'New Thanks',
      keyword: ';thx',
      tags: [],
      bodyHtml: '<p>New</p>',
      bodyAst: [],
      createdAt: 200,
      updatedAt: 200,
    };

    const templates = [older, newer];
    const match = findTemplateByKeyword(';thx', templates);
    expect(match?.id).toBe('2');
    expect(findTemplateByKeyword(';unknown', templates)).toBe(null);
  });
});
