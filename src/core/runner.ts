import type { PlatformAdapter } from './adapter';
import { restoreRange } from './dom';
import { renderTemplate } from './engine';
import { t } from './i18n';
import { insertContent } from './inserter';
import type { Template, TemplateVars } from './types';
import { showToast } from './ui/toast';

/**
 * Executes full template insertion pipeline:
 * 1. Restores caret/selection to target range
 * 2. Applies adapter fields (Gmail: To, Cc, Bcc, Subject, From)
 * 3. Collects variables and renders template
 * 4. Inserts content using adapter's preferred strategy
 * 5. Handles errors and user feedback via toasts
 */
export async function runTemplate(
  adapter: PlatformAdapter,
  editor: HTMLElement,
  template: Template,
  range: Range
): Promise<void> {
  try {
    // 1. Apply non-body fields if supported (e.g. Gmail headers)
    if (adapter.applyFields) {
      try {
        const fieldResult = await adapter.applyFields(editor, template);
        if (fieldResult.failed && fieldResult.failed.length > 0) {
          const names = fieldResult.failed.join(', ');
          showToast(
            t('toast_fields_failed', names) || `Could not set some fields: ${names}`,
            'warn'
          );
        }
      } catch (err) {
        console.warn('[FluxSnip] Failed applying fields:', err);
      }
    }

    // 2. Collect dynamic variables
    let collectedVars: Partial<TemplateVars> = {};
    try {
      collectedVars = await adapter.collectVars(editor);
    } catch (err) {
      console.warn('[FluxSnip] Failed collecting variables:', err);
    }

    let uiLocale = 'en';
    try {
      if (typeof browser !== 'undefined' && browser.i18n?.getUILanguage) {
        uiLocale = browser.i18n.getUILanguage();
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        uiLocale = navigator.language;
      }
    } catch {
      // Fallback
    }

    const vars: TemplateVars = {
      now: new Date(),
      locale: uiLocale,
      ...collectedVars,
    };

    // 3. Render template AST and formats
    const rendered = renderTemplate(template, vars);

    // 4. Restore range in editor
    let targetEditor = editor;
    if (!targetEditor.isConnected && adapter.findEditor) {
      const activeEl = document.activeElement;
      const reFound = adapter.findEditor(activeEl);
      if (reFound && reFound.isConnected) {
        targetEditor = reFound;
      }
    }
    restoreRange(targetEditor, range);

    // 5. Insert content into editor
    const isChat = adapter.platform === 'chat';
    const result = await insertContent(targetEditor, rendered, adapter.insertOrder, isChat);

    if (!result.ok) {
      showToast(
        t('toast_insert_failed') || 'Failed to insert template content.',
        'error'
      );
    }
  } catch (err) {
    console.warn('[FluxSnip] Unexpected error during runTemplate:', err);
    showToast(
      t('toast_unexpected_error') || 'An unexpected error occurred during insertion.',
      'error'
    );
  }
}
