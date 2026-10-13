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
function clickGmailButton(el: HTMLElement) {
  const doc = el.ownerDocument || document;
  const win = doc.defaultView || window;
  const opts: MouseEventInit = { bubbles: true, cancelable: true, view: win, buttons: 1 };
  try {
    el.dispatchEvent(new win.PointerEvent('pointerdown', opts));
  } catch {
    // Ignore PointerEvent fallback
  }
  el.dispatchEvent(new win.MouseEvent('mousedown', opts));
  try {
    el.dispatchEvent(new win.PointerEvent('pointerup', opts));
  } catch {
    // Ignore
  }
  el.dispatchEvent(new win.MouseEvent('mouseup', opts));
  el.click();
}

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
      return ['insertText', 'dom', 'paste', 'clipboard'];
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
      await sleep(150);
      const root = findComposeRoot(editor);
      const dialogEl = root?.closest<HTMLElement>('div[role="dialog"], div[role="region"]') || root;
      if (root) {
        let promptBox =
          q<HTMLElement>(root, SEL.aiPromptBox) ||
          (dialogEl ? q<HTMLElement>(dialogEl, SEL.aiPromptBox) : null);

        let sdtBtn = q<HTMLElement>(root, SEL.aiHelpBtn);
        if (!sdtBtn && dialogEl) {
          sdtBtn = q<HTMLElement>(dialogEl, SEL.aiHelpBtn);
        }

        // Check if Gemini prompt box or help panel is already open to avoid toggling it closed
        const isAlreadyOpen =
          Boolean(promptBox && (promptBox.isContentEditable || promptBox.getAttribute('contenteditable') === 'true')) ||
          Boolean(sdtBtn && (sdtBtn.getAttribute('aria-expanded') === 'true' || sdtBtn.classList.contains(SEL.aiHelpBtnActiveClass)));

        if (!isAlreadyOpen) {
          // If formatting options toolbar or popup is active, dismiss it first
          const formatToggle =
            q<HTMLElement>(root, SEL.formatToolbarToggleActive) ||
            (dialogEl ? q<HTMLElement>(dialogEl, SEL.formatToolbarToggleActive) : null);
          if (formatToggle) {
            clickGmailButton(formatToggle);
            await sleep(250);
          }

          if (sdtBtn) {
            clickGmailButton(sdtBtn);
          }
        }

        if (!promptBox) {
          promptBox = await waitFor(
            () => {
              const el =
                q<HTMLElement>(root, SEL.aiPromptBox) ||
                (dialogEl ? q<HTMLElement>(dialogEl, SEL.aiPromptBox) : null);
              return el && (el.isContentEditable || el.getAttribute('contenteditable') === 'true') ? el : null;
            },
            { timeout: 3000, interval: 50 }
          );
        }

        // Fallback: if panel didn't open from initial click and wasn't already open, try safe fallback
        if (!promptBox && !isAlreadyOpen) {
          const isBlank = (editor.textContent?.trim() || '').length === 0;
          if (isBlank) {
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
            clickGmailButton(sdtBtn);
          }

          promptBox = await waitFor(
            () => {
              const el =
                q<HTMLElement>(root, SEL.aiPromptBox) ||
                (dialogEl ? q<HTMLElement>(dialogEl, SEL.aiPromptBox) : null);
              return el && (el.isContentEditable || el.getAttribute('contenteditable') === 'true') ? el : null;
            },
            { timeout: 1500, interval: 50 }
          );
        }

        if (promptBox) {
          await sleep(80);
          // Strictly focus promptBox and select all contents to overwrite cleanly
          try {
            promptBox.focus();
            const doc = promptBox.ownerDocument || document;
            const win = doc.defaultView || window;
            const sel = win.getSelection();
            if (sel) {
              const r = doc.createRange();
              r.selectNodeContents(promptBox);
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
          await insertContent(promptBox, aiRendered, ['insertText', 'dom', 'paste'], false, true);

          // Keep caret inside promptBox after insertion
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

          if (gt.autoSubmitAi) {
            await sleep(200);
            triggerAiSubmit(promptBox);
          }
        }
      }
    }
  },
};
