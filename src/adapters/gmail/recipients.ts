import { sleep, waitFor } from '@/core/dom';
import type { RecipientField } from '@/core/types';
import { matchesAny, q, qAll, SEL } from './selectors';

export type RecipientKind = 'to' | 'cc' | 'bcc';

function getFieldSelectors(kind: RecipientKind) {
  if (kind === 'cc') {
    return {
      input: SEL.recipients.ccInput,
      toggle: SEL.recipients.ccToggle,
    };
  }
  if (kind === 'bcc') {
    return {
      input: SEL.recipients.bccInput,
      toggle: SEL.recipients.bccToggle,
    };
  }
  return {
    input: SEL.recipients.toInput,
    toggle: [] as readonly string[],
  };
}

function dispatchInteraction(el: HTMLElement): void {
  try {
    el.focus();
  } catch {}

  const opts = { bubbles: true, cancelable: true, view: window };
  if (typeof PointerEvent === 'function') {
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
  }
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  try {
    el.click();
  } catch {
    el.dispatchEvent(new MouseEvent('click', opts));
  }
}

function getRecipientContainer(root: HTMLElement, kind: RecipientKind): HTMLElement | null {
  const { input: inputSelectors } = getFieldSelectors(kind);
  const inputEl = q<HTMLInputElement>(root, inputSelectors);
  if (inputEl) {
    // Find closest container wrapping input and its chips
    const container = inputEl.closest('div.wO, div.anm, tr.bzf, div.afA, div.aH9')?.parentElement || inputEl.parentElement;
    return container as HTMLElement || inputEl;
  }
  return null;
}

/**
 * Reads all currently selected recipients for the specified kind.
 */
export function readRecipients(root: HTMLElement, kind: RecipientKind): { email: string; name?: string }[] {
  const container = getRecipientContainer(root, kind);
  if (!container) return [];

  const results: { email: string; name?: string }[] = [];
  const chips = qAll(container, SEL.recipients.chip);

  for (const chip of chips) {
    let email = '';
    let name = '';

    // 1. Email extraction
    const emailEl = q(chip, SEL.recipients.chipEmail);
    if (emailEl) {
      email = emailEl.getAttribute('email') || emailEl.getAttribute('data-hovercard-id') || emailEl.textContent?.trim() || '';
    } else {
      email = chip.getAttribute('email') || chip.getAttribute('data-hovercard-id') || '';
    }

    // 2. Name extraction
    const nameEl = q(chip, SEL.recipients.chipName);
    if (nameEl) {
      name = nameEl.getAttribute('name') || nameEl.textContent?.trim() || '';
    } else {
      name = chip.getAttribute('name') || '';
    }

    // Clean up email
    const match = email.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (match) {
      email = match[0];
    }

    if (email) {
      results.push({ email, name: name || undefined });
    }
  }

  return results;
}

let _layoutSupported: boolean | null = null;
function isLayoutEngineSupported(): boolean {
  if (_layoutSupported !== null) return _layoutSupported;
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }
  const testDiv = document.createElement('div');
  testDiv.style.cssText = 'position:static;display:block;';
  document.body.appendChild(testDiv);
  _layoutSupported = testDiv.offsetParent !== null;
  testDiv.remove();
  return _layoutSupported;
}

export function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (!el.isConnected) return false;
  if (el.style.display === 'none') return false;
  if (el.closest('[style*="display: none"], [style*="display:none"]')) return false;

  if (isLayoutEngineSupported()) {
    return el.offsetParent !== null;
  }
  return true;
}

/**
 * Ensures the recipient row (especially Cc or Bcc) is expanded and visible.
 */
export async function ensureFieldVisible(root: HTMLElement, kind: RecipientKind): Promise<boolean> {
  const { input: inputSelectors, toggle: toggleSelectors } = getFieldSelectors(kind);
  let existingInput = q<HTMLInputElement>(root, inputSelectors);

  if (existingInput && isElementVisible(existingInput)) {
    return true;
  }

  // 1. Expand collapsed To recipient row if table (div.fX) is hidden
  const collapsedHeader = q<HTMLElement>(root, SEL.recipients.collapsedHeader);
  if (collapsedHeader && isElementVisible(collapsedHeader)) {
    // Interact with both label child and container
    const labelChild = q<HTMLElement>(collapsedHeader, ['.oL.aDm', '.oL', 'div']);
    if (labelChild) {
      dispatchInteraction(labelChild);
    }
    dispatchInteraction(collapsedHeader);

    // Wait briefly for Gmail to expand the table
    existingInput = await waitFor(() => {
      const inp = q<HTMLInputElement>(root, SEL.recipients.toInput);
      return inp && isElementVisible(inp) ? inp : null;
    }, { timeout: 350, interval: 30 }) ?? existingInput;

    // Fallback: If table is still display: none, forcefully reveal it and focus input
    if (!existingInput || !isElementVisible(existingInput)) {
      const fxTable = q<HTMLElement>(root, ['div.fX.aiL', 'div.fX']);
      if (fxTable) {
        fxTable.style.display = '';
        collapsedHeader.style.display = 'none';
        const inp = q<HTMLInputElement>(root, SEL.recipients.toInput);
        if (inp) {
          try {
            inp.focus();
          } catch {}
          existingInput = inp;
        }
      }
    }
  }

  if (kind === 'to') {
    const toInput = q<HTMLInputElement>(root, SEL.recipients.toInput);
    return !!toInput && isElementVisible(toInput);
  }

  // 2. If Cc or Bcc, click the toggle button after ensuring To row is expanded
  if (toggleSelectors.length > 0) {
    const toggleBtn = q<HTMLElement>(root, toggleSelectors);
    if (toggleBtn) {
      dispatchInteraction(toggleBtn);
      const visible = await waitFor(() => {
        const inp = q<HTMLInputElement>(root, inputSelectors);
        return inp && isElementVisible(inp) ? inp : null;
      }, { timeout: 400, interval: 30 });
      return !!visible;
    }
  }

  const finalInput = q<HTMLInputElement>(root, inputSelectors);
  return !!finalInput && isElementVisible(finalInput);
}

/**
 * Removes all recipient chips for the given kind.
 */
export async function clearRecipients(root: HTMLElement, kind: RecipientKind): Promise<boolean> {
  await ensureFieldVisible(root, kind);

  const container = getRecipientContainer(root, kind);
  if (!container) return true;

  let maxAttempts = 50;
  while (maxAttempts-- > 0) {
    const chips = qAll(container, SEL.recipients.chip);
    if (chips.length === 0) {
      return true;
    }

    const firstChip = chips[0];
    if (!firstChip) break;

    // Try clicking chip's delete button
    const deleteBtn = q<HTMLElement>(firstChip, SEL.recipients.chipDeleteBtn);
    if (deleteBtn) {
      dispatchInteraction(deleteBtn);
    } else {
      // Fallback: click chip then dispatch Backspace on input
      dispatchInteraction(firstChip);
      const { input: inputSelectors } = getFieldSelectors(kind);
      const input = q<HTMLInputElement>(root, inputSelectors);
      if (input) {
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
      }
    }

    // If still attached after a tick (e.g. test environment or stubborn DOM), remove directly
    if (firstChip.isConnected) {
      firstChip.remove();
    }

    await sleep(25);
  }

  return readRecipients(root, kind).length === 0;
}

/**
 * Adds new recipient email addresses to the given recipient field.
 */
export async function addRecipients(root: HTMLElement, kind: RecipientKind, emails: string[]): Promise<boolean> {
  if (emails.length === 0) return true;

  const isVisible = await ensureFieldVisible(root, kind);
  if (!isVisible) return false;

  const { input: inputSelectors } = getFieldSelectors(kind);
  const inputEl = q<HTMLInputElement>(root, inputSelectors);
  if (!inputEl) return false;

  for (const email of emails) {
    inputEl.focus();
    await sleep(15);

    // If inputEl did not gain active focus, try interacting with it directly
    if (document.activeElement !== inputEl) {
      dispatchInteraction(inputEl);
      inputEl.focus();
      await sleep(15);
    }

    // Dismiss any autocomplete popup suggestions before typing
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));

    // Guard: Only use execCommand if inputEl actually gained focus!
    // Prevents leaking email into the email body editor.
    const hasFocus = document.activeElement === inputEl;
    let inserted = false;

    // 1. Insert pure email address
    if (hasFocus && typeof document.execCommand === 'function') {
      try {
        inserted = document.execCommand('insertText', false, email);
      } catch {
        inserted = false;
      }
    }

    if (!inserted) {
      inputEl.value = email;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await sleep(20);

    // 2. Commit as chip using comma delimiter
    // IMPORTANT: Do NOT send Enter key! Enter selects the top suggestion from autocomplete!
    // In Gmail PeopleKit, typing comma or dispatching Comma triggers chip conversion cleanly.
    let commaInserted = false;
    if (document.activeElement === inputEl && typeof document.execCommand === 'function') {
      try {
        commaInserted = document.execCommand('insertText', false, ',');
      } catch {
        commaInserted = false;
      }
    }

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: ',', code: 'Comma', keyCode: 188, which: 188, bubbles: true }));

    if (!commaInserted) {
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ',' }));
    }

    await sleep(20);

    // 3. Native blur to finalize chip creation and dismiss dropdown
    try {
      inputEl.blur();
    } catch {}
    inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    await sleep(30);
  }

  return true;
}

/**
 * Applies a RecipientField configuration (replace or append) to Gmail.
 */
export async function applyRecipientField(
  root: HTMLElement,
  kind: RecipientKind,
  f: RecipientField
): Promise<boolean> {
  if (f.mode === 'replace') {
    await clearRecipients(root, kind);
    if (f.emails.length > 0) {
      return await addRecipients(root, kind, f.emails);
    }
    return true;
  }

  if (f.mode === 'append') {
    const existing = readRecipients(root, kind).map((r) => r.email.toLowerCase());
    const newEmails = f.emails.filter((em) => !existing.includes(em.toLowerCase()));
    if (newEmails.length > 0) {
      return await addRecipients(root, kind, newEmails);
    }
    return true;
  }

  return true;
}
