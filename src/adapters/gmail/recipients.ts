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

function dispatchClick(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

/**
 * Ensures the recipient row (especially Cc or Bcc) is expanded and visible.
 */
export async function ensureFieldVisible(root: HTMLElement, kind: RecipientKind): Promise<boolean> {
  const { input: inputSelectors, toggle: toggleSelectors } = getFieldSelectors(kind);
  const existingInput = q<HTMLInputElement>(root, inputSelectors);

  if (existingInput && existingInput.offsetParent !== null) {
    return true;
  }

  // If collapsed, click the toggle button
  if (toggleSelectors.length > 0) {
    const toggleBtn = q<HTMLElement>(root, toggleSelectors);
    if (toggleBtn) {
      dispatchClick(toggleBtn);
      const visible = await waitFor(() => {
        const inp = q<HTMLInputElement>(root, inputSelectors);
        return inp && inp.offsetParent !== null ? inp : null;
      }, { timeout: 1500, interval: 40 });
      return !!visible;
    }
  }

  return !!existingInput;
}

/**
 * Removes all recipient chips for the given kind.
 */
export async function clearRecipients(root: HTMLElement, kind: RecipientKind): Promise<boolean> {
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
      dispatchClick(deleteBtn);
    } else {
      // Fallback: click chip then dispatch Backspace on input
      dispatchClick(firstChip);
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

    await sleep(40);
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

    // 1. Try insertText if supported
    let inserted = false;
    if (typeof document.execCommand === 'function') {
      try {
        inserted = document.execCommand('insertText', false, `${email}, `);
      } catch {
        inserted = false;
      }
    }

    if (!inserted) {
      inputEl.value = `${email}, `;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 2. Trigger Enter keydown for chip conversion
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

    await sleep(60);
  }

  // Final blur / focus transition to trigger pending chips
  inputEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await sleep(100);

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
