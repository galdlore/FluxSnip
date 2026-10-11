import {
  DEFAULT_SETTINGS,
  PLATFORMS,
  type KeyCombo,
  type Platform,
  type Settings,
  type Template,
} from './types';
import { sanitizeHtmlToAst } from './html/sanitize';
import { astToHtml } from './html/ast';
import { validateTemplate } from './validate';
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
  const r = raw as { pickerShortcut?: unknown; enabled?: unknown };

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

  return { pickerShortcut, enabled };
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
        const id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}-${i}`);
        const name = String(item.name || '').slice(0, 100);
        const keyword = String(item.keyword || '');
        const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
        const bodyHtmlRaw = typeof item.bodyHtml === 'string' ? item.bodyHtml : '';
        const createdAt = Number(item.createdAt) || Date.now();
        const updatedAt = Number(item.updatedAt) || Date.now();

        // Regenerate AST and sanitize HTML
        const recomputedAst = sanitizeHtmlToAst(bodyHtmlRaw);
        const sanitizedHtml = astToHtml(recomputedAst);

        const reconstructed: Template = {
          ...item,
          id,
          platform,
          name,
          keyword,
          tags,
          bodyHtml: sanitizedHtml,
          bodyAst: recomputedAst,
          createdAt,
          updatedAt,
        };

        const issues = validateTemplate(reconstructed, resultData[platform]);
        if (issues.length > 0) {
          errors.push(`[${platform} #${i} ${name || id}] Validation failed: ${issues.map((iss) => `${iss.field}:${iss.messageKey}`).join(', ')}`);
          continue;
        }

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
