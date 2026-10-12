import { browser } from 'wxt/browser';
import { getUiLocale, t } from '@/core/i18n';
import { getSettings } from '@/core/storage';
import type { Platform } from '@/core/types';
import { applyUiLanguage, helpPagePath, resolveHelpLanguage, type HelpPage } from '@/core/ui-language';
import { createTemplatesView } from './views/templates-view';
import { createSettingsView } from './views/settings-view';
import { createBackupView } from './views/backup-view';

type TabType = Platform | 'settings' | 'backup';

function applyI18n() {
  const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
  for (const el of elements) {
    const key = el.dataset.i18n;
    if (key) {
      el.textContent = t(key);
    }
  }
}

const HELP_PAGE_FOR_TAB: Record<TabType, HelpPage> = {
  gmail: 'gmail',
  teams: 'teams',
  chat: 'chat',
  settings: 'settings',
  backup: 'backup',
};

async function initOptionsApp() {
  try {
    const settings = await getSettings();
    applyUiLanguage(settings.uiLanguage);
    document.documentElement.lang = resolveHelpLanguage(settings.uiLanguage, getUiLocale());
    document.documentElement.dataset.uiLanguage = settings.uiLanguage;
  } catch (err) {
    console.warn('[FluxSnip] Failed loading settings for language:', err);
  }

  applyI18n();
  document.documentElement.classList.remove('i18n-pending');

  const container = document.getElementById('views-container');
  if (!container) return;

  const tabs = document.querySelectorAll<HTMLButtonElement>('.nav-tab');
  let currentTab: TabType = 'gmail';

  // Cache views to keep state during tab switches
  const viewCache = new Map<TabType, HTMLElement>();

  function renderTab(tab: TabType) {
    currentTab = tab;

    for (const tEl of tabs) {
      const selected = tEl.dataset.tab === tab;
      tEl.classList.toggle('active', selected);
      tEl.setAttribute('aria-selected', selected ? 'true' : 'false');
    }
    container!.setAttribute('aria-labelledby', `tab-${tab}`);

    container!.innerHTML = '';

    let view = viewCache.get(tab);
    if (!view) {
      if (tab === 'gmail' || tab === 'teams' || tab === 'chat') {
        view = createTemplatesView(tab);
      } else if (tab === 'settings') {
        view = createSettingsView();
      } else if (tab === 'backup') {
        view = createBackupView();
      }
      if (view) {
        viewCache.set(tab, view);
      }
    }

    if (view) {
      container!.appendChild(view);
    }
  }

  for (const tEl of tabs) {
    tEl.addEventListener('click', () => {
      const target = tEl.dataset.tab as TabType;
      if (target && target !== currentTab) {
        renderTab(target);
      }
    });
  }

  const helpBtn = document.getElementById('open-help-btn');
  helpBtn?.addEventListener('click', () => {
    void (async () => {
      try {
        const settings = await getSettings();
        const lang = resolveHelpLanguage(settings.uiLanguage, getUiLocale());
        const url = browser.runtime.getURL(helpPagePath(lang, HELP_PAGE_FOR_TAB[currentTab]));
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        console.warn('[FluxSnip] Failed opening help:', err);
      }
    })();
  });

  // Initial tab render
  renderTab('gmail');
}

document.addEventListener('DOMContentLoaded', initOptionsApp);
