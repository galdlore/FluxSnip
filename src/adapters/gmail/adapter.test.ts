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

  it('finds compose body when node is inside To recipient or Subject inputs within compose window', () => {
    const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
    const bodyEl = document.getElementById('gmail-popup-body');

    const toInput = document.createElement('input');
    toInput.className = 'agP aFx';
    toInput.setAttribute('peoplekit-id', 'BbVjBd');
    toInput.setAttribute('aria-label', 'To の宛先');
    dialog.appendChild(toInput);

    const subjectInput = document.createElement('input');
    subjectInput.name = 'subjectbox';
    subjectInput.className = 'aoT';
    dialog.appendChild(subjectInput);

    expect(gmailAdapter.findEditor(toInput)).toBe(bodyEl);
    expect(gmailAdapter.findEditor(subjectInput)).toBe(bodyEl);
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

  describe('Gemini AI prompt box integration', () => {
    it('detects Gemini prompt box as active editor', () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('enterkeyhint', 'send');
      aiPromptBox.setAttribute('aria-label', 'メールの内容を説明してください');
      aiPromptBox.className = 'Pv5YRd TIYGAd UNQklc';
      const childSpan = document.createElement('span');
      childSpan.textContent = 'prompt prefix';
      aiPromptBox.appendChild(childSpan);
      dialog.appendChild(aiPromptBox);

      // Direct detection
      expect(gmailAdapter.findEditor(aiPromptBox)).toBe(aiPromptBox);
      // Child node detection
      expect(gmailAdapter.findEditor(childSpan)).toBe(aiPromptBox);

      // Check isPlainEditor & getInsertOrder
      expect(gmailAdapter.isPlainEditor?.(aiPromptBox)).toBe(true);
      expect(gmailAdapter.getInsertOrder?.(aiPromptBox)).toEqual(['insertText', 'paste', 'clipboard']);
    });

    it('afterInsert dispatches Enter key event and clicks submit button when autoSubmitAi is true', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const container = document.createElement('div');
      container.className = 'idpN8c k6dJm';

      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('enterkeyhint', 'send');
      aiPromptBox.setAttribute('aria-label', 'メールの内容を説明してください');
      aiPromptBox.className = 'Pv5YRd TIYGAd UNQklc';
      container.appendChild(aiPromptBox);

      const submitBtn = document.createElement('button');
      submitBtn.setAttribute('aria-label', '作成');
      let clicked = false;
      submitBtn.addEventListener('click', () => {
        clicked = true;
      });
      container.appendChild(submitBtn);
      dialog.appendChild(container);

      let enterDispatched = false;
      aiPromptBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enterDispatched = true;
      });

      const templateAuto: any = {
        id: 'tpl-ai-1',
        platform: 'gmail',
        name: 'AI Prompt Auto',
        keyword: ';ai',
        tags: [],
        bodyHtml: '<p>Please write email</p>',
        bodyAst: [],
        createdAt: 100,
        updatedAt: 100,
        autoSubmitAi: true,
      };

      await gmailAdapter.afterInsert?.(aiPromptBox, templateAuto);

      expect(enterDispatched).toBe(true);
      expect(clicked).toBe(true);
    });

    it('afterInsert does not trigger submit when autoSubmitAi is false or undefined', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('aria-label', 'メールの内容を説明してください');
      aiPromptBox.className = 'Pv5YRd TIYGAd UNQklc';
      dialog.appendChild(aiPromptBox);

      let enterDispatched = false;
      aiPromptBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enterDispatched = true;
      });

      const templateManual: any = {
        id: 'tpl-ai-2',
        platform: 'gmail',
        name: 'AI Prompt Manual',
        keyword: ';aim',
        tags: [],
        bodyHtml: '<p>Please write email</p>',
        bodyAst: [],
        createdAt: 100,
        updatedAt: 100,
        autoSubmitAi: false,
      };

      await gmailAdapter.afterInsert?.(aiPromptBox, templateManual);

      expect(enterDispatched).toBe(false);
    });
  });
});
