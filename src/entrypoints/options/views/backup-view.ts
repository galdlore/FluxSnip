import {
  applyImport,
  buildExport,
  parseImport,
  type ImportMode,
  type ImportPreview,
} from '@/core/backup';
import { getSettings, getTemplates } from '@/core/storage';
import { t } from '@/core/i18n';
import type { Platform, Template } from '@/core/types';
import { showToast } from '../components/toast';

export function createBackupView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'backup-view-container';

  // Export Section
  const exportSection = document.createElement('section');
  exportSection.className = 'settings-section';

  const exportTitle = document.createElement('h3');
  exportTitle.textContent = t('options_export_title');
  const exportDesc = document.createElement('p');
  exportDesc.className = 'settings-desc';
  exportDesc.textContent = t('options_export_desc');

  const exportBtnRow = document.createElement('div');
  exportBtnRow.className = 'btn-group';

  async function triggerExport(filterPlatform?: Platform) {
    const gmail = (!filterPlatform || filterPlatform === 'gmail') ? await getTemplates('gmail') : [];
    const teams = (!filterPlatform || filterPlatform === 'teams') ? await getTemplates('teams') : [];
    const chat = (!filterPlatform || filterPlatform === 'chat') ? await getTemplates('chat') : [];
    const settings = !filterPlatform ? await getSettings() : undefined;

    const json = buildExport({
      templates: { gmail, teams, chat },
      settings,
    });

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `fluxsnip-backup-${filterPlatform ? `${filterPlatform}-` : ''}${timestamp}.json`;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    showToast(t('options_export_success'), 'success');
  }

  const exportAllBtn = document.createElement('button');
  exportAllBtn.id = 'export-all-btn';
  exportAllBtn.className = 'btn btn-primary';
  exportAllBtn.textContent = t('options_export_all');
  exportAllBtn.onclick = () => triggerExport();

  const exportGmailBtn = document.createElement('button');
  exportGmailBtn.id = 'export-gmail-btn';
  exportGmailBtn.className = 'btn btn-secondary';
  exportGmailBtn.textContent = t('options_export_gmail');
  exportGmailBtn.onclick = () => triggerExport('gmail');

  const exportTeamsBtn = document.createElement('button');
  exportTeamsBtn.id = 'export-teams-btn';
  exportTeamsBtn.className = 'btn btn-secondary';
  exportTeamsBtn.textContent = t('options_export_teams');
  exportTeamsBtn.onclick = () => triggerExport('teams');

  const exportChatBtn = document.createElement('button');
  exportChatBtn.id = 'export-chat-btn';
  exportChatBtn.className = 'btn btn-secondary';
  exportChatBtn.textContent = t('options_export_chat');
  exportChatBtn.onclick = () => triggerExport('chat');

  exportBtnRow.appendChild(exportAllBtn);
  exportBtnRow.appendChild(exportGmailBtn);
  exportBtnRow.appendChild(exportTeamsBtn);
  exportBtnRow.appendChild(exportChatBtn);

  exportSection.appendChild(exportTitle);
  exportSection.appendChild(exportDesc);
  exportSection.appendChild(exportBtnRow);

  // Import Section
  const importSection = document.createElement('section');
  importSection.className = 'settings-section';

  const importTitle = document.createElement('h3');
  importTitle.textContent = t('options_import_title');
  const importDesc = document.createElement('p');
  importDesc.className = 'settings-desc';
  importDesc.textContent = t('options_import_desc');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'backup-file-input';
  fileInput.accept = '.json,application/json';

  const previewBox = document.createElement('div');
  previewBox.id = 'import-preview-box';
  previewBox.className = 'import-preview-box';
  previewBox.style.display = 'none';

  let currentPreview: ImportPreview | null = null;

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const text = await file.text();
    currentPreview = parseImport(text);

    previewBox.style.display = 'block';
    previewBox.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'preview-summary';
    summary.innerHTML = `
      <strong>${t('options_import_preview_title')}</strong><br/>
      Gmail: ${currentPreview.counts.gmail} / Teams: ${currentPreview.counts.teams} / Chat: ${currentPreview.counts.chat}<br/>
      ${currentPreview.settings ? `<em>${t('options_import_has_settings')}</em>` : ''}
    `;
    previewBox.appendChild(summary);

    if (currentPreview.errors.length > 0) {
      const errBox = document.createElement('div');
      errBox.className = 'preview-errors';
      errBox.innerHTML = `<strong>${t('options_import_issues')}:</strong><ul>${currentPreview.errors.map((e) => `<li>${e}</li>`).join('')}</ul>`;
      previewBox.appendChild(errBox);
    }

    const optionsRow = document.createElement('div');
    optionsRow.className = 'import-options-row';

    const modeLabel = document.createElement('label');
    modeLabel.textContent = `${t('options_import_mode')}: `;
    const modeSelect = document.createElement('select');
    modeSelect.id = 'import-mode-select';
    modeSelect.className = 'segment-select';
    modeSelect.innerHTML = `
      <option value="merge">${t('options_import_mode_merge')}</option>
      <option value="replace">${t('options_import_mode_replace')}</option>
    `;
    modeLabel.appendChild(modeSelect);

    const settingsLabel = document.createElement('label');
    settingsLabel.className = 'checkbox-label';
    const settingsCheckbox = document.createElement('input');
    settingsCheckbox.type = 'checkbox';
    settingsCheckbox.id = 'import-settings-checkbox';
    settingsCheckbox.checked = true;
    settingsLabel.appendChild(settingsCheckbox);
    settingsLabel.appendChild(document.createTextNode(` ${t('options_import_include_settings')}`));

    const executeBtn = document.createElement('button');
    executeBtn.id = 'execute-import-btn';
    executeBtn.className = 'btn btn-primary';
    executeBtn.textContent = t('options_execute_import');
    executeBtn.onclick = async () => {
      if (!currentPreview) return;
      const mode = modeSelect.value as ImportMode;
      const includeSettings = settingsCheckbox.checked;

      const res = await applyImport(currentPreview, mode, includeSettings);
      showToast(
        t('options_import_completed', [String(res.added), String(res.updated), String(res.skipped)]),
        'success'
      );
      previewBox.style.display = 'none';
      fileInput.value = '';
      currentPreview = null;
    };

    optionsRow.appendChild(modeLabel);
    if (currentPreview.settings) {
      optionsRow.appendChild(settingsLabel);
    }
    optionsRow.appendChild(executeBtn);

    previewBox.appendChild(optionsRow);
  };

  importSection.appendChild(importTitle);
  importSection.appendChild(importDesc);
  importSection.appendChild(fileInput);
  importSection.appendChild(previewBox);

  // Sync Guide Section
  const syncSection = document.createElement('section');
  syncSection.className = 'settings-section sync-guide-section';

  const syncTitle = document.createElement('h3');
  syncTitle.textContent = t('options_sync_guide_title');
  const syncDesc = document.createElement('div');
  syncDesc.className = 'settings-desc';
  syncDesc.innerHTML = `
    <p>${t('options_sync_guide_step1')}</p>
    <ol>
      <li>${t('options_sync_guide_step2')}</li>
      <li>${t('options_sync_guide_step3')}</li>
      <li>${t('options_sync_guide_step4')}</li>
    </ol>
  `;

  syncSection.appendChild(syncTitle);
  syncSection.appendChild(syncDesc);

  container.appendChild(exportSection);
  container.appendChild(importSection);
  container.appendChild(syncSection);

  return container;
}
