import { describe, expect, it } from 'vitest';
import type { GmailTemplate } from '../types';
import { filterAndSortTemplates } from './picker';

describe('picker filterAndSortTemplates', () => {
  const templates: GmailTemplate[] = [
    {
      id: '1',
      platform: 'gmail',
      name: 'Thanks Basic',
      keyword: ';thx',
      tags: ['greeting'],
      bodyHtml: '<p>Thank you very much.</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Thank you very much.' }] }],
      createdAt: 100,
      updatedAt: 100,
    },
    {
      id: '2',
      platform: 'gmail',
      name: 'Thanks Long',
      keyword: ';thx-long',
      tags: ['greeting'],
      bodyHtml: '<p>Long thank you text.</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Long thank you text.' }] }],
      createdAt: 200,
      updatedAt: 200,
    },
    {
      id: '3',
      platform: 'gmail',
      name: ';thx Special Meeting',
      keyword: ';mtg',
      tags: ['meeting'],
      bodyHtml: '<p>Meeting schedule</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Meeting schedule' }] }],
      createdAt: 300,
      updatedAt: 300,
    },
    {
      id: '4',
      platform: 'gmail',
      name: 'Other Template',
      keyword: ';other',
      tags: ['general'],
      bodyHtml: '<p>Contains ;thx inside body</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Contains ;thx inside body' }] }],
      createdAt: 400,
      updatedAt: 400,
    },
  ];

  it('ranks exact keyword match first', () => {
    const results = filterAndSortTemplates(templates, ';thx');
    expect(results.length).toBe(4);
    // Group 1: Exact keyword match (;thx)
    expect(results[0]?.id).toBe('1');
    // Group 2: Keyword prefix match (;thx-long)
    expect(results[1]?.id).toBe('2');
    // Group 3: Name prefix match (;thx Special Meeting)
    expect(results[2]?.id).toBe('3');
    // Group 4: Body text match (Other Template)
    expect(results[3]?.id).toBe('4');
  });

  it('filters by tags', () => {
    const results = filterAndSortTemplates(templates, 'meeting');
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe('3');
  });

  it('returns all templates sorted by updatedAt desc when query is empty', () => {
    const results = filterAndSortTemplates(templates, '');
    expect(results.map((r) => r.id)).toEqual(['4', '3', '2', '1']);
  });

  it('returns empty array when nothing matches', () => {
    const results = filterAndSortTemplates(templates, 'nonexistentxyz');
    expect(results).toHaveLength(0);
  });
});
