import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gmailAdapter } from './adapter';
import { findComposeRoot, findGmailBody } from './compose';
import { simulatePeopleKit } from './__fixtures__/peoplekit-sim';

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
      <div role="option" class="afV" data-hovercard-id="tanaka.taro@example.com" data-name="田中 太郎">
        <div class="afZ af1">
          <div class="akl">田中 太郎</div>
          <div class="akk">（example.com）</div>
        </div>
      </div>
      <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      <div id="gmail-popup-body" contenteditable="true" role="textbox" aria-label="メッセージ本文"></div>
    `;

    const bodyEl = document.getElementById('gmail-popup-body') as HTMLElement;
    const vars = await gmailAdapter.collectVars(bodyEl);
    expect(vars.to?.email).toBe('tanaka.taro@example.com');
    expect(vars.to?.name).toBe('田中 太郎');
    expect(vars.to?.lastName).toBe('田中');
    expect(vars.to?.firstName).toBe('太郎');
  });

  it('applyFields applies subject and recipient fields without error', async () => {
    const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
    dialog.insertAdjacentHTML('beforeend', `
      <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
    `);
    simulatePeopleKit(dialog);

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
      expect(gmailAdapter.getInsertOrder?.(aiPromptBox)).toEqual(['insertText', 'dom', 'paste', 'clipboard']);
    });

    it('afterInsert clicks the submit button only (no extra Enter) when autoSubmitAi is true', async () => {
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

      await gmailAdapter.afterInsert?.(aiPromptBox, templateAuto, { now: new Date(), locale: 'ja' });

      expect(clicked).toBe(true);
      expect(enterDispatched).toBe(false);
    });

    it('afterInsert falls back to Enter and never clicks buttons outside the Gemini panel', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const panel = document.createElement('div');
      panel.className = 'idpN8c';
      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('aria-label', 'メールの内容を説明してください');
      panel.appendChild(aiPromptBox);
      dialog.appendChild(panel);

      const unrelatedBtn = document.createElement('button');
      unrelatedBtn.setAttribute('aria-label', 'イベントを作成');
      let unrelatedClicked = false;
      unrelatedBtn.addEventListener('click', () => {
        unrelatedClicked = true;
      });
      dialog.appendChild(unrelatedBtn);

      let enterDispatched = false;
      aiPromptBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enterDispatched = true;
      });

      await gmailAdapter.afterInsert?.(aiPromptBox, {
        id: 'tpl-ai-3',
        platform: 'gmail',
        name: 'AI',
        keyword: ';ai3',
        tags: [],
        bodyHtml: '',
        bodyAst: [],
        createdAt: 1,
        updatedAt: 1,
        autoSubmitAi: true,
      }, { now: new Date(), locale: 'ja' });

      expect(unrelatedClicked).toBe(false);
      expect(enterDispatched).toBe(true);
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

      await gmailAdapter.afterInsert?.(aiPromptBox, templateManual, { now: new Date(), locale: 'ja' });

      expect(enterDispatched).toBe(false);
    });

    it('detects Gemini prompt box with aria-label="変更内容を記述します"', () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('enterkeyhint', 'send');
      aiPromptBox.setAttribute('aria-label', '変更内容を記述します');
      aiPromptBox.setAttribute('jsname', 'ZeIRi');
      aiPromptBox.className = 'Pv5YRd TIYGAd UNQklc';
      dialog.appendChild(aiPromptBox);

      expect(gmailAdapter.findEditor(aiPromptBox)).toBe(aiPromptBox);
      expect(gmailAdapter.isPlainEditor?.(aiPromptBox)).toBe(true);
    });

    it('afterInsert dismisses active formatting toolbar and populates promptBox without leaking to body', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const bodyEl = document.querySelector('div.editable') as HTMLElement;

      // Mock active formatting toolbar toggle
      const formatToggle = document.createElement('div');
      formatToggle.className = 'J-Z-I J-J5-Ji J-Z-I-KO';
      formatToggle.setAttribute('role', 'button');
      formatToggle.setAttribute('aria-expanded', 'true');
      formatToggle.setAttribute('data-tooltip', '書式設定オプション');
      let formatDismissed = false;
      formatToggle.addEventListener('click', () => {
        formatDismissed = true;
        formatToggle.setAttribute('aria-expanded', 'false');
      });
      dialog.appendChild(formatToggle);

      // Mock Gemini trigger button (sdt)
      const sdtBtn = document.createElement('div');
      sdtBtn.setAttribute('command', 'sdt');
      let sdtClicked = false;
      sdtBtn.addEventListener('click', () => {
        sdtClicked = true;
        // Panel appears asynchronously
        const promptBox = document.createElement('div');
        promptBox.setAttribute('contenteditable', 'true');
        promptBox.setAttribute('role', 'textbox');
        promptBox.setAttribute('aria-label', '変更内容を記述します');
        promptBox.className = 'Pv5YRd TIYGAd UNQklc';
        dialog.appendChild(promptBox);
      });
      dialog.appendChild(sdtBtn);

      const templateWithAi: any = {
        id: 'tpl-ai-after',
        platform: 'gmail',
        name: 'AI Template',
        keyword: ';aia',
        tags: [],
        bodyHtml: '<p>Regular body</p>',
        bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Regular body' }] }],
        aiPrompt: 'Please review and improve tone',
        createdAt: 100,
        updatedAt: 100,
      };

      document.execCommand = vi.fn((cmd: string, showUI: boolean, val?: string) => {
        if (cmd === 'insertText' && val) {
          const active = document.activeElement as HTMLElement;
          if (active) active.textContent = val;
          return true;
        }
        return false;
      });

      await gmailAdapter.afterInsert?.(bodyEl, templateWithAi, { now: new Date(), locale: 'ja' });

      expect(formatDismissed).toBe(true);
      expect(sdtClicked).toBe(true);

      const createdPromptBox = dialog.querySelector('div[aria-label="変更内容を記述します"]') as HTMLElement;
      expect(createdPromptBox).not.toBeNull();
      expect(document.activeElement).toBe(createdPromptBox);
      expect(createdPromptBox.textContent).toBe('Please review and improve tone');
    });

    it('afterInsert clicks submit button with aria-label="送信" when autoSubmitAi is true', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const container = document.createElement('div');
      container.className = 'idpN8c';

      const aiPromptBox = document.createElement('div');
      aiPromptBox.setAttribute('contenteditable', 'true');
      aiPromptBox.setAttribute('role', 'textbox');
      aiPromptBox.setAttribute('aria-label', '変更内容を記述します');
      aiPromptBox.className = 'Pv5YRd TIYGAd UNQklc';
      container.appendChild(aiPromptBox);

      const sendBtn = document.createElement('button');
      sendBtn.setAttribute('aria-label', '送信');
      let sendClicked = false;
      sendBtn.addEventListener('click', () => {
        sendClicked = true;
      });
      container.appendChild(sendBtn);
      dialog.appendChild(container);

      const templateAuto: any = {
        id: 'tpl-ai-send',
        platform: 'gmail',
        name: 'AI Prompt Send',
        keyword: ';ais',
        tags: [],
        bodyHtml: '',
        bodyAst: [],
        createdAt: 100,
        updatedAt: 100,
        autoSubmitAi: true,
      };

      await gmailAdapter.afterInsert?.(aiPromptBox, templateAuto, { now: new Date(), locale: 'ja' });

      expect(sendClicked).toBe(true);
    });

    it('afterInsert does not click sdt button when prompt box is already open and populates prompt', async () => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
      const bodyEl = document.querySelector('div.editable') as HTMLElement;

      const promptBox = document.createElement('div');
      promptBox.setAttribute('contenteditable', 'true');
      promptBox.setAttribute('role', 'textbox');
      promptBox.setAttribute('aria-label', 'メールの内容を説明してください');
      promptBox.className = 'Pv5YRd TIYGAd UNQklc';
      dialog.appendChild(promptBox);

      const sdtBtn = document.createElement('div');
      sdtBtn.setAttribute('command', 'sdt');
      sdtBtn.setAttribute('aria-expanded', 'true');
      let sdtClicked = false;
      sdtBtn.addEventListener('click', () => {
        sdtClicked = true;
      });
      dialog.appendChild(sdtBtn);

      const templateWithAi: any = {
        id: 'tpl-ai-open',
        platform: 'gmail',
        name: 'AI Template Open',
        keyword: ';aie',
        tags: [],
        bodyHtml: '<p>Regular body</p>',
        bodyAst: [{ t: 'p', c: [{ t: '#text', v: 'Regular body' }] }],
        aiPrompt: 'Prompt for already open box',
        createdAt: 100,
        updatedAt: 100,
      };

      document.execCommand = vi.fn((cmd: string, showUI: boolean, val?: string) => {
        if (cmd === 'insertText' && val) {
          const active = document.activeElement as HTMLElement;
          if (active) active.textContent = val;
          return true;
        }
        return false;
      });

      await gmailAdapter.afterInsert?.(bodyEl, templateWithAi, { now: new Date(), locale: 'ja' });

      expect(sdtClicked).toBe(false);
      expect(document.activeElement).toBe(promptBox);
      expect(promptBox.textContent).toBe('Prompt for already open box');
    });
  });
});
