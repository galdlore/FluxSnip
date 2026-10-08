import type { PlatformAdapter } from '@/core/adapter';
import { startContent } from '@/core/bootstrap';
import { sanitizeHtml } from '@/core/html/sanitize';
import { saveTemplate } from '@/core/storage';
import type { ChatTemplate, GmailTemplate, TeamsTemplate } from '@/core/types';

function log(msg: string) {
  const container = document.getElementById('logs-container');
  if (!container) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = new Date().toLocaleTimeString();

  const text = document.createElement('span');
  text.className = 'log-msg';
  text.textContent = msg;

  entry.appendChild(time);
  entry.appendChild(text);
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

// 1. Gmail Dummy Adapter
const gmailEditorEl = document.getElementById('editor-gmail') as HTMLElement;
const gmailAdapter: PlatformAdapter = {
  platform: 'gmail',
  findEditor(node: Node | null): HTMLElement | null {
    if (node && gmailEditorEl.contains(node)) {
      return gmailEditorEl;
    }
    return null;
  },
  async collectVars() {
    return {
      to: {
        name: '田中 太郎',
        firstName: '太郎',
        lastName: '田中',
        email: 'tanaka@example.com',
      },
      from: {
        name: '自分',
        email: 'me@example.com',
      },
    };
  },
  async applyFields(_editor, t) {
    if (t.platform === 'gmail') {
      log(`[Gmail] Applied fields: to=${t.to?.emails?.length || 0}, subject="${t.subject?.value || ''}"`);
    }
    return { failed: [] };
  },
  insertOrder: ['dom', 'paste', 'clipboard'],
};

// 2. Teams Dummy Adapter
const teamsEditorEl = document.getElementById('editor-teams') as HTMLElement;

// Simulate rich paste event handling like Teams/ProseMirror
teamsEditorEl.addEventListener('paste', (e: ClipboardEvent) => {
  const clip = e.clipboardData;
  if (!clip) return;
  const html = clip.getData('text/html');
  if (html) {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const div = document.createElement('div');
      div.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (div.firstChild) {
        frag.appendChild(div.firstChild);
      }
      range.insertNode(frag);
      range.collapse(false);
      log('[Teams Simulator] Handled paste event successfully.');
    }
  }
});

const teamsAdapter: PlatformAdapter = {
  platform: 'teams',
  findEditor(node: Node | null): HTMLElement | null {
    if (node && teamsEditorEl.contains(node)) {
      return teamsEditorEl;
    }
    return null;
  },
  async collectVars() {
    return {};
  },
  insertOrder: ['paste', 'insertText', 'clipboard'],
};

// 3. Google Chat Dummy Adapter
const chatEditorEl = document.getElementById('editor-chat') as HTMLElement;
const chatAdapter: PlatformAdapter = {
  platform: 'chat',
  findEditor(node: Node | null): HTMLElement | null {
    if (node && chatEditorEl.contains(node)) {
      return chatEditorEl;
    }
    return null;
  },
  async collectVars() {
    return {};
  },
  insertOrder: ['insertText', 'paste', 'clipboard'],
};

// Initialize Content Script Runtime
const cleanup = startContent([gmailAdapter, teamsAdapter, chatAdapter]);
window.addEventListener('beforeunload', () => cleanup());

log('FluxSnip Runtime initialized for 3 playground editors.');

// Helper: Seed test templates
const seedBtn = document.getElementById('btn-seed-templates');
seedBtn?.addEventListener('click', async () => {
  const now = Date.now();

  const gmail1Html = '<p>{{to.lastName}}様</p><p>いつも大変お世話になっております。{{from.name}}です。</p><p>ご連絡いただき誠にありがとうございます。</p>';
  const gmailTpl1: GmailTemplate = {
    id: 'seed-gmail-thx',
    platform: 'gmail',
    name: 'お礼（定型）',
    keyword: ';thx',
    tags: ['挨拶', 'お礼'],
    bodyHtml: gmail1Html,
    bodyAst: sanitizeHtml(gmail1Html).ast,
    createdAt: now,
    updatedAt: now,
  };

  const gmail2Html = '<p>以下の日程で実施いたします。</p><table style="border-collapse:collapse;width:100%"><tbody><tr><td style="border:1px solid #999;padding:4px 8px">日付</td><td style="border:1px solid #999;padding:4px 8px">{{date}}</td></tr><tr><td style="border:1px solid #999;padding:4px 8px">時間</td><td style="border:1px solid #999;padding:4px 8px">15:00 - 16:00</td></tr></tbody></table>';
  const gmailTpl2: GmailTemplate = {
    id: 'seed-gmail-table',
    platform: 'gmail',
    name: '議事日程テーブル',
    keyword: ';table',
    tags: ['会議', 'テーブル'],
    bodyHtml: gmail2Html,
    bodyAst: sanitizeHtml(gmail2Html).ast,
    createdAt: now,
    updatedAt: now,
  };

  const teamsHtml = '<p><strong>【本日{{date}}の進捗報告】</strong></p><ul><li>タスクA：完了</li><li>タスクB：進行中</li></ul>';
  const teamsTpl: TeamsTemplate = {
    id: 'seed-teams-update',
    platform: 'teams',
    name: 'Teams 業務報告',
    keyword: ';teams',
    tags: ['報告'],
    bodyHtml: teamsHtml,
    bodyAst: sanitizeHtml(teamsHtml).ast,
    createdAt: now,
    updatedAt: now,
  };

  const chatHtml = '<p>お疲れ様です。<strong>{{date}}</strong>の件、確認をお願いします。</p>';
  const chatTpl: ChatTemplate = {
    id: 'seed-chat-ping',
    platform: 'chat',
    name: 'Chat 連絡',
    keyword: ';chat',
    tags: ['連絡'],
    bodyHtml: chatHtml,
    bodyAst: sanitizeHtml(chatHtml).ast,
    createdAt: now,
    updatedAt: now,
  };

  await saveTemplate(gmailTpl1);
  await saveTemplate(gmailTpl2);
  await saveTemplate(teamsTpl);
  await saveTemplate(chatTpl);

  log('Test templates seeded successfully! (Try ;thx, ;table, ;teams, ;chat or Alt+J)');
});

// Helper: Open options page
document.getElementById('btn-open-options')?.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

// Clear logs
document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
  const container = document.getElementById('logs-container');
  if (container) container.innerHTML = '';
});
