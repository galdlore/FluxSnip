import { waitFor } from '@/core/dom';
import { addKnownFromAddresses } from '@/core/storage';
import { waitField } from '@/core/timing';
import { isElementVisible } from './recipients';
import { q, qAll, SEL } from './selectors';

function dispatchClick(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function parseEmailAndName(text: string): { email: string; name?: string } | null {
  const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (!emailMatch) return null;

  const email = emailMatch[0];
  let name: string | undefined;

  const nameMatch = text.match(/^(.*?)\s*<.*?>/);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }

  return { email, name };
}

/**
 * Finds the open From menu. Gmail keeps many hidden role="menu" elements in the DOM,
 * so only a visible menu that lists email addresses qualifies.
 */
function findOpenFromMenu(): HTMLElement | null {
  const candidates = [
    ...qAll<HTMLElement>(document.body, SEL.from.menuContainer),
    ...Array.from(document.querySelectorAll<HTMLElement>('div[role="menu"]')),
  ];
  for (const menu of candidates) {
    if (!isElementVisible(menu)) continue;
    const items = qAll<HTMLElement>(menu, SEL.from.menuItem);
    if (items.some((item) => parseEmailAndName(item.getAttribute('value') || item.textContent || ''))) {
      return menu;
    }
  }
  return null;
}

/**
 * Closes the From menu and confirms it is gone. Escape is tried first; if the menu stays open,
 * clicking the trigger again toggles it closed. Leaving it open would cover the compose window.
 */
async function closeFromMenu(menu: HTMLElement, triggerBtn: HTMLElement): Promise<boolean> {
  const isClosed = () => !menu.isConnected || !isElementVisible(menu);
  const escape = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };

  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', escape));
  menu.dispatchEvent(new KeyboardEvent('keydown', escape));
  if (await waitField(isClosed)) return true;

  dispatchClick(triggerBtn);
  if (await waitField(isClosed)) return true;

  console.warn('[FluxSnip] From menu could not be closed.');
  return false;
}

/**
 * Reads the current From alias configuration for this compose window.
 */
export function readFrom(root: HTMLElement): { email: string; name?: string } | null {
  // 1. Check hidden input first
  const hiddenInput = q<HTMLInputElement>(root, SEL.from.hiddenInput);
  if (hiddenInput && hiddenInput.value) {
    const parsed = parseEmailAndName(hiddenInput.value);
    if (parsed) return parsed;
    return { email: hiddenInput.value };
  }

  // 2. Check trigger button or display label
  const displayEl = q(root, SEL.from.currentDisplay);
  if (displayEl && displayEl.textContent) {
    const parsed = parseEmailAndName(displayEl.textContent);
    if (parsed) return parsed;
  }

  // 3. Fallback for single-account Gmail (no From dropdown):
  // Check Google account button in header: aria-label="Google アカウント: 山田 太郎 \n(xxx@gmail.com)"
  const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (doc) {
    const acctEl = doc.querySelector('a[aria-label*="Google アカウント"], a[aria-label*="Google Account"], a[aria-label*="@gmail.com"], a[aria-label*="@"]');
    if (acctEl) {
      const aria = acctEl.getAttribute('aria-label') || '';
      const emailMatch = aria.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (emailMatch) {
        const email = emailMatch[0];
        // e.g. "Google アカウント: K TD \n(user@example.com)" -> extract "K TD"
        const nameMatch = aria.match(/(?:Google\s*アカウント|Google\s*Account)[:：]?\s*([^\n\(（]+)/i);
        const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : undefined;
        return { email, name: name || undefined };
      }
    }

    // 4. Meta tag fallback
    const metaAcct = doc.querySelector('meta[name="og-profile-acct"]');
    if (metaAcct) {
      const email = metaAcct.getAttribute('content')?.trim();
      if (email) {
        return { email };
      }
    }
  }

  return null;
}

/**
 * Opens the From dropdown menu to collect all available sender aliases,
 * then saves them to storage for autocomplete in options page.
 */
export async function listFromOptions(root: HTMLElement): Promise<string[]> {
  const triggerBtn = q<HTMLElement>(root, SEL.from.triggerButton);
  if (!triggerBtn) {
    const current = readFrom(root);
    return current ? [current.email] : [];
  }

  // Open menu
  dispatchClick(triggerBtn);

  const menuContainer = await waitFor(findOpenFromMenu, { timeout: 1500, interval: 40 });

  if (!menuContainer) {
    return [];
  }

  const items = qAll<HTMLElement>(menuContainer, SEL.from.menuItem);
  const foundEmails: string[] = [];

  for (const item of items) {
    const val = item.getAttribute('value') || '';
    const parsed = parseEmailAndName(val || item.textContent || '');
    if (parsed && !foundEmails.includes(parsed.email)) {
      foundEmails.push(parsed.email);
    }
  }

  await closeFromMenu(menuContainer, triggerBtn);

  if (foundEmails.length > 0) {
    addKnownFromAddresses(foundEmails).catch(() => {});
  }

  return foundEmails;
}

/**
 * Selects the specified From email alias in Gmail compose window.
 */
export async function selectFrom(root: HTMLElement, targetEmail: string): Promise<boolean> {
  const current = readFrom(root);
  if (current && current.email.toLowerCase() === targetEmail.toLowerCase()) {
    return true;
  }

  const triggerBtn = q<HTMLElement>(root, SEL.from.triggerButton);
  if (!triggerBtn) {
    // If there is no From dropdown, only succeed if current matches target
    return current?.email.toLowerCase() === targetEmail.toLowerCase();
  }

  // Open menu
  dispatchClick(triggerBtn);

  const menuContainer = await waitFor(findOpenFromMenu, { timeout: 1500, interval: 40 });

  if (!menuContainer) {
    return false;
  }

  const items = qAll<HTMLElement>(menuContainer, SEL.from.menuItem);
  let matchedItem: HTMLElement | null = null;
  const allDiscovered: string[] = [];

  for (const item of items) {
    const val = item.getAttribute('value') || '';
    const parsed = parseEmailAndName(val || item.textContent || '');
    if (parsed) {
      allDiscovered.push(parsed.email);
      if (parsed.email.toLowerCase() === targetEmail.toLowerCase()) {
        matchedItem = item;
      }
    }
  }

  if (allDiscovered.length > 0) {
    addKnownFromAddresses(allDiscovered).catch(() => {});
  }

  if (!matchedItem) {
    await closeFromMenu(menuContainer, triggerBtn);
    return false;
  }

  dispatchClick(matchedItem);
  const target = targetEmail.toLowerCase();
  const changed = await waitField(() => readFrom(root)?.email.toLowerCase() === target);
  if (!changed && menuContainer.isConnected && isElementVisible(menuContainer)) {
    await closeFromMenu(menuContainer, triggerBtn);
  }
  return !!changed;
}
