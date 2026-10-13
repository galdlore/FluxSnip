import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test as base, type BrowserContext, type Locator, type Page, type Worker } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILE_DIR = process.env.FLUXSNIP_E2E_PROFILE ?? path.join(ROOT, '.e2e-profile');
const EXTENSION_DIR = path.join(ROOT, '.output', 'chrome-mv3');

export interface E2eTemplate {
  platform?: 'gmail' | 'teams' | 'chat';
  keyword: string;
  text: string;
  html?: string;
  to?: { mode: 'replace' | 'append'; emails: string[] };
  cc?: { mode: 'replace' | 'append'; emails: string[] };
  subject?: { mode: 'replace' | 'ifEmpty'; value: string };
  aiPrompt?: string;
  autoSubmitAi?: boolean;
}

export function toStoredTemplate(t: E2eTemplate, i: number) {
  const platform = t.platform ?? 'gmail';
  const escaped = t.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = t.html ?? `<p>${escaped}</p>`;
  return {
    id: `e2e-${i}-${t.keyword}`,
    platform,
    name: `E2E ${t.keyword}`,
    keyword: t.keyword,
    tags: ['e2e'],
    bodyHtml,
    bodyAst: [{ t: 'p', c: [{ t: '#text', v: t.text }] }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(t.to ? { to: t.to } : {}),
    ...(t.cc ? { cc: t.cc } : {}),
    ...(t.subject ? { subject: t.subject } : {}),
    ...(t.aiPrompt ? { aiPrompt: t.aiPrompt } : {}),
    ...(t.autoSubmitAi !== undefined ? { autoSubmitAi: t.autoSubmitAi } : {}),
  };
}

export async function setExtensionTemplates(
  context: BrowserContext,
  platform: 'gmail' | 'teams' | 'chat',
  list: E2eTemplate[]
) {
  const page = await context.newPage();
  try {
    const stored = await page.evaluate(
      ({ platform, list }) => {
        const parser = new DOMParser();
        return list.map((t, idx) => {
          const bodyHtml = t.html ?? `<p>${t.text}</p>`;
          const doc = parser.parseFromString(bodyHtml, 'text/html');
          function domToAst(node: Node): any[] {
            if (node.nodeType === Node.TEXT_NODE) {
              return [{ t: '#text', v: node.textContent ?? '' }];
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              const tag = el.tagName.toLowerCase();
              const a: Record<string, string> = {};
              for (let i = 0; i < el.attributes.length; i++) {
                const attr = el.attributes.item(i);
                if (attr) {
                  a[attr.name] = attr.value;
                }
              }
              const c: any[] = [];
              for (let i = 0; i < el.childNodes.length; i++) {
                const child = el.childNodes.item(i);
                if (child) {
                  c.push(...domToAst(child));
                }
              }
              return [{ t: tag, ...(Object.keys(a).length > 0 ? { a } : {}), c }];
            }
            return [];
          }
          const ast: any[] = [];
          for (let i = 0; i < doc.body.childNodes.length; i++) {
            const child = doc.body.childNodes.item(i);
            if (child) {
              ast.push(...domToAst(child));
            }
          }
          return {
            id: `e2e-${idx}-${t.keyword}`,
            platform,
            name: `E2E ${t.keyword}`,
            keyword: t.keyword,
            tags: ['e2e'],
            bodyHtml,
            bodyAst: ast.length > 0 ? ast : [{ t: 'p', c: [{ t: '#text', v: t.text }] }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...(t.to ? { to: t.to } : {}),
            ...(t.cc ? { cc: t.cc } : {}),
            ...(t.subject ? { subject: t.subject } : {}),
            ...(t.aiPrompt ? { aiPrompt: t.aiPrompt } : {}),
            ...(t.autoSubmitAi !== undefined ? { autoSubmitAi: t.autoSubmitAi } : {}),
          };
        });
      },
      { platform, list }
    );

    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await worker.evaluate(
      async ({ key, templates }) => {
        const api = (globalThis as unknown as {
          chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };
        }).chrome;
        await api.storage.local.set({ [key]: templates });
      },
      { key: `templates:${platform}`, templates: stored }
    );
  } finally {
    await page.close();
  }
}

export interface Compose {
  page: Page;
  dialog: Locator;
  body: Locator;
  subject: Locator;
  aiPromptBox: Locator;
  aiHelpBtn: Locator;
  hasGemini(): Promise<boolean>;
  setTemplates(list: E2eTemplate[]): Promise<void>;
  expand(keyword: string): Promise<void>;
  chipEmails(): Promise<string[]>;
  toSelectedCount(): Promise<number>;
  addToRecipient(email: string): Promise<void>;
}

export interface TeamsPlayground {
  page: Page;
  editor: Locator;
  logs: Locator;
  setTemplates(list: E2eTemplate[]): Promise<void>;
  expand(keyword: string): Promise<void>;
}

export interface ChatCompose {
  page: Page;
  editor: Locator;
  setTemplates(list: E2eTemplate[]): Promise<void>;
  expand(keyword: string): Promise<void>;
  clear(): Promise<void>;
}

type WorkerFixtures = { ext: { context: BrowserContext; worker: Worker } };
type TestFixtures = {
  compose: Compose;
  teamsPlayground: TeamsPlayground;
  chatCompose: ChatCompose;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  ext: [
    async ({}, use) => {
      if (!fs.existsSync(path.join(EXTENSION_DIR, 'manifest.json'))) {
        throw new Error(`Extension build not found at ${EXTENSION_DIR}. Run "npm run build" first.`);
      }
      if (!fs.existsSync(PROFILE_DIR)) {
        throw new Error(`No signed-in profile at ${PROFILE_DIR}. Run "npm run e2e:login" first.`);
      }

      const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        viewport: { width: 1400, height: 900 },
        args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
      });
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      await use({ context, worker });
      await context.close();
    },
    { scope: 'worker' },
  ],

  compose: async ({ ext }, use) => {
    const setTemplates = async (list: E2eTemplate[]) => {
      await setExtensionTemplates(ext.context, 'gmail', list);
    };
    await setTemplates([]);

    const page = await ext.context.newPage();
    page.on('console', (msg) => {
      console.log(`  [page ${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`  [pageerror] ${err.message}`);
    });
    await page.goto('https://mail.google.com/mail/u/0/#inbox?compose=new');
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Not signed in to Gmail. Run "npm run e2e:login" and sign in with a test account.');
    }

    const subject = page.locator('input[name="subjectbox"]').last();
    await subject.waitFor({ timeout: 30_000 });
    const dialog = page
      .locator('div[role="dialog"], div[role="region"]')
      .filter({ has: page.locator('input[name="subjectbox"]') })
      .last();
    const body = dialog.locator('div[contenteditable="true"][g_editable="true"]').first();
    await body.waitFor();

    const aiPromptBox = dialog
      .locator(
        'div[contenteditable="true"][aria-label*="メールの内容を説明してください"], ' +
          'div[contenteditable="true"][aria-label*="変更内容を記述"], ' +
          'div[contenteditable="true"][aria-label*="Help me write"], ' +
          'div.Pv5YRd.TIYGAd[contenteditable="true"], ' +
          'div[jsname="ZeIRi"][contenteditable="true"]'
      )
      .first();

    const aiHelpBtn = dialog
      .locator('[command="sdt"], [data-tooltip*="Alt+H"], [aria-label*="Alt+H"]')
      .first();

    const compose: Compose = {
      page,
      dialog,
      body,
      subject,
      aiPromptBox,
      aiHelpBtn,
      async hasGemini() {
        return (await aiHelpBtn.count()) > 0 && (await aiHelpBtn.isVisible().catch(() => false));
      },
      setTemplates,
      async expand(keyword) {
        await body.click();
        await page.waitForTimeout(150);
        await page.keyboard.press('Control+End');
        await page.keyboard.type(keyword);
        await page.waitForTimeout(50);
        await page.keyboard.press('Tab');
      },
      async chipEmails() {
        // Only real chips: the collapsed-row summary also carries data-hovercard-id but can be stale
        const ids = await dialog
          .locator('div[role="option"][data-hovercard-id]')
          .evaluateAll((els) => els.map((e) => (e.getAttribute('data-hovercard-id') ?? '').toLowerCase()));
        return [...new Set(ids.filter((id) => id.includes('@')))];
      },
      async toSelectedCount() {
        // Gmail's own count of selected To recipients (e.g. "2 個選択されています" / "2 selected")
        const desc = await dialog
          .locator('input[peoplekit-id][aria-label*="To"]')
          .first()
          .getAttribute('aria-description');
        const m = desc?.match(/\d+/);
        return m ? Number(m[0]) : 0;
      },
      async addToRecipient(email) {
        const input = dialog.locator('input[aria-label*="To"], input[aria-label*="宛先"]').first();
        await input.click();
        // Gmail commits a typed address on Enter; a comma is just kept as text in the input
        await page.keyboard.type(email);
        await page.waitForTimeout(800);
        await page.keyboard.press('Enter');
        await expect.poll(() => compose.chipEmails()).toContain(email.toLowerCase());
      },
    };

    await use(compose);

    // Never send: discard the draft so test runs leave nothing behind
    const discard = dialog
      .locator(
        '[aria-label*="下書きを破棄"], [aria-label*="Discard draft"], [data-tooltip*="下書きを破棄"], [data-tooltip*="Discard draft"]'
      )
      .first();
    if (await discard.isVisible().catch(() => false)) {
      await discard.click().catch(() => {});
    }
    await setTemplates([]);
    await page.close();
  },

  teamsPlayground: async ({ ext }, use) => {
    const extensionId = new URL(ext.worker.url()).host;
    const page = await ext.context.newPage();
    page.on('console', (msg) => {
      console.log(`  [playground ${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`  [playground err] ${err.message}`);
    });

    await page.goto(`chrome-extension://${extensionId}/playground.html`);
    const editor = page.locator('#editor-teams');
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const logs = page.locator('#logs-container');

    const setTemplates = async (list: E2eTemplate[]) => {
      await setExtensionTemplates(ext.context, 'teams', list);
    };
    await setTemplates([]);

    const tp: TeamsPlayground = {
      page,
      editor,
      logs,
      setTemplates,
      async expand(keyword) {
        await editor.click();
        await page.waitForTimeout(100);
        await page.keyboard.press('Control+End');
        await page.keyboard.type(keyword);
        await page.waitForTimeout(50);
        await page.keyboard.press('Tab');
      },
    };

    await use(tp);
    await setTemplates([]);
    await page.close();
  },

  chatCompose: async ({ ext }, use) => {
    const setTemplates = async (list: E2eTemplate[]) => {
      await setExtensionTemplates(ext.context, 'chat', list);
    };
    await setTemplates([]);

    const page = await ext.context.newPage();
    page.on('console', (msg) => {
      console.log(`  [chat ${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`  [chat err] ${err.message}`);
    });

    await page.goto('https://chat.google.com/', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Not signed in to Google Chat. Run "npm run e2e:login" and sign in with a test account.');
    }

    const editor = page
      .locator(
        'div[contenteditable="true"][role="textbox"][jsname="yrriRe"], ' +
          'div.hj99tb[contenteditable="true"][role="textbox"], ' +
          'div[contenteditable="true"][role="textbox"][g_editable="true"], ' +
          'div[contenteditable="true"][role="textbox"][aria-multiline="true"], ' +
          'div.editable[contenteditable="true"][role="textbox"], ' +
          'div[contenteditable="true"][role="textbox"]'
      )
      .first();

    // エディタが表示されていない場合、会話リスト（備忘録または任意の会話）をクリックして開く
    if (!(await editor.isVisible().catch(() => false))) {
      const memo = page.locator('text="備忘録"').first();
      try {
        await memo.waitFor({ state: 'visible', timeout: 15_000 });
        await memo.click();
      } catch {
        const anyConv = page.locator('div[role="row"], div[role="listitem"]').first();
        if (await anyConv.isVisible({ timeout: 5000 }).catch(() => false)) {
          await anyConv.click();
        }
      }
    }

    await editor.waitFor({ state: 'visible', timeout: 30_000 });

    const chat: ChatCompose = {
      page,
      editor,
      setTemplates,
      async expand(keyword) {
        await this.clear();
        await editor.click();
        await page.waitForTimeout(100);
        await page.keyboard.type(keyword);
        await page.waitForTimeout(100);
        await page.keyboard.press('Tab');
      },
      async clear() {
        await editor.click();
        await page.waitForTimeout(100);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(100);
      },
    };

    // 開始前に既存の下書きを完全に消去
    await chat.clear();

    await use(chat);
    await chat.clear().catch(() => {});
    await setTemplates([]);
    await page.close();
  },
});

export { expect };
