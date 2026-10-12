import { sleep } from '@/core/dom';
import { waitField } from '@/core/timing';
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
    // Find closest container wrapping input and its chips (including PeopleKit listbox)
    const container =
      inputEl.closest('div[role="listbox"], div.wO, div.anm, tr.bzf, div.afA, div.aH9')?.parentElement ||
      inputEl.parentElement;
    return (container as HTMLElement) || inputEl;
  }
  return null;
}

/**
 * Resolves contact display name from PeopleKit suggestion items / hovercards in the compose root or document.
 */
export function resolveContactName(root: HTMLElement, email: string): string | undefined {
  if (!email) return undefined;
  const escapedEmail = email.replace(/["\\]/g, '\\$&');
  const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null);

  const candidateSelectors = [
    `[data-hovercard-id="${escapedEmail}"][data-name]`,
    `[data-name][data-hovercard-id="${escapedEmail}"]`,
    `[pkd-target*="${escapedEmail}"] [data-name]`,
    `[pkd-target*="${escapedEmail}"] .aL8`,
    `[data-hovercard-id="${escapedEmail}"] .aL8`,
    `div.agH[data-hovercard-id="${escapedEmail}"]`,
    `div.agJ[pkd-target*="${escapedEmail}"]`,
  ];

  const contexts = doc ? [root, doc] : [root];
  for (const ctx of contexts) {
    for (const sel of candidateSelectors) {
      try {
        const el = ctx.querySelector(sel);
        if (el) {
          const dataName = el.getAttribute('data-name')?.trim();
          if (dataName && !dataName.includes('@')) {
            return dataName;
          }
          const text = el.textContent?.trim();
          if (text && !text.includes('@')) {
            return text;
          }
          const nameChild = el.querySelector('.aL8, [data-name]');
          if (nameChild) {
            const childName = nameChild.getAttribute('data-name')?.trim() || nameChild.textContent?.trim();
            if (childName && !childName.includes('@')) {
              return childName;
            }
          }
        }
      } catch {
        // Ignore query errors
      }
    }
  }

  return undefined;
}

/**
 * Reads all currently selected recipients for the specified kind.
 */
export function readRecipients(root: HTMLElement, kind: RecipientKind): { email: string; name?: string }[] {
  const container = getRecipientContainer(root, kind);
  const chips = container ? qAll(container, SEL.recipients.chip) : [];

  // Fallback: If no chips found in container (or kind is 'to' and collapsed), check collapsed header
  if (chips.length === 0 && kind === 'to') {
    const collapsedHeader = q<HTMLElement>(root, SEL.recipients.collapsedHeader);
    if (collapsedHeader) {
      const headerChips = qAll(collapsedHeader, ['span[email]', 'span[data-hovercard-id]', 'span']);
      for (const span of headerChips) {
        const emailAttr = span.getAttribute('email') || span.getAttribute('data-hovercard-id') || '';
        const match = emailAttr.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (match) {
          const rawText = span.textContent?.trim() || '';
          // Clean "(...)" from display name, e.g. "山田 太郎 (gmail.com)" -> "山田 太郎"
          let cleanName = rawText.replace(/\s*[\(（][^\)）]*[\)）]\s*/g, '').replace(match[0], '').trim();
          if (!cleanName || cleanName.toLowerCase() === match[0].toLowerCase()) {
            cleanName = resolveContactName(root, match[0]) || '';
          }
          return [{ email: match[0], name: cleanName || undefined }];
        }
      }
    }
  }

  const results: { email: string; name?: string }[] = [];
  const seenEmails = new Set<string>();

  for (const chip of chips) {
    let rawEmail = chip.getAttribute('data-hovercard-id') || chip.getAttribute('email') || '';
    if (!rawEmail) {
      const emailAttrEl = q(chip, ['[data-hovercard-id]', '[email]']);
      if (emailAttrEl) {
        rawEmail = emailAttrEl.getAttribute('data-hovercard-id') || emailAttrEl.getAttribute('email') || '';
      }
    }

    let rawName = chip.getAttribute('data-name') || chip.getAttribute('name') || '';
    if (!rawName) {
      const nameAttrEl = q(chip, ['[data-name]', '[name]']);
      if (nameAttrEl) {
        rawName = nameAttrEl.getAttribute('data-name') || nameAttrEl.getAttribute('name') || '';
      }
    }

    // Check text contents of candidate elements (.akl, .akk, etc.)
    const textEls = Array.from(chip.querySelectorAll('.akl, .akk, [data-name], [name], div, span'));
    for (const el of textEls) {
      const text = el.textContent?.trim() || '';
      if (!text) continue;

      if (!rawEmail && text.includes('@')) {
        const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (m) rawEmail = m[0];
      } else if (!rawName && !text.includes('@')) {
        const cleaned = text.replace(/\s*[\(（][^\)）]*[\)）]\s*/g, '').trim();
        if (cleaned && !cleaned.includes('@')) {
          rawName = cleaned;
        }
      }
    }

    const emailMatch = rawEmail.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (emailMatch) {
      const email = emailMatch[0];
      let name = rawName.replace(/\s*[\(（][^\)）]*[\)）]\s*/g, '').trim();
      if (name.toLowerCase() === email.toLowerCase()) {
        name = '';
      }
      if (!name) {
        name = resolveContactName(root, email) || '';
      }
      if (!seenEmails.has(email.toLowerCase())) {
        seenEmails.add(email.toLowerCase());
        results.push({ email, name: name || undefined });
      }
    }
  }

  // Extra fallback: If results is empty and there's text or mirror span in the input field
  if (results.length === 0) {
    const inputEl = q<HTMLInputElement>(root, getFieldSelectors(kind).input);
    const mirrorSpan = container ? q<HTMLElement>(container, ['span.aIa.aFx', 'span[peoplekit-id]']) : null;
    const pendingText = (mirrorSpan?.textContent || inputEl?.value || '').trim();
    const emailMatch = pendingText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (emailMatch) {
      const email = emailMatch[0];
      const name = resolveContactName(root, email);
      results.push({ email, name });
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

    // No forced reveal (editing Gmail's styles) if this fails: the UI would show a row Gmail
    // considers collapsed. Real Gmail expands on the click (verified by e2e, 2026-10).
    const expanded = await waitField(() => {
      const inp = q<HTMLInputElement>(root, SEL.recipients.toInput);
      return inp && isElementVisible(inp) ? inp : null;
    });
    if (!expanded) {
      console.warn('[FluxSnip] To row did not expand on click.');
      return false;
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
      const visible = await waitField(() => {
        const inp = q<HTMLInputElement>(root, inputSelectors);
        return inp && isElementVisible(inp) ? inp : null;
      });
      return !!visible;
    }
  }

  const finalInput = q<HTMLInputElement>(root, inputSelectors);
  return !!finalInput && isElementVisible(finalInput);
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function chipEmail(chip: Element): string | null {
  const attrEl = q(chip, ['[data-hovercard-id]', '[email]']);
  const raw =
    chip.getAttribute('data-hovercard-id') ||
    chip.getAttribute('email') ||
    attrEl?.getAttribute('data-hovercard-id') ||
    attrEl?.getAttribute('email') ||
    chip.textContent ||
    '';
  const m = raw.match(EMAIL_IN_TEXT);
  return m ? m[0].toLowerCase() : null;
}

function findChip(root: HTMLElement, kind: RecipientKind, email: string): HTMLElement | null {
  const container = getRecipientContainer(root, kind);
  if (!container) return null;
  const target = email.toLowerCase();
  return qAll(container, SEL.recipients.chip).find((chip) => chipEmail(chip) === target) ?? null;
}

/**
 * Addresses that are actual chips. Unlike readRecipients, text still pending in the input
 * does not count, so a failed add is never mistaken for a success.
 */
function currentEmails(root: HTMLElement, kind: RecipientKind): string[] {
  const container = getRecipientContainer(root, kind);
  if (!container) return [];
  const emails = qAll(container, SEL.recipients.chip)
    .map(chipEmail)
    .filter((e): e is string => !!e);
  return [...new Set(emails)];
}

/**
 * Removes the chip for one address. Each attempt targets that chip only, and Gmail must remove
 * it itself: removing the node ourselves would leave the recipient in Gmail's state.
 */
export async function removeRecipient(root: HTMLElement, kind: RecipientKind, email: string): Promise<boolean> {
  const chip = findChip(root, kind, email);
  if (!chip) return !currentEmails(root, kind).includes(email.toLowerCase());

  const deleteBtn = q<HTMLElement>(chip, SEL.recipients.chipDeleteBtn);
  if (deleteBtn) {
    dispatchInteraction(deleteBtn);
    if (await waitField(() => !chip.isConnected)) return true;
  }

  for (const key of [
    { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    { key: 'Delete', code: 'Delete', keyCode: 46 },
  ]) {
    if (!chip.isConnected) return true;
    dispatchInteraction(chip);
    chip.dispatchEvent(new KeyboardEvent('keydown', { ...key, bubbles: true }));
    if (await waitField(() => !chip.isConnected)) return true;
  }

  return false;
}

/**
 * Removes all recipient chips for the given kind.
 */
export async function clearRecipients(root: HTMLElement, kind: RecipientKind): Promise<boolean> {
  if (readRecipients(root, kind).length === 0) return true;
  await ensureFieldVisible(root, kind);

  for (const email of currentEmails(root, kind)) {
    if (!(await removeRecipient(root, kind, email))) return false;
  }
  return readRecipients(root, kind).length === 0;
}

function clearPendingInput(inputEl: HTMLInputElement): void {
  if (!inputEl.value) return;
  inputEl.value = '';
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Adds new recipient email addresses to the given recipient field.
 * On failure, text left in the input is cleared so Gmail cannot turn it into a recipient later.
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
    await sleep(10);

    // If inputEl did not gain active focus, try interacting with it directly
    if (document.activeElement !== inputEl) {
      dispatchInteraction(inputEl);
      inputEl.focus();
      await sleep(10);
    }

    const lower = email.toLowerCase();
    const isCommitted = () =>
      !inputEl.value.toLowerCase().includes(lower) && currentEmails(root, kind).includes(lower);

    // Real Gmail (2026-10, verified by e2e) turns a pasted address into a chip directly.
    // A typed comma or a blur does not commit; it only leaves text in the input.
    pasteText(inputEl, `${email}, `);
    if (!(await waitField(isCommitted)) && !currentEmails(root, kind).includes(lower)) {
      // Fallback: type the address and press Enter. Enter can pick an autocomplete suggestion instead,
      // which the caller detects by comparing the final chips with the expected set.
      if (!(await commitWithEnter(inputEl, email)) || !(await waitField(isCommitted))) {
        if (!currentEmails(root, kind).includes(lower)) {
          clearPendingInput(inputEl);
          return false;
        }
      }
    }
  }

  return true;
}

function pasteText(inputEl: HTMLInputElement, text: string): void {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  inputEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

async function commitWithEnter(inputEl: HTMLInputElement, email: string): Promise<boolean> {
  clearPendingInput(inputEl);
  inputEl.focus();
  // Only use execCommand with focus on the input, or the address would go into the focused body
  if (document.activeElement !== inputEl) return false;

  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, email);
  } catch {
    inserted = false;
  }
  if (!inserted) {
    inputEl.value = email;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await sleep(50);

  const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  inputEl.dispatchEvent(new KeyboardEvent('keydown', init));
  inputEl.dispatchEvent(new KeyboardEvent('keypress', init));
  inputEl.dispatchEvent(new KeyboardEvent('keyup', init));
  return true;
}

/**
 * 'ok': the field now holds the requested recipients.
 * 'failed': the change could not be made and the field was restored to its previous recipients.
 * 'inconsistent': the change failed and restoring also failed; the user must check the field.
 */
export type RecipientApplyResult = 'ok' | 'failed' | 'inconsistent';

function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/**
 * Brings the field back to `before`. Extra recipients are removed first, so a failure here
 * never leaves someone in the field that the user did not have there.
 */
async function restoreRecipients(root: HTMLElement, kind: RecipientKind, before: string[]): Promise<boolean> {
  const beforeSet = new Set(before);
  for (const email of currentEmails(root, kind).filter((e) => !beforeSet.has(e))) {
    if (!(await removeRecipient(root, kind, email))) return false;
  }
  const now = new Set(currentEmails(root, kind));
  const missing = before.filter((e) => !now.has(e));
  if (missing.length > 0 && !(await addRecipients(root, kind, missing))) return false;
  return sameSet(currentEmails(root, kind), before);
}

/**
 * Applies a RecipientField configuration (replace or append) to Gmail.
 * The previous recipients are recorded first and restored if any step fails.
 */
export async function applyRecipientField(
  root: HTMLElement,
  kind: RecipientKind,
  f: RecipientField
): Promise<RecipientApplyResult> {
  const target = [...new Set(f.emails.map((em) => em.toLowerCase()))];
  const initial = currentEmails(root, kind);

  if (f.mode === 'replace' && sameSet(initial, target)) return 'ok';
  if (f.mode === 'append' && target.every((em) => initial.includes(em))) return 'ok';

  // A collapsed To row may only expose its first recipient, so expand before recording the state
  if (!(await ensureFieldVisible(root, kind))) return 'failed';
  const before = currentEmails(root, kind);

  const expected = f.mode === 'replace' ? target : [...new Set([...before, ...target])];
  if (sameSet(before, expected)) return 'ok';

  const expectedSet = new Set(expected);
  const toRemove = before.filter((em) => !expectedSet.has(em));
  const toAdd = expected.filter((em) => !before.includes(em));

  let ok = true;
  for (const email of toRemove) {
    if (!(await removeRecipient(root, kind, email))) {
      ok = false;
      break;
    }
  }
  if (ok) {
    const originals = f.emails.filter((em) => toAdd.includes(em.toLowerCase()));
    ok = await addRecipients(root, kind, originals);
  }
  if (ok && sameSet(currentEmails(root, kind), expected)) return 'ok';

  console.warn(`[FluxSnip] Applying ${kind} failed; restoring previous recipients.`);
  return (await restoreRecipients(root, kind, before)) ? 'failed' : 'inconsistent';
}
