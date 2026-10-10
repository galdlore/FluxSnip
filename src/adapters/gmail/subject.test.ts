import { beforeEach, describe, expect, it } from 'vitest';
import type { TemplateVars } from '@/core/types';
import { applySubject, readSubject } from './subject';

const fixtureHtml = `
<div id="gmail-compose-root" role="dialog">
  <input name="subjectbox" class="aoT" value="Initial Subject" />
</div>
`;

describe('gmail subject', () => {
  let root: HTMLElement;
  const mockVars: TemplateVars = {
    now: new Date('2026-10-10T12:00:00Z'),
    locale: 'ja',
  };

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
    root = document.getElementById('gmail-compose-root') as HTMLElement;
  });

  it('reads current subject value', () => {
    const val = readSubject(root);
    expect(val).toBe('Initial Subject');
  });

  it('replaces subject in replace mode', async () => {
    await applySubject(root, { mode: 'replace', value: 'New Subject {{date}}' }, mockVars);
    const updated = readSubject(root);
    expect(updated).toContain('New Subject 2026/10/10');
  });

  it('does not overwrite in ifEmpty mode when subject is already set', async () => {
    await applySubject(root, { mode: 'ifEmpty', value: 'Should Not Overwrite' }, mockVars);
    const updated = readSubject(root);
    expect(updated).toBe('Initial Subject');
  });

  it('sets subject in ifEmpty mode when subject is currently empty', async () => {
    const input = root.querySelector('input[name="subjectbox"]') as HTMLInputElement;
    input.value = '';

    await applySubject(root, { mode: 'ifEmpty', value: 'Empty Fill' }, mockVars);
    const updated = readSubject(root);
    expect(updated).toBe('Empty Fill');
  });
});
