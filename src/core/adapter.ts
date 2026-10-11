import type { InsertMethod, Platform, Template, TemplateVars } from './types';

/**
 * Adapter interface for interacting with platform-specific editors and fields (Gmail, Teams, Chat).
 */
export interface PlatformAdapter {
  /** The target platform for this adapter */
  readonly platform: Platform;

  /**
   * Checks if node (e.g. currently active element) is inside an editor supported by this adapter.
   * Returns the editor root element if matched, otherwise null.
   */
  findEditor(node: Node | null): HTMLElement | null;

  /**
   * Collects dynamic variable values from the page (e.g. To recipient, From alias for Gmail).
   */
  collectVars(editor: HTMLElement): Promise<Partial<TemplateVars>>;

  /**
   * Applies non-body fields (e.g. To, Cc, Bcc, Subject, From alias for Gmail).
   * Returns list of failed field names.
   */
  applyFields?(editor: HTMLElement, t: Template): Promise<{ failed: string[] }>;

  /**
   * Ordered list of insertion methods to attempt for body insertion.
   */
  readonly insertOrder: InsertMethod[];

  /**
   * Optional custom insert order override for specific editor types (e.g. plain text for Gemini prompt box).
   */
  getInsertOrder?(editor: HTMLElement): InsertMethod[];

  /**
   * Checks whether this editor requires plain text insertion (e.g. Gemini AI promptbox).
   */
  isPlainEditor?(editor: HTMLElement): boolean;

  /**
   * Optional callback invoked after template insertion is completed.
   * Allows platform adapters to handle platform-specific post-insertion triggers (e.g. Gemini AI auto-submit).
   */
  afterInsert?(editor: HTMLElement, template: Template): Promise<void> | void;
}
