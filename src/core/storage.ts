import { browser } from 'wxt/browser';
import {
  clampFieldWaitMs,
  DEFAULT_SETTINGS,
  normalizeUiLanguage,
  type Platform,
  type Settings,
  type Template,
} from './types';

const STORAGE_KEYS = {
  META: 'meta',
  TEMPLATES_PREFIX: 'templates:',
  SETTINGS: 'settings',
  KNOWN_FROM: 'gmail:knownFrom',
} as const;

function getPlatformKey(platform: Platform): string {
  return `${STORAGE_KEYS.TEMPLATES_PREFIX}${platform}`;
}

export async function getTemplates<P extends Platform>(
  platform: P
): Promise<Extract<Template, { platform: P }>[]> {
  const key = getPlatformKey(platform);
  const data = await browser.storage.local.get(key);
  const list = data[key];
  if (!Array.isArray(list)) {
    return [];
  }
  return list as Extract<Template, { platform: P }>[];
}

export async function saveTemplate(t: Template): Promise<void> {
  const key = getPlatformKey(t.platform);
  const current = await getTemplates(t.platform);
  const now = Date.now();
  const updatedItem = {
    ...t,
    updatedAt: now,
  };

  const index = current.findIndex((item) => item.id === t.id);
  let nextList: Template[];
  if (index >= 0) {
    nextList = [...current];
    nextList[index] = updatedItem;
  } else {
    nextList = [...current, updatedItem];
  }

  await browser.storage.local.set({ [key]: nextList });
}

export async function deleteTemplate(platform: Platform, id: string): Promise<void> {
  const key = getPlatformKey(platform);
  const current = await getTemplates(platform);
  const nextList = current.filter((item) => item.id !== id);
  await browser.storage.local.set({ [key]: nextList });
}

export async function replaceTemplates(platform: Platform, list: Template[]): Promise<void> {
  const key = getPlatformKey(platform);
  await browser.storage.local.set({ [key]: list });
}

function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  if (!raw) {
    return {
      ...DEFAULT_SETTINGS,
      pickerShortcut: { ...DEFAULT_SETTINGS.pickerShortcut },
      enabled: { ...DEFAULT_SETTINGS.enabled },
    };
  }

  return {
    pickerShortcut: {
      ...DEFAULT_SETTINGS.pickerShortcut,
      ...(raw.pickerShortcut || {}),
    },
    enabled: {
      ...DEFAULT_SETTINGS.enabled,
      ...(raw.enabled || {}),
    },
    fieldWaitMs: clampFieldWaitMs(raw.fieldWaitMs),
    uiLanguage: normalizeUiLanguage(raw.uiLanguage),
  };
}

export async function getSettings(): Promise<Settings> {
  const data = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
  return normalizeSettings(data[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    pickerShortcut: {
      ...current.pickerShortcut,
      ...(patch.pickerShortcut || {}),
    },
    enabled: {
      ...current.enabled,
      ...(patch.enabled || {}),
    },
    fieldWaitMs: clampFieldWaitMs(patch.fieldWaitMs ?? current.fieldWaitMs),
    uiLanguage: normalizeUiLanguage(patch.uiLanguage ?? current.uiLanguage),
  };

  await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

export async function getKnownFromAddresses(): Promise<string[]> {
  const data = await browser.storage.local.get(STORAGE_KEYS.KNOWN_FROM);
  const list = data[STORAGE_KEYS.KNOWN_FROM];
  if (!Array.isArray(list)) {
    return [];
  }
  return list as string[];
}

export async function addKnownFromAddresses(emails: string[]): Promise<void> {
  if (!emails || emails.length === 0) return;
  const current = await getKnownFromAddresses();
  const set = new Set(current.map((e) => e.toLowerCase()));
  const merged = [...current];

  for (const email of emails) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!set.has(lower)) {
      set.add(lower);
      merged.push(trimmed);
    }
  }

  // Cap at 50 addresses
  const capped = merged.slice(-50);
  await browser.storage.local.set({ [STORAGE_KEYS.KNOWN_FROM]: capped });
}

export function onTemplatesChanged(cb: (platform: Platform) => void): () => void {
  const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
    if (areaName !== 'local') return;
    for (const key of Object.keys(changes)) {
      if (key.startsWith(STORAGE_KEYS.TEMPLATES_PREFIX)) {
        const platform = key.slice(STORAGE_KEYS.TEMPLATES_PREFIX.length) as Platform;
        if (platform === 'gmail' || platform === 'teams' || platform === 'chat') {
          cb(platform);
        }
      }
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEYS.SETTINGS];
    if (change && change.newValue) {
      cb(normalizeSettings(change.newValue as Partial<Settings>));
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
