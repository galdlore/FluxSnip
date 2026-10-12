import { beforeEach, describe, expect, it } from 'vitest';
import { teamsAdapter } from './adapter';
import fixtureHtml from './__fixtures__/teams-fixture.html?raw';

describe('teams adapter and compose detection', () => {
  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('has correct platform and insertOrder specifications', () => {
    expect(teamsAdapter.platform).toBe('teams');
    expect(teamsAdapter.insertOrder).toEqual(['paste', 'insertText', 'clipboard']);
    // Guarantees direct DOM manipulation is excluded for CKEditor 5
    expect(teamsAdapter.insertOrder).not.toContain('dom');
  });

  it('finds chat editor directly or from nested child node', () => {
    const editor = document.getElementById('chat-ckeditor') as HTMLElement;
    const childP = document.getElementById('chat-p') as HTMLElement;
    const childText = document.getElementById('chat-text') as HTMLElement;

    expect(editor).not.toBeNull();
    expect(childP).not.toBeNull();
    expect(childText).not.toBeNull();

    // From editor directly
    expect(teamsAdapter.findEditor(editor)).toBe(editor);

    // From paragraph child
    expect(teamsAdapter.findEditor(childP)).toBe(editor);

    // From text span
    expect(teamsAdapter.findEditor(childText)).toBe(editor);
  });

  it('finds channel editor directly or from child paragraph', () => {
    const editor = document.getElementById('channel-ckeditor') as HTMLElement;
    const childP = document.getElementById('channel-p') as HTMLElement;

    expect(editor).not.toBeNull();
    expect(childP).not.toBeNull();

    expect(teamsAdapter.findEditor(editor)).toBe(editor);
    expect(teamsAdapter.findEditor(childP)).toBe(editor);
  });

  it('finds channel body editor when focused on channel subject input', () => {
    const subjectInput = document.getElementById('channel-subject-input') as HTMLInputElement;
    const bodyEditor = document.getElementById('channel-ckeditor') as HTMLElement;

    expect(subjectInput).not.toBeNull();
    expect(bodyEditor).not.toBeNull();

    // When focus is in the subject box, findEditor locates the body editor in the compose layout
    expect(teamsAdapter.findEditor(subjectInput)).toBe(bodyEditor);
  });

  it('returns null for search bar and header inputs', () => {
    const searchInput = document.getElementById('ms-searchux-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    expect(teamsAdapter.findEditor(searchInput)).toBeNull();
  });

  it('returns empty object for collectVars', async () => {
    const editor = document.getElementById('chat-ckeditor') as HTMLElement;
    const vars = await teamsAdapter.collectVars(editor);
    expect(vars).toEqual({});
  });
});
