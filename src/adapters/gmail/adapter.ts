import type { PlatformAdapter } from '@/core/adapter';
import { sleep } from '@/core/dom';
import { splitName } from '@/core/engine';
import type { GmailTemplate, Person, Template, TemplateVars } from '@/core/types';
import { findComposeRoot, findGmailBody } from './compose';
import { readFrom, selectFrom } from './from';
import { applyRecipientField, readRecipients } from './recipients';
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
      // Wait briefly for PeopleKit / Google Contacts to populate contact display name
      await sleep(100);
      toRecipients = readRecipients(root, 'to');
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
      } else if (firstTo.email) {
        // Fallback: local part of email
        person.firstName = firstTo.email.split('@')[0];
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

    // 2. To recipient field
    if (gt.to) {
      try {
        const ok = await applyRecipientField(root, 'to', gt.to);
        if (!ok) {
          failed.push('to');
        }
      } catch (err) {
        console.warn('[FluxSnip] Error applying To field:', err);
        failed.push('to');
      }
    }

    // 3. Cc recipient field
    if (gt.cc) {
      try {
        const ok = await applyRecipientField(root, 'cc', gt.cc);
        if (!ok) {
          failed.push('cc');
        }
      } catch (err) {
        console.warn('[FluxSnip] Error applying Cc field:', err);
        failed.push('cc');
      }
    }

    // 4. Bcc recipient field
    if (gt.bcc) {
      try {
        const ok = await applyRecipientField(root, 'bcc', gt.bcc);
        if (!ok) {
          failed.push('bcc');
        }
      } catch (err) {
        console.warn('[FluxSnip] Error applying Bcc field:', err);
        failed.push('bcc');
      }
    }

    // 5. Subject field
    if (gt.subject) {
      try {
        // Collect current vars for subject variable expansion (e.g. {{date}})
        const currentVars = await this.collectVars(editor);
        let uiLocale = 'ja';
        try {
          if (typeof browser !== 'undefined' && browser.i18n?.getUILanguage) {
            uiLocale = browser.i18n.getUILanguage() || 'ja';
          } else if (typeof navigator !== 'undefined' && navigator.language) {
            uiLocale = navigator.language;
          }
        } catch {
          uiLocale = 'ja';
        }
        const fullVars: TemplateVars = {
          now: new Date(),
          locale: uiLocale,
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

  insertOrder: ['dom', 'paste', 'clipboard'],
};
