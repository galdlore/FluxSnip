import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  applyImport,
  buildExport,
  parseImport,
} from './backup';
import { getTemplates, replaceTemplates } from './storage';
import type { GmailTemplate, Template } from './types';

describe('backup module', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('performs lossless export, parse, and apply roundtrip', async () => {
    const tpl: GmailTemplate = {
      id: 'g-1',
      platform: 'gmail',
      name: 'Gmail Template',
      keyword: ';g1',
      tags: ['intro'],
      bodyHtml: '<p>Hello <b>World</b></p>',
      bodyAst: [],
      createdAt: 100,
      updatedAt: 100,
      to: { mode: 'replace', emails: ['test@example.com'] },
    };

    const exportJson = buildExport({
      templates: {
        gmail: [tpl],
        teams: [],
        chat: [],
      },
    });

    const preview = parseImport(exportJson);
    expect(preview.errors.length).toBe(0);
    expect(preview.counts.gmail).toBe(1);

    const result = await applyImport(preview, 'replace', true);
    expect(result.added).toBe(1);

    const saved = await getTemplates('gmail');
    expect(saved.length).toBe(1);
    expect(saved[0]?.name).toBe('Gmail Template');
    expect(saved[0]?.bodyAst.length).toBeGreaterThan(0);
  });

  it('keeps only known fields and rejects malformed Gmail fields', () => {
    const base = { name: 'T', bodyHtml: '<p>x</p>', createdAt: 1, updatedAt: 1 };
    const preview = parseImport(
      JSON.stringify({
        app: 'FluxSnip',
        templates: {
          gmail: [
            {
              ...base,
              id: 'ok',
              keyword: ';ok',
              evil: '<script>',
              to: { mode: 'append', emails: ['A@example.com', 'a@example.com'] },
              subject: { mode: 'ifEmpty', value: 'Hi' },
              autoSubmitAi: true,
            },
            { ...base, id: 'bad-to', keyword: ';b1', to: { mode: 'replace', emails: 'a@example.com' } },
            { ...base, id: 'bad-subject', keyword: ';b2', subject: { mode: 'x', value: 1 } },
            { ...base, id: 'bad-ai', keyword: ';b3', aiPrompt: 42 },
            { ...base, id: 'ok', keyword: ';dup' },
          ],
        },
      })
    );

    expect(preview.data.gmail.map((t) => t.id)).toEqual(['ok']);
    const ok = preview.data.gmail[0] as GmailTemplate & { evil?: unknown };
    expect(ok.evil).toBeUndefined();
    expect(ok.to).toEqual({ mode: 'append', emails: ['A@example.com'] });
    expect(ok.subject).toEqual({ mode: 'ifEmpty', value: 'Hi' });
    expect(ok.autoSubmitAi).toBe(true);
    expect(preview.errors).toHaveLength(4);
    expect(preview.errors.some((e) => e.includes('Duplicate id'))).toBe(true);
  });

  it('rejects invalid JSON or incompatible application tag', () => {
    const badJson = parseImport('{ not valid json');
    expect(badJson.errors.length).toBe(1);

    const wrongApp = parseImport(JSON.stringify({ app: 'OtherApp', templates: {} }));
    expect(wrongApp.errors.length).toBe(1);
    expect(wrongApp.errors[0]).toContain('OtherApp');
  });

  it('skips invalid templates without failing entire import', () => {
    const json = JSON.stringify({
      app: 'FluxSnip',
      templates: {
        teams: [
          {
            id: 't-1',
            name: 'Valid',
            keyword: ';valid',
            bodyHtml: '<p>Hi</p>',
          },
          {
            id: 't-2',
            name: '', // missing required name
            keyword: ';bad',
          },
        ],
      },
    });

    const preview = parseImport(json);
    expect(preview.counts.teams).toBe(1);
    expect(preview.errors.length).toBe(1);
  });

  it('regenerates AST from bodyHtml discarding any tampered AST payload', () => {
    const tamperedJson = JSON.stringify({
      app: 'FluxSnip',
      templates: {
        chat: [
          {
            id: 'c-1',
            name: 'Chat Snippet',
            keyword: ';chat',
            bodyHtml: '<p>Safe Text<script>evil()</script></p>',
            bodyAst: [{ t: 'script', c: [{ t: '#text', v: 'evil()' }] }], // tampered
          },
        ],
      },
    });

    const preview = parseImport(tamperedJson);
    const item = preview.data.chat[0];
    expect(item?.bodyHtml).toBe('<p>Safe Text</p>');
    expect(JSON.stringify(item?.bodyAst)).not.toContain('evil()');
  });

  it('keeps only well-typed settings values and defaults the rest', () => {
    const preview = parseImport(
      JSON.stringify({
        app: 'FluxSnip',
        templates: {},
        settings: {
          pickerShortcut: { code: 'KeyK', ctrl: 'yes', alt: true },
          enabled: { gmail: false, teams: 'off', evil: true },
        },
      })
    );

    expect(preview.settings).toEqual({
      pickerShortcut: { code: 'KeyK', ctrl: false, alt: true, shift: false, meta: false },
      enabled: { gmail: false, teams: true, chat: true },
      fieldWaitMs: 150,
      uiLanguage: 'auto',
    });
  });

  it('clamps an imported fieldWaitMs into the allowed range', () => {
    const preview = parseImport(
      JSON.stringify({ app: 'FluxSnip', templates: {}, settings: { fieldWaitMs: 99999 } })
    );
    expect(preview.settings?.fieldWaitMs).toBe(600);
    expect(preview.settings?.uiLanguage).toBe('auto');
  });

  it('keeps a saved UI language and drops an unknown one', () => {
    const kept = parseImport(
      JSON.stringify({ app: 'FluxSnip', templates: {}, settings: { uiLanguage: 'ja' } })
    );
    expect(kept.settings?.uiLanguage).toBe('ja');

    const dropped = parseImport(
      JSON.stringify({ app: 'FluxSnip', templates: {}, settings: { uiLanguage: 'fr' } })
    );
    expect(dropped.settings?.uiLanguage).toBe('auto');
  });

  it('ignores a non-object settings section and reports it', () => {
    const preview = parseImport(JSON.stringify({ app: 'FluxSnip', templates: {}, settings: 'oops' }));
    expect(preview.settings).toBeUndefined();
    expect(preview.errors).toHaveLength(1);
  });

  it('skips merged templates whose keyword is already used by another template', async () => {
    await replaceTemplates('teams', [
      {
        id: 'existing',
        platform: 'teams',
        name: 'Existing',
        keyword: ';dup',
        tags: [],
        bodyHtml: '<p>A</p>',
        bodyAst: [],
        createdAt: 100,
        updatedAt: 100,
      },
    ]);

    const preview = parseImport(
      JSON.stringify({
        app: 'FluxSnip',
        templates: {
          teams: [{ id: 'incoming', name: 'Incoming', keyword: ';dup', bodyHtml: '<p>B</p>', updatedAt: 200 }],
        },
      })
    );

    const res = await applyImport(preview, 'merge', false);
    expect(res).toEqual({ added: 0, updated: 0, skipped: 1 });
    const current = await getTemplates('teams');
    expect(current.map((i) => i.id)).toEqual(['existing']);
  });

  it('handles merge mode comparing updatedAt timestamps', async () => {
    const initialTpl: Template = {
      id: 'item-1',
      platform: 'teams',
      name: 'Initial Name',
      keyword: ';item1',
      tags: [],
      bodyHtml: '<p>A</p>',
      bodyAst: [],
      createdAt: 100,
      updatedAt: 100,
    };
    await replaceTemplates('teams', [initialTpl]);

    // Prepare import with an updated template and an older template
    const preview = parseImport(
      JSON.stringify({
        app: 'FluxSnip',
        templates: {
          teams: [
            {
              id: 'item-1',
              name: 'Updated Name',
              keyword: ';item1',
              tags: [],
              bodyHtml: '<p>A</p>',
              createdAt: 100,
              updatedAt: 200, // Newer than 100
            },
            {
              id: 'item-2',
              name: 'New Item',
              keyword: ';item2',
              tags: [],
              bodyHtml: '<p>B</p>',
              createdAt: 150,
              updatedAt: 150,
            },
          ],
        },
      })
    );

    const res = await applyImport(preview, 'merge', false);
    expect(res.added).toBe(1);
    expect(res.updated).toBe(1);

    const current = await getTemplates('teams');
    expect(current.find((i) => i.id === 'item-1')?.name).toBe('Updated Name');
    expect(current.find((i) => i.id === 'item-2')?.name).toBe('New Item');
  });
});
