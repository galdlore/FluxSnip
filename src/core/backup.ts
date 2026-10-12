import {
  clampFieldWaitMs,
  DEFAULT_SETTINGS,
  normalizeUiLanguage,
  PLATFORMS,
  type GmailTemplate,
  type KeyCombo,
  type Platform,
  type Settings,
  type Template,
} from './types';
import { sanitizeHtmlToAst } from './html/sanitize';
import { astToHtml } from './html/ast';
import { parseEmailList, validateTemplate } from './validate';
import { getTemplates, replaceTemplates, saveSettings } from './storage';

export interface ExportData {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  templates: Record<Platform, Template[]>;
  settings?: Settings;
}

export function buildExport(data: {
  templates: Record<Platform, Template[]>;
  settings?: Settings;
}): string {
  const payload: ExportData = {
    app: 'FluxSnip',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    templates: {
      gmail: data.templates.gmail || [],
      teams: data.templates.teams || [],
      chat: data.templates.chat || [],
    },
    ...(data.settings ? { settings: data.settings } : {}),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Rebuilds Settings from untrusted backup data, keeping only well-typed values
 * and falling back to defaults for anything missing or malformed.
 */
function sanitizeImportedSettings(raw: unknown): Settings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as {
    pickerShortcut?: unknown;
    enabled?: unknown;
    fieldWaitMs?: unknown;
    uiLanguage?: unknown;
  };

  let pickerShortcut = { ...DEFAULT_SETTINGS.pickerShortcut };
  const sc = r.pickerShortcut as Partial<Record<keyof KeyCombo, unknown>> | undefined;
  if (sc && typeof sc === 'object' && typeof sc.code === 'string' && sc.code.length > 0) {
    pickerShortcut = {
      code: sc.code,
      ctrl: sc.ctrl === true,
      alt: sc.alt === true,
      shift: sc.shift === true,
      meta: sc.meta === true,
    };
  }

  const enabled = { ...DEFAULT_SETTINGS.enabled };
  if (r.enabled && typeof r.enabled === 'object') {
    const e = r.enabled as Record<string, unknown>;
    for (const platform of PLATFORMS) {
      const v = e[platform];
      if (typeof v === 'boolean') enabled[platform] = v;
    }
  }

  const fieldWaitMs =
    typeof r.fieldWaitMs === 'number' ? clampFieldWaitMs(r.fieldWaitMs) : DEFAULT_SETTINGS.fieldWaitMs;
  const uiLanguage = normalizeUiLanguage(r.uiLanguage);

  return { pickerShortcut, enabled, fieldWaitMs, uiLanguage };
}

/**
 * Type-checks the Gmail-only fields of an imported template. A field that is present but malformed
 * is reported rather than dropped, since silently losing To/Cc/Bcc would change what the template does.
 */
function parseGmailFields(item: Record<string, unknown>): { fields: Partial<GmailTemplate>; problems: string[] } {
  const fields: Partial<GmailTemplate> = {};
  const problems: string[] = [];

  for (const kind of ['to', 'cc', 'bcc'] as const) {
    const v = item[kind];
    if (v === undefined || v === null) continue;
    const r = v as { mode?: unknown; emails?: unknown };
    if (
      typeof v !== 'object' ||
      (r.mode !== 'replace' && r.mode !== 'append') ||
      !Array.isArray(r.emails) ||
      !r.emails.every((e) => typeof e === 'string')
    ) {
      problems.push(kind);
      continue;
    }
    const emails = parseEmailList((r.emails as string[]).join(','));
    if (emails.length > 0) fields[kind] = { mode: r.mode, emails };
  }

  const subject = item.subject;
  if (subject !== undefined && subject !== null) {
    const s = subject as { mode?: unknown; value?: unknown };
    if (typeof subject !== 'object' || (s.mode !== 'replace' && s.mode !== 'ifEmpty') || typeof s.value !== 'string') {
      problems.push('subject');
    } else if (s.value.trim()) {
      fields.subject = { mode: s.mode, value: s.value };
    }
  }

  if (item.from !== undefined && item.from !== null && item.from !== '') {
    if (typeof item.from !== 'string') problems.push('from');
    else fields.from = item.from;
  }
  if (item.aiPrompt !== undefined && item.aiPrompt !== null && item.aiPrompt !== '') {
    if (typeof item.aiPrompt !== 'string') problems.push('aiPrompt');
    else fields.aiPrompt = item.aiPrompt;
  }
  if (item.autoSubmitAi !== undefined) {
    if (typeof item.autoSubmitAi !== 'boolean') problems.push('autoSubmitAi');
    else fields.autoSubmitAi = item.autoSubmitAi;
  }

  return { fields, problems };
}

export interface ImportPreview {
  counts: Record<Platform, number>;
  errors: string[];
  data: Record<Platform, Template[]>;
  settings?: Settings;
}

export function parseImport(json: string): ImportPreview {
  const errors: string[] = [];
  const resultData: Record<Platform, Template[]> = {
    gmail: [],
    teams: [],
    chat: [],
  };
  let settings: Settings | undefined;

  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch (err: any) {
    return {
      counts: { gmail: 0, teams: 0, chat: 0 },
      errors: [`Invalid JSON: ${err?.message || 'Parse error'}`],
      data: resultData,
    };
  }

  if (!raw || typeof raw !== 'object') {
    return {
      counts: { gmail: 0, teams: 0, chat: 0 },
      errors: ['Invalid backup: Root is not an object'],
      data: resultData,
    };
  }

  if (raw.app !== 'FluxSnip') {
    return {
      counts: { gmail: 0, teams: 0, chat: 0 },
      errors: [`Unsupported application backup: expected FluxSnip, got ${raw.app}`],
      data: resultData,
    };
  }

  if (raw.settings !== undefined) {
    settings = sanitizeImportedSettings(raw.settings);
    if (!settings) {
      errors.push('Invalid settings section: ignored');
    }
  }

  const rawTemplates = raw.templates || {};
  const seenIds = new Set<string>();

  for (const platform of PLATFORMS) {
    const list = rawTemplates[platform];
    if (!Array.isArray(list)) continue;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== 'object') {
        errors.push(`[${platform} #${i}] Invalid template format`);
        continue;
      }

      try {
        const id =
          typeof item.id === 'string' && item.id
            ? item.id
            : typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `import-${Date.now()}-${i}`;
        if (seenIds.has(id)) {
          errors.push(`[${platform} #${i}] Duplicate id in file: ${id}`);
          continue;
        }

        let gmailFields: Partial<GmailTemplate> = {};
        if (platform === 'gmail') {
          const parsed = parseGmailFields(item);
          if (parsed.problems.length > 0) {
            errors.push(`[${platform} #${i}] Invalid fields: ${parsed.problems.join(', ')}`);
            continue;
          }
          gmailFields = parsed.fields;
        }

        const name = String(item.name || '').slice(0, 100);
        const keyword = String(item.keyword || '');
        const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
        const bodyHtmlRaw = typeof item.bodyHtml === 'string' ? item.bodyHtml : '';
        const createdAt = Number(item.createdAt) || Date.now();
        const updatedAt = Number(item.updatedAt) || Date.now();

        // Regenerate AST and sanitize HTML
        const recomputedAst = sanitizeHtmlToAst(bodyHtmlRaw);
        const sanitizedHtml = astToHtml(recomputedAst);

        // Built from known fields only: anything else in the file is dropped
        const reconstructed = {
          id,
          platform,
          name,
          keyword,
          tags,
          bodyHtml: sanitizedHtml,
          bodyAst: recomputedAst,
          createdAt,
          updatedAt,
          ...gmailFields,
        } as Template;

        const issues = validateTemplate(reconstructed, resultData[platform]);
        if (issues.length > 0) {
          errors.push(`[${platform} #${i} ${name || id}] Validation failed: ${issues.map((iss) => `${iss.field}:${iss.messageKey}`).join(', ')}`);
          continue;
        }

        seenIds.add(id);
        resultData[platform].push(reconstructed);
      } catch (err: any) {
        errors.push(`[${platform} #${i}] Failed to parse: ${err?.message || 'Error'}`);
      }
    }
  }

  return {
    counts: {
      gmail: resultData.gmail.length,
      teams: resultData.teams.length,
      chat: resultData.chat.length,
    },
    errors,
    data: resultData,
    settings,
  };
}

export type ImportMode = 'merge' | 'replace';

export async function applyImport(
  p: ImportPreview,
  mode: ImportMode,
  includeSettings: boolean
): Promise<{ added: number; updated: number; skipped: number }> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const platform of PLATFORMS) {
    const importItems = p.data[platform];
    if (!importItems || importItems.length === 0) {
      if (mode === 'replace') {
        // If replace mode, empty array clears it
        await replaceTemplates(platform, []);
      }
      continue;
    }

    if (mode === 'replace') {
      await replaceTemplates(platform, importItems);
      added += importItems.length;
    } else {
      // Merge mode
      const current = await getTemplates(platform);
      const currentMap = new Map(current.map((item) => [item.id, item]));

      for (const item of importItems) {
        const existing = currentMap.get(item.id);
        const keywordTaken = Array.from(currentMap.values()).some(
          (other) => other.id !== item.id && other.keyword === item.keyword
        );
        if (keywordTaken) {
          skipped++;
          continue;
        }
        if (!existing) {
          currentMap.set(item.id, item);
          added++;
        } else if (item.updatedAt > existing.updatedAt) {
          currentMap.set(item.id, item);
          updated++;
        } else {
          skipped++;
        }
      }

      await replaceTemplates(platform, Array.from(currentMap.values()));
    }
  }

  if (includeSettings && p.settings) {
    await saveSettings(p.settings);
  }

  return { added, updated, skipped };
}
