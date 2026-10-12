/**
 * CSS Selectors for Microsoft Teams (teams.microsoft.com and teams.cloud.microsoft).
 * Based on real-world DOM snapshots from company tenant PWA.
 * CKEditor 5 based rich message composer.
 */

export const SEL = {
  /**
   * Teams message compose body candidates (Chat, Channel new post, Channel reply).
   */
  editor: [
    'div[data-tid="ckeditor"][contenteditable="true"]',
    'div.ck-editor__editable[contenteditable="true"][role="textbox"]',
    'div[data-shortcut-context="compose-field"][contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"][data-tabster*="chat-input"]',
    'div.ck-editor__editable[contenteditable="true"]',
    'div.ck-content[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
  ],

  /**
   * Channel post subject input field.
   */
  subjectBox: [
    'input[data-tid="post-compose-subject-editor"]',
    'input[aria-label="件名を追加"]',
    'input[placeholder="件名を追加"]',
  ],

  /**
   * Message compose root container / layout.
   */
  composeContainer: [
    'div[data-tid="post-compose-layout"]',
    'div[data-tid="chat-pane-compose-message-footer"]',
    'div[data-tid="message-pane-footer"]',
    'div.message-pane-footer',
  ],

  /**
   * Send / Post button in compose area.
   */
  sendButton: [
    'button[data-tid="sendMessageCommands-send"]',
    'button[aria-label*="送信"]',
    'button[aria-label*="Send"]',
    'button[name="send"]',
  ],

  /**
   * Inputs and elements to ignore (global search, headers).
   */
  ignore: [
    '#ms-searchux-input',
    'input[data-tid="AUTOSUGGEST_INPUT"]',
    'header input',
    'div[role="search"] input',
    'input[type="search"]',
  ],
} as const;

/**
 * Checks if an element matches any selector in a list.
 */
export function matchesAny(el: Element, selectors: readonly string[]): boolean {
  for (const s of selectors) {
    try {
      if (el.matches(s)) return true;
    } catch {
      // Ignore unsupported or malformed selectors
    }
  }
  return false;
}

/**
 * Queries first descendant matching any selector in a list.
 */
export function q<T extends Element = Element>(root: Element, selectors: readonly string[]): T | null {
  for (const s of selectors) {
    try {
      const match = root.querySelector(s);
      if (match) return match as T;
    } catch {
      // Ignore
    }
  }
  return null;
}
