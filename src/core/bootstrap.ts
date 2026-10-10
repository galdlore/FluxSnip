import type { PlatformAdapter } from './adapter';
import { deepActiveElement, getCaretRange } from './dom';
import { tryExpand } from './expander';
import { findTemplateByKeyword } from './keyword';
import { openPicker } from './ui/picker';
import { runTemplate } from './runner';
import { matchesCombo } from './shortcut';
import {
  getSettings,
  getTemplates,
  onSettingsChanged,
  onTemplatesChanged,
} from './storage';
import { DEFAULT_SETTINGS, type Platform, type Settings, type Template } from './types';

/**
 * Initializes content script runtime with given platform adapters.
 * Returns an unmount function for cleaning up event listeners.
 */
export function startContent(adapters: PlatformAdapter[]): () => void {
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const templatesCache: Record<Platform, Template[]> = {
    gmail: [],
    teams: [],
    chat: [],
  };

  let isExecuting = false;

  // Load initial settings and templates
  getSettings()
    .then((s) => {
      settings = s;
    })
    .catch((err) => {
      console.warn('[FluxSnip] Failed loading settings:', err);
    });

  const loadTemplates = async (platform: Platform) => {
    try {
      const list = await getTemplates(platform);
      templatesCache[platform] = list;
    } catch (err) {
      console.warn(`[FluxSnip] Failed loading templates for ${platform}:`, err);
    }
  };

  adapters.forEach((a) => {
    loadTemplates(a.platform);
  });

  const unsubTemplates = onTemplatesChanged((platform) => {
    loadTemplates(platform);
  });

  const unsubSettings = onSettingsChanged((newSettings) => {
    settings = newSettings;
  });

  function findActiveAdapterAndEditor(): { adapter: PlatformAdapter; editor: HTMLElement } | null {
    const active = deepActiveElement();
    if (!active) return null;

    for (const adapter of adapters) {
      if (!settings.enabled[adapter.platform]) continue;
      const editor = adapter.findEditor(active);
      if (editor) {
        return { adapter, editor };
      }
    }

    return null;
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    // Ignore events during IME composition or while another template is executing
    if (e.isComposing || e.keyCode === 229) {
      return;
    }

    // 1. Check for Tab expansion
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (isExecuting) return;

      const active = findActiveAdapterAndEditor();
      if (!active) return;

      const { adapter, editor } = active;

      // Tab expansion strictly applies when typing directly inside the body editor (not header fields)
      const currentActive = deepActiveElement();
      if (!currentActive || !editor.contains(currentActive)) {
        return;
      }

      const templates = templatesCache[adapter.platform] ?? [];
      const tokenRange = tryExpand(e, adapter, editor, templates);

      if (tokenRange) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const token = tokenRange.toString();
        const matched = findTemplateByKeyword(token, templates);
        if (matched) {
          isExecuting = true;
          try {
            await runTemplate(adapter, editor, matched, tokenRange);
          } finally {
            isExecuting = false;
          }
        }
      }
      return;
    }

    // 2. Check for Picker shortcut
    if (matchesCombo(e, settings.pickerShortcut)) {
      if (isExecuting) return;

      const active = findActiveAdapterAndEditor();
      if (!active) return;

      const { adapter, editor } = active;
      e.preventDefault();
      e.stopImmediatePropagation();

      const rawActive = deepActiveElement();
      const savedRange = getCaretRange();
      let anchorRect: DOMRect;

      if (rawActive && rawActive instanceof HTMLElement && !editor.contains(rawActive)) {
        // Focused on header field (e.g. To, Cc, Subject): anchor popup near the active field
        anchorRect = rawActive.getBoundingClientRect();
      } else if (savedRange) {
        const rect = savedRange.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          anchorRect = rect;
        } else {
          anchorRect = editor.getBoundingClientRect();
        }
      } else {
        anchorRect = editor.getBoundingClientRect();
      }

      // Target range for template insertion (must be valid inside editor)
      const targetRange =
        savedRange && editor.contains(savedRange.commonAncestorContainer)
          ? savedRange
          : (() => {
              const r = document.createRange();
              r.selectNodeContents(editor);
              r.collapse(false);
              return r;
            })();

      const templates = templatesCache[adapter.platform] ?? [];

      openPicker({
        templates,
        anchorRect,
        onSelect: async (selected) => {
          isExecuting = true;
          try {
            await runTemplate(adapter, editor, selected, targetRange);
          } finally {
            isExecuting = false;
          }
        },
        onClose: () => {
          if (rawActive && rawActive instanceof HTMLElement && rawActive.isConnected) {
            rawActive.focus();
          } else {
            editor.focus();
          }
        },
      });
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    unsubTemplates();
    unsubSettings();
  };
}
