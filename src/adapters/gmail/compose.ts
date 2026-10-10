import { matchesAny, q, SEL } from './selectors';

/**
 * Finds the compose window root container starting from an arbitrary node.
 * Works for popup compose windows, full screen compose, and inline reply forms.
 */
export function findComposeRoot(node: Node | null): HTMLElement | null {
  let curr = node instanceof Element ? node : node?.parentElement ?? null;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    // 1. Direct container match (dialog or known compose container)
    if (matchesAny(curr, SEL.composeRoot)) {
      return curr as HTMLElement;
    }

    // 2. Ancestor that directly contains a subjectbox
    const subject = q(curr, SEL.subjectBox);
    if (subject && curr.contains(subject)) {
      // Check if this container also wraps the message body
      const body = q(curr, SEL.body);
      if (body) {
        return curr as HTMLElement;
      }
    }

    curr = curr.parentElement;
  }

  return null;
}

/**
 * Identifies the compose body element from an arbitrary active node.
 * Ensures the element is strictly an email body and not a search bar or chat input.
 * Supports:
 * - Active caret inside the message body.
 * - Active caret in recipient (To, Cc, Bcc) or subject fields within a compose window.
 */
export function findGmailBody(node: Node | null): HTMLElement | null {
  if (!node) return null;

  let el = node instanceof Element ? node : node.parentElement;
  if (!el) return null;

  // Guard against search box or header
  if (el.closest('input[name="q"], header input')) {
    return null;
  }

  // 1. Direct body check (node is inside the compose body)
  let curr: Element | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (matchesAny(curr, SEL.body)) {
      // Ensure it is inside a compose container or has a sibling/ancestor subject box
      const root = findComposeRoot(curr);
      if (root) {
        return curr as HTMLElement;
      }

      // Inline reply fallback: check if it's within a mail content wrapper and has role="textbox"
      if (curr.getAttribute('role') === 'textbox' && curr.getAttribute('contenteditable') === 'true') {
        const hasQuoteOrSend = curr.parentElement?.querySelector(
          '.gmail_quote, [aria-label*="送信"], [aria-label*="Send"], [data-tooltip*="送信"]'
        );
        if (hasQuoteOrSend || curr.closest('div[role="main"]')) {
          return curr as HTMLElement;
        }
      }
    }

    // Guard against search box or header
    if (matchesAny(curr, SEL.ignore)) {
      return null;
    }

    curr = curr.parentElement;
  }

  // 2. Compose container fallback: node is in header fields (To, Cc, Bcc, Subject)
  const root = findComposeRoot(el);
  if (root) {
    const body = q(root, SEL.body);
    if (body) {
      return body;
    }
  }

  return null;
}

