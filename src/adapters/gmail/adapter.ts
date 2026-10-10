import type { PlatformAdapter } from '@/core/adapter';
import type { TemplateVars } from '@/core/types';
import { findGmailBody } from './compose';

/**
 * Platform adapter for Gmail web interface (mail.google.com).
 * Handles body insertion and editor resolution.
 */
export const gmailAdapter: PlatformAdapter = {
  platform: 'gmail',

  findEditor(node: Node | null): HTMLElement | null {
    return findGmailBody(node);
  },

  async collectVars(_editor: HTMLElement): Promise<Partial<TemplateVars>> {
    // Variable collection (To, From) will be added in T06
    return {};
  },

  insertOrder: ['dom', 'paste', 'clipboard'],
};
