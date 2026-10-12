import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  addKnownFromAddresses,
  deleteTemplate,
  getKnownFromAddresses,
  getSettings,
  getTemplates,
  saveSettings,
  saveTemplate,
} from './storage';
import type { GmailTemplate } from './types';

describe('storage module', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('saves and retrieves templates for a platform', async () => {
    const tpl: GmailTemplate = {
      id: 'tpl-1',
      platform: 'gmail',
      name: 'Test Template',
      keyword: ';t1',
      tags: ['work'],
      bodyHtml: '<p>Content</p>',
      bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Content' }] }],
      createdAt: 1000,
      updatedAt: 1000,
    };

    await saveTemplate(tpl);
    const list = await getTemplates('gmail');
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('tpl-1');

    // Update
    const updatedTpl = { ...tpl, name: 'Updated Name' };
    await saveTemplate(updatedTpl);
    const updatedList = await getTemplates('gmail');
    expect(updatedList.length).toBe(1);
    expect(updatedList[0]?.name).toBe('Updated Name');

    // Delete
    await deleteTemplate('gmail', 'tpl-1');
    const emptyList = await getTemplates('gmail');
    expect(emptyList.length).toBe(0);
  });

  it('manages settings and falls back to default values', async () => {
    const initial = await getSettings();
    expect(initial.pickerShortcut.code).toBe('KeyJ');
    expect(initial.enabled.gmail).toBe(true);
    expect(initial.uiLanguage).toBe('auto');

    await saveSettings({ enabled: { gmail: false, teams: true, chat: true } });
    const modified = await getSettings();
    expect(modified.enabled.gmail).toBe(false);
    expect(modified.fieldWaitMs).toBe(150);

    await saveSettings({ fieldWaitMs: 50 });
    const tuned = await getSettings();
    expect(tuned.fieldWaitMs).toBe(50);
    expect(tuned.enabled.gmail).toBe(false);

    await saveSettings({ uiLanguage: 'ja' });
    const localized = await getSettings();
    expect(localized.uiLanguage).toBe('ja');
    expect(localized.fieldWaitMs).toBe(50);
  });

  it('fills in fieldWaitMs for settings stored before it existed', async () => {
    await browser.storage.local.set({
      settings: { pickerShortcut: { code: 'KeyK', ctrl: false, alt: true, shift: false, meta: false } },
    });
    const s = await getSettings();
    expect(s.fieldWaitMs).toBe(150);
    expect(s.uiLanguage).toBe('auto');
  });

  it('manages knownFromAddresses with deduplication and 50 address cap', async () => {
    const emails = Array.from({ length: 60 }, (_, i) => `user${i}@example.com`);
    await addKnownFromAddresses(emails);

    const stored = await getKnownFromAddresses();
    expect(stored.length).toBe(50);
    expect(stored[stored.length - 1]).toBe('user59@example.com');

    // Deduplication
    await addKnownFromAddresses(['user59@example.com', 'USER59@example.com', 'new@example.com']);
    const deduped = await getKnownFromAddresses();
    expect(deduped[deduped.length - 1]).toBe('new@example.com');
  });
});
