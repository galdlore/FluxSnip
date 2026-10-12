export type Platform = 'gmail' | 'teams' | 'chat';
export const PLATFORMS: readonly Platform[] = ['gmail', 'teams', 'chat'] as const;

/* ---------- HTML AST ---------- */
export interface AstText {
  t: '#text';
  v: string;
}

export interface AstElement {
  t: string; // lowercase tag name (e.g. 'p', 'table')
  a?: Record<string, string>; // sanitized attributes
  c?: AstNode[]; // children
}

export type AstNode = AstText | AstElement;

/* ---------- Templates ---------- */
export type RecipientMode = 'replace' | 'append';

export interface RecipientField {
  mode: RecipientMode;
  emails: string[];
}

export type SubjectMode = 'replace' | 'ifEmpty';

export interface BaseTemplate {
  id: string; // crypto.randomUUID()
  platform: Platform;
  name: string; // 1..100 chars
  keyword: string; // see KEYWORD_PATTERN
  tags: string[];
  bodyHtml: string; // sanitized HTML (source of truth for editing)
  bodyAst: AstNode[]; // derived from bodyHtml on every save/import
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface GmailTemplate extends BaseTemplate {
  platform: 'gmail';
  to?: RecipientField;
  cc?: RecipientField;
  bcc?: RecipientField;
  subject?: { mode: SubjectMode; value: string };
  from?: string; // alias email address
  autoSubmitAi?: boolean; // When expanded in Gemini promptbox, automatically submit to generate
  aiPrompt?: string; // Prompt text to insert into Gemini Alt+H box
}

export interface TeamsTemplate extends BaseTemplate {
  platform: 'teams';
}

export interface ChatTemplate extends BaseTemplate {
  platform: 'chat';
}

export type Template = GmailTemplate | TeamsTemplate | ChatTemplate;

/* ---------- Settings ---------- */
export interface KeyCombo {
  code: string; // KeyboardEvent.code, e.g. 'KeyJ'
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Options page, in-page messages, and Help. `auto` follows Chrome's UI language. */
export type UiLanguage = 'auto' | 'en' | 'ja';

export function normalizeUiLanguage(value: unknown): UiLanguage {
  if (value === 'auto' || value === 'en' || value === 'ja') return value;
  return 'auto';
}

export interface Settings {
  pickerShortcut: KeyCombo;
  enabled: Record<Platform, boolean>;
  // Wait before treating a Gmail field operation (chip add/remove, Cc/Bcc reveal) as slow
  fieldWaitMs: number;
  uiLanguage: UiLanguage;
}

export const FIELD_WAIT_MIN_MS = 20;
// Waits always continue up to this margin before giving up, whatever fieldWaitMs is
export const FIELD_WAIT_SAFE_MS = 600;

export const DEFAULT_SETTINGS: Settings = {
  pickerShortcut: { code: 'KeyJ', ctrl: false, alt: true, shift: false, meta: false },
  enabled: { gmail: true, teams: true, chat: true },
  fieldWaitMs: 150,
  uiLanguage: 'auto',
};

export function clampFieldWaitMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.fieldWaitMs;
  return Math.min(FIELD_WAIT_SAFE_MS, Math.max(FIELD_WAIT_MIN_MS, Math.round(n)));
}

/* ---------- Variables ---------- */
export interface Person {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface TemplateVars {
  now: Date;
  locale: string; // e.g. 'ja', 'en-US' (browser.i18n.getUILanguage())
  to?: Person; // Gmail: first To recipient
  from?: Person; // Gmail: selected From
}

/* ---------- Rendering / insertion ---------- */
export interface RenderedContent {
  ast: AstNode[]; // variables already substituted
  html: string; // astToHtml(ast)
  text: string; // astToPlainText(ast)
  chatText: string; // astToChatText(ast)
  chatHtml: string; // astToChatHtml(ast)
}

// 'html': execCommand('insertHTML'), which keeps the editor's undo history intact
export type InsertMethod = 'html' | 'dom' | 'paste' | 'insertText' | 'clipboard';

export interface InsertResult {
  ok: boolean;
  method?: InsertMethod;
  message?: string;
}

/* ---------- Constants ---------- */
export const KEYWORD_PATTERN = /^[A-Za-z0-9_\-;:.!/@#]{1,32}$/;
export const KEYWORD_CHAR = /[A-Za-z0-9_\-;:.!/@#]/;
export const MAX_BODY_HTML_BYTES = 200 * 1024; // per template
// Private-use character standing in for {{cursor}} inside RenderedContent.ast only
export const CURSOR_MARK = '\uE002';
