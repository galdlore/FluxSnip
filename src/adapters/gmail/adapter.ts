import type { PlatformAdapter } from '@/core/adapter';
import { sleep, waitFor } from '@/core/dom';
import { renderTemplate, splitName } from '@/core/engine';
import { getUiLocale } from '@/core/i18n';
import { getFieldWaitMs } from '@/core/timing';
import { insertContent } from '@/core/inserter';
import type { GmailTemplate, InsertMethod, Person, Template, TemplateVars } from '@/core/types';
import { findComposeRoot, findGmailBody, isAiPromptBox, triggerAiSubmit } from './compose';
import { readFrom, selectFrom } from './from';
import { applyRecipientField, readRecipients } from './recipients';
import { q, SEL } from './selectors';
import { applySubject } from './subject';

/**
 * Platform adapter for Gmail web interface (mail.google.com).
 * Handles editor resolution, body insertion, To/Cc/Bcc, subject, and From alias management.
 */
export const gmailAdapter: PlatformAdapter = {
  platform: 'gmail',

  findEditor(node: Node | null): HTMLElement | null {
    return findGmailBody(node);
  },

  async collectVars(editor: HTMLElement): Promise<Partial<TemplateVars>> {
    const root = findComposeRoot(editor);
    if (!root) return {};

    const vars: Partial<TemplateVars> = {};

    // 1. First To recipient
    let toRecipients = readRecipients(root, 'to');
    if (toRecipients.length > 0 && !toRecipients[0]?.name) {
      // PeopleKit may fill in the display name shortly; the name is optional, so no extended wait
      toRecipients =
        (await waitFor(
          () => {
            const list = readRecipients(root, 'to');
            return list[0]?.name ? list : null;
          },
          { timeout: getFieldWaitMs(), interval: 15 }
        )) ?? readRecipients(root, 'to');
    }

    const firstTo = toRecipients[0];
    if (firstTo) {
      const person: Person = {
        email: firstTo.email,
        name: firstTo.name,
      };
      if (firstTo.name) {
        const { firstName, lastName } = splitName(firstTo.name);
        person.firstName = firstName;
        person.lastName = lastName;
      }
      vars.to = person;
    }

    // 2. Selected From
    const fromConfig = readFrom(root);
    if (fromConfig) {
      vars.from = {
        email: fromConfig.email,
        name: fromConfig.name,
      };
    }

    return vars;
  },

  async applyFields(editor: HTMLElement, t: Template): Promise<{ failed: string[] }> {
    if (t.platform !== 'gmail') {
      return { failed: [] };
    }

    const gt = t as GmailTemplate;
    const root = findComposeRoot(editor);
    if (!root) {
      return { failed: ['compose_root_not_found'] };
    }

    const failed: string[] = [];

    // 1. From alias (must be applied first because changing From triggers Gmail signature replacement)
    if (gt.from) {
      try {
        const ok = await selectFrom(root, gt.from);
        if (!ok) {
          failed.push('from');
        }
      } catch (err) {
        console.warn('[FluxSnip] Error applying From alias:', err);
        failed.push('from');
      }
    }

    // 2-4. To / Cc / Bcc
    for (const kind of ['to', 'cc', 'bcc'] as const) {
      const field = gt[kind];
      if (!field) continue;
      try {
        const result = await applyRecipientField(root, kind, field);
        if (result === 'failed') failed.push(kind);
        else if (result === 'inconsistent') failed.push(`${kind}_inconsistent`);
      } catch (err) {
        // The field may have been left half-changed
        console.warn(`[FluxSnip] Error applying ${kind} field:`, err);
        failed.push(`${kind}_inconsistent`);
      }
    }

    // 5. Subject field
    if (gt.subject) {
      try {
        // Collect current vars for subject variable expansion (e.g. {{date}})
        const currentVars = await this.collectVars(editor);
        const fullVars: TemplateVars = {
          now: new Date(),
          locale: getUiLocale(),
          ...currentVars,
        };
        const ok = await applySubject(root, gt.subject, fullVars);
        if (!ok) {
          failed.push('subject');
        }
      } catch (err) {
        console.warn('[FluxSnip] Error applying Subject:', err);
        failed.push('subject');
      }
    }

    return { failed };
  },

  insertOrder: ['html', 'dom', 'paste', 'clipboard'],

  getInsertOrder(editor: HTMLElement): InsertMethod[] {
    if (isAiPromptBox(editor)) {
      return ['insertText', 'paste', 'clipboard'];
    }
    // 'html' first so Ctrl+Z undoes an expansion; 'dom' bypasses the undo history
    return ['html', 'dom', 'paste', 'clipboard'];
  },

  isPlainEditor(editor: HTMLElement): boolean {
    return isAiPromptBox(editor);
  },

  async afterInsert(editor: HTMLElement, template: Template, vars: TemplateVars): Promise<void> {
    if (template.platform !== 'gmail') return;
    const gt = template as GmailTemplate;
    if (isAiPromptBox(editor)) {
      if (gt.autoSubmitAi) {
        await sleep(150);
        triggerAiSubmit(editor);
      }
      return;
    }

    // When expanded in regular compose body and template defines aiPrompt:
    // Open Gemini Alt+H panel and populate the prompt
    if (gt.aiPrompt && gt.aiPrompt.trim().length > 0) {
      const root = findComposeRoot(editor);
      if (root) {
        // If formatting options toolbar or popup is active, dismiss it first
        const formatToggle = q<HTMLElement>(root, SEL.formatToolbarToggleActive);
        if (formatToggle) {
          formatToggle.click();
          await sleep(100);
        }

        const sdtBtn = q<HTMLElement>(root, SEL.aiHelpBtn);
        if (sdtBtn) {
          sdtBtn.click();
        }

        let promptBox = await waitFor(
          () => {
            const el = q<HTMLElement>(root, SEL.aiPromptBox);
            return el && (el.isContentEditable || el.getAttribute('contenteditable') === 'true') ? el : null;
          },
          { timeout: 3000, interval: 50 }
        );

        // Fallback: if panel didn't open from initial click, try safe fallback
        if (!promptBox) {
          const isBlank = (editor.textContent?.trim() || '').length === 0;
          if (isBlank) {
            // In a blank compose body, pressing '/' opens the Help me write prompt box
            try {
              editor.focus();
            } catch {
              // Ignore focus error
            }
            editor.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: '/',
                code: 'Slash',
                bubbles: true,
                cancelable: true,
              })
            );
          } else if (sdtBtn) {
            // In non-blank body, re-click sdtBtn (avoid Alt+H as it triggers automatic proofreading)
            sdtBtn.click();
          }

          promptBox = await waitFor(
            () => {
              const el = q<HTMLElement>(root, SEL.aiPromptBox);
              return el && (el.isContentEditable || el.getAttribute('contenteditable') === 'true') ? el : null;
            },
            { timeout: 1500, interval: 50 }
          );
        }

        if (promptBox) {
          // Strictly focus promptBox and position selection inside it to prevent leaking to mail body
          try {
            promptBox.focus();
            const doc = promptBox.ownerDocument || document;
            const win = doc.defaultView || window;
            const sel = win.getSelection();
            if (sel) {
              const r = doc.createRange();
              r.selectNodeContents(promptBox);
              r.collapse(false);
              sel.removeAllRanges();
              sel.addRange(r);
            }
          } catch {
            // Ignore selection setup error
          }

          const aiTpl: Template = {
            ...template,
            bodyAst: [{ t: 'p', c: [{ t: '#text', v: gt.aiPrompt }] }],
          };
          const aiRendered = renderTemplate(aiTpl, vars);
          await insertContent(promptBox, aiRendered, ['insertText', 'paste'], false, true);

          if (gt.autoSubmitAi) {
            await sleep(200);
            triggerAiSubmit(promptBox);
          }
        }
      }
    }
  },
};
