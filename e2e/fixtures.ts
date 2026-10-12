import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test as base, type BrowserContext, type Locator, type Page, type Worker } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILE_DIR = process.env.FLUXSNIP_E2E_PROFILE ?? path.join(ROOT, '.e2e-profile');
const EXTENSION_DIR = path.join(ROOT, '.output', 'chrome-mv3');

export interface E2eTemplate {
  keyword: string;
  text: string;
  to?: { mode: 'replace' | 'append'; emails: string[] };
  cc?: { mode: 'replace' | 'append'; emails: string[] };
  subject?: { mode: 'replace' | 'ifEmpty'; value: string };
}

function toStoredTemplate(t: E2eTemplate, i: number) {
  const escaped = t.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    id: `e2e-${i}-${t.keyword}`,
    platform: 'gmail',
    name: `E2E ${t.keyword}`,
    keyword: t.keyword,
    tags: ['e2e'],
    bodyHtml: `<p>${escaped}</p>`,
    bodyAst: [{ t: 'p', c: [{ t: '#text', v: t.text }] }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(t.to ? { to: t.to } : {}),
    ...(t.cc ? { cc: t.cc } : {}),
    ...(t.subject ? { subject: t.subject } : {}),
  };
}

export interface Compose {
  page: Page;
  dialog: Locator;
  body: Locator;
  subject: Locator;
  /** Replaces every Gmail template in the extension's storage. */
  setTemplates(list: E2eTemplate[]): Promise<void>;
  /** Types a keyword at the end of the body and presses Tab. */
  expand(keyword: string): Promise<void>;
  /** Addresses currently shown as recipient chips anywhere in this compose window. */
  chipEmails(): Promise<string[]>;
  /** Number of To recipients according to Gmail's own state (the input's aria-description). */
  toSelectedCount(): Promise<number>;
  addToRecipient(email: string): Promise<void>;
}

type WorkerFixtures = { ext: { context: BrowserContext; worker: Worker } };
type TestFixtures = { compose: Compose };

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
      const stored = list.map(toStoredTemplate);
      // Runs inside the extension's service worker, where `chrome` exists
      await ext.worker.evaluate(async (templates) => {
        const api = (globalThis as unknown as {
          chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };
        }).chrome;
        await api.storage.local.set({ 'templates:gmail': templates });
      }, stored);
    };
    await setTemplates([]);

    const page = await ext.context.newPage();
    page.on('console', (msg) => {
      if (msg.text().includes('[FluxSnip]')) console.log(`  [page ${msg.type()}] ${msg.text()}`);
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

    const compose: Compose = {
      page,
      dialog,
      body,
      subject,
      setTemplates,
      async expand(keyword) {
        await body.click();
        await page.keyboard.press('Control+End');
        await page.keyboard.type(keyword);
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
});

export { expect };
