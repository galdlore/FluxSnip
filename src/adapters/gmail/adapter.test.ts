import { beforeEach, describe, expect, it } from 'vitest';
import { gmailAdapter } from './adapter';
import { findComposeRoot, findGmailBody } from './compose';

const fixtureHtml = `
<div id="gmail-viewport">
  <header>
    <input name="q" role="combobox" aria-label="メールを検索" value="" />
  </header>

  <div role="dialog" aria-label="新規メッセージ" class="M9">
    <div class="aoD hl">
      <input name="subjectbox" placeholder="件名" value="" />
    </div>
    <div class="Ap">
      <div
        id="gmail-popup-body"
        role="textbox"
        contenteditable="true"
        g_editable="true"
        aria-label="メッセージの本文"
        class="Am Al editable"
      >
        <p id="popup-child-p">Popup body content</p>
      </div>
    </div>
  </div>

  <div role="main">
    <div class="M9 reply-container">
      <input name="subject" type="hidden" value="Re: Project Update" />
      <div
        id="gmail-inline-reply-body"
        role="textbox"
        contenteditable="true"
        g_editable="true"
        aria-label="Message Body"
      >
        <p id="reply-child-p">Reply text</p>
        <div class="gmail_quote">Quoted original text</div>
      </div>
    </div>
  </div>
</div>
`;

describe('gmail adapter and compose detection', () => {
  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('finds popup compose body directly or from child node', () => {
    const bodyEl = document.getElementById('gmail-popup-body');
    const childP = document.getElementById('popup-child-p');
    expect(bodyEl).not.toBeNull();
    expect(childP).not.toBeNull();

    // From body directly
    const found1 = gmailAdapter.findEditor(bodyEl);
    expect(found1).toBe(bodyEl);

    // From child node
    const found2 = gmailAdapter.findEditor(childP);
    expect(found2).toBe(bodyEl);
  });

  it('finds inline reply body correctly', () => {
    const replyBody = document.getElementById('gmail-inline-reply-body');
    const replyChild = document.getElementById('reply-child-p');
    expect(replyBody).not.toBeNull();

    const found = gmailAdapter.findEditor(replyChild);
    expect(found).toBe(replyBody);
  });

  it('returns null for search bar and general inputs', () => {
    const searchInput = document.querySelector('input[name="q"]');
    expect(searchInput).not.toBeNull();

    const found = gmailAdapter.findEditor(searchInput);
    expect(found).toBeNull();
  });

  it('findComposeRoot correctly identifies dialog container', () => {
    const childP = document.getElementById('popup-child-p');
    const root = findComposeRoot(childP);
    expect(root).not.toBeNull();
    expect(root?.getAttribute('role')).toBe('dialog');
  });

  it('collectVars extracts To and From variables when present', async () => {
    const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
    dialog.insertAdjacentHTML('beforeend', `
      <input type="hidden" name="from" value="me@example.com" />
      <div class="afZ" data-hovercard-id="tanaka@example.com">
        <div class="akl">tanaka@example.com</div>
        <div class="akk">田中 太郎</div>
      </div>
      <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
    `);

    const bodyEl = document.getElementById('gmail-popup-body') as HTMLElement;
    const vars = await gmailAdapter.collectVars(bodyEl);
    expect(vars.to?.email).toBe('tanaka@example.com');
    expect(vars.to?.lastName).toBe('田中');
    expect(vars.to?.firstName).toBe('太郎');
    expect(vars.from?.email).toBe('me@example.com');
  });

  it('collectVars extracts Japanese lastName from real PeopleKit data-name attribute', async () => {
    const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
    dialog.innerHTML = `
      <div role="option" class="afV" data-hovercard-id="kj.tadokoro@sunace-corp.com" data-name="田所 功次">
        <div class="afZ af1">
          <div class="akl">田所 功次</div>
          <div class="akk">（sunace-corp.com）</div>
        </div>
      </div>
      <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      <div id="gmail-popup-body" contenteditable="true" role="textbox" aria-label="メッセージ本文"></div>
    `;

    const bodyEl = document.getElementById('gmail-popup-body') as HTMLElement;
    const vars = await gmailAdapter.collectVars(bodyEl);
    expect(vars.to?.email).toBe('kj.tadokoro@sunace-corp.com');
    expect(vars.to?.name).toBe('田所 功次');
    expect(vars.to?.lastName).toBe('田所');
    expect(vars.to?.firstName).toBe('功次');
  });

  it('applyFields applies subject and recipient fields without error', async () => {
    const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
    dialog.insertAdjacentHTML('beforeend', `
      <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
    `);

    const bodyEl = document.getElementById('gmail-popup-body') as HTMLElement;
    const template: any = {
      id: 'test-1',
      platform: 'gmail',
      name: 'Test',
      keyword: ';test',
      tags: [],
      bodyHtml: '<p>Test</p>',
      bodyAst: [],
      createdAt: 100,
      updatedAt: 100,
      subject: { mode: 'replace', value: 'Updated Subject' },
      to: { mode: 'append', emails: ['new@example.com'] },
    };

    const res = await gmailAdapter.applyFields!(bodyEl, template);
    expect(res.failed).toEqual([]);

    const subj = document.querySelector('input[name="subjectbox"]') as HTMLInputElement;
    expect(subj.value).toBe('Updated Subject');
  });
});
