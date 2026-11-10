import { describe, expect, it } from 'vitest';
import { extractTrailingToken, findTemplateByKeyword, findTemplateMatch } from './keyword';
import type { Template } from './types';

describe('extractTrailingToken', () => {
  it('extracts trailing continuous keyword characters correctly', () => {
    expect(extractTrailingToken('hello ;thx')).toBe(';thx');
    expect(extractTrailingToken('abc')).toBe('abc');
    expect(extractTrailingToken('お世話になります。;挨拶')).toBe(';挨拶');
    expect(extractTrailingToken('お世話になります。；挨拶')).toBe('；挨拶');
    expect(extractTrailingToken('こんにちは;挨拶')).toBe('こんにちは;挨拶');
    expect(extractTrailingToken('a b ')).toBe(null);
    expect(extractTrailingToken('')).toBe(null);
  });
});

describe('findTemplateByKeyword and findTemplateMatch', () => {
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

  const jaTpl: Template = {
    id: '3',
    platform: 'gmail',
    name: 'Greeting',
    keyword: ';挨拶',
    tags: [],
    bodyHtml: '<p>お世話になっております。</p>',
    bodyAst: [],
    createdAt: 300,
    updatedAt: 300,
  };

  const templates = [older, newer, jaTpl];

  it('finds template by exact keyword matching and prefers newer updatedAt', () => {
    const match = findTemplateByKeyword(';thx', templates);
    expect(match?.id).toBe('2');
    expect(findTemplateByKeyword(';unknown', templates)).toBe(null);
  });

  it('finds Japanese keyword template with exact match', () => {
    const match = findTemplateMatch(';挨拶', templates);
    expect(match?.template.id).toBe('3');
    expect(match?.matchedToken).toBe(';挨拶');
  });

  it('normalizes full-width semicolon to match half-width keyword', () => {
    const match = findTemplateMatch('；挨拶', templates);
    expect(match?.template.id).toBe('3');
    expect(match?.matchedToken).toBe('；挨拶');
  });

  it('extracts embedded semicolon sub-token when preceded by text without delimiters', () => {
    const match = findTemplateMatch('こんにちは;挨拶', templates);
    expect(match?.template.id).toBe('3');
    expect(match?.matchedToken).toBe(';挨拶');
  });
});
