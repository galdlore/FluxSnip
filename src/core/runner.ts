import type { PlatformAdapter } from './adapter';
import { isRangeInside, restoreRange } from './dom';
import { renderTemplate } from './engine';
import { getUiLocale, tOr } from './i18n';
import { insertContent } from './inserter';
import type { GmailTemplate, Template, TemplateVars } from './types';
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
    if (!isRangeInside(editor, range)) {
      showToast(tOr('toast_range_lost', 'The insertion point was lost, so nothing was inserted.'), 'error');
      return;
    }

    const isPlain = adapter.isPlainEditor?.(editor) ?? false;

    // 1. Apply non-body fields if supported (e.g. Gmail headers)
    // If editor is a plain input like Gemini prompt box, skip header fields to keep focus intact
    if (adapter.applyFields && !isPlain) {
      try {
        const fieldResult = await adapter.applyFields(editor, template);
        if (fieldResult.failed && fieldResult.failed.length > 0) {
          const names = fieldResult.failed
            .map((field) => tOr(`field_label_${field}`, field))
            .join(', ');
          showToast(
            tOr('toast_fields_failed', `Could not set some fields: ${names}`, names),
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

    const vars: TemplateVars = {
      now: new Date(),
      locale: getUiLocale(),
      ...collectedVars,
    };

    // 3. Render template AST and formats
    // If expanding directly inside Gemini prompt box and template has aiPrompt, use it as body
    let effectiveTemplate = template;
    const isAiBox = isPlain && adapter.platform === 'gmail';
    const gt = template as Partial<GmailTemplate>;
    if (isAiBox && gt.aiPrompt && gt.aiPrompt.trim().length > 0) {
      effectiveTemplate = {
        ...template,
        bodyAst: [{ t: 'p', c: [{ t: '#text', v: gt.aiPrompt }] }],
      };
    }

    const rendered = renderTemplate(effectiveTemplate, vars);

    // 4. Restore range in editor
    let targetEditor = editor;
    if (!targetEditor.isConnected && adapter.findEditor) {
      const activeEl = document.activeElement;
      const reFound = adapter.findEditor(activeEl);
      if (reFound && reFound.isConnected) {
        targetEditor = reFound;
      }
    }
    if (!restoreRange(targetEditor, range)) {
      showToast(tOr('toast_range_lost', 'The insertion point was lost, so nothing was inserted.'), 'error');
      return;
    }

    // 5. Insert content into editor
    const isChat = adapter.platform === 'chat';
    const insertOrder = adapter.getInsertOrder
      ? adapter.getInsertOrder(targetEditor)
      : adapter.insertOrder;

    const result = await insertContent(
      targetEditor,
      rendered,
      insertOrder,
      isChat,
      isPlain
    );

    if (!result.ok) {
      showToast(
        tOr('toast_insert_failed', 'Failed to insert template content.'),
        'error'
      );
      return;
    }

    // 6. Post-insertion triggers (e.g. Gemini AI auto-submit)
    if (adapter.afterInsert) {
      try {
        await adapter.afterInsert(targetEditor, template, vars);
      } catch (err) {
        console.warn('[FluxSnip] Error during afterInsert:', err);
      }
    }
  } catch (err) {
    console.warn('[FluxSnip] Unexpected error during runTemplate:', err);
    showToast(
      tOr('toast_unexpected_error', 'An unexpected error occurred during insertion.'),
      'error'
    );
  }
}
