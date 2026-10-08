import { t } from '@/core/i18n';
import type { Platform } from '@/core/types';
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

function initOptionsApp() {
  applyI18n();

  const container = document.getElementById('views-container');
  if (!container) return;

  const tabs = document.querySelectorAll<HTMLButtonElement>('.nav-tab');
  let currentTab: TabType = 'gmail';

  // Cache views to keep state during tab switches
  const viewCache = new Map<TabType, HTMLElement>();

  function renderTab(tab: TabType) {
    currentTab = tab;

    for (const tEl of tabs) {
      if (tEl.dataset.tab === tab) {
        tEl.classList.add('active');
      } else {
        tEl.classList.remove('active');
      }
    }

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

  // Initial tab render
  renderTab('gmail');
}

document.addEventListener('DOMContentLoaded', initOptionsApp);
