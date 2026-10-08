import {
  DEFAULT_SETTINGS,
  type KeyCombo,
  type Settings,
} from '@/core/types';
import {
  browser,
} from 'wxt/browser';
import {
  getKnownFromAddresses,
  getSettings,
  saveSettings,
} from '@/core/storage';
import { comboFromEvent, comboToLabel } from '@/core/shortcut';
import { t } from '@/core/i18n';
import { showToast } from '../components/toast';

export function createSettingsView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'settings-view-container';

  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let isRecording = false;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  // Picker Shortcut Section
  const shortcutSection = document.createElement('section');
  shortcutSection.className = 'settings-section';

  const shortcutTitle = document.createElement('h3');
  shortcutTitle.textContent = t('options_settings_shortcut_title');
  const shortcutDesc = document.createElement('p');
  shortcutDesc.className = 'settings-desc';
  shortcutDesc.textContent = t('options_settings_shortcut_desc');

  const shortcutRow = document.createElement('div');
  shortcutRow.className = 'shortcut-row';

  const shortcutDisplay = document.createElement('div');
  shortcutDisplay.id = 'shortcut-display';
  shortcutDisplay.className = 'shortcut-display-box';

  const recordBtn = document.createElement('button');
  recordBtn.id = 'record-shortcut-btn';
  recordBtn.className = 'btn btn-secondary';
  recordBtn.textContent = t('options_record_shortcut');

  const resetBtn = document.createElement('button');
  resetBtn.id = 'reset-shortcut-btn';
  resetBtn.className = 'btn btn-outline';
  resetBtn.textContent = t('options_reset_default');

  shortcutRow.appendChild(shortcutDisplay);
  shortcutRow.appendChild(recordBtn);
  shortcutRow.appendChild(resetBtn);

  const shortcutWarning = document.createElement('div');
  shortcutWarning.className = 'warning-banner';
  shortcutWarning.textContent = t('options_shortcut_ime_warning');

  shortcutSection.appendChild(shortcutTitle);
  shortcutSection.appendChild(shortcutDesc);
  shortcutSection.appendChild(shortcutRow);
  shortcutSection.appendChild(shortcutWarning);

  // Platform Enabled Toggles Section
  const togglesSection = document.createElement('section');
  togglesSection.className = 'settings-section';

  const togglesTitle = document.createElement('h3');
  togglesTitle.textContent = t('options_settings_platforms_title');

  const togglesList = document.createElement('div');
  togglesList.className = 'toggle-list';

  function createToggle(platformId: 'gmail' | 'teams' | 'chat', labelKey: string) {
    const label = document.createElement('label');
    label.className = 'toggle-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `toggle-${platformId}`;
    input.checked = currentSettings.enabled[platformId];

    input.onchange = async () => {
      currentSettings.enabled[platformId] = input.checked;
      await saveSettings(currentSettings);
      showToast(t('options_saved_success'), 'success');
    };

    const span = document.createElement('span');
    span.textContent = t(labelKey);

    label.appendChild(input);
    label.appendChild(span);
    return label;
  }

  togglesList.appendChild(createToggle('gmail', 'options_platform_gmail'));
  togglesList.appendChild(createToggle('teams', 'options_platform_teams'));
  togglesList.appendChild(createToggle('chat', 'options_platform_chat'));

  togglesSection.appendChild(togglesTitle);
  togglesSection.appendChild(togglesList);

  // Gmail Known From Addresses
  const fromSection = document.createElement('section');
  fromSection.className = 'settings-section';

  const fromTitle = document.createElement('h3');
  fromTitle.textContent = t('options_known_from_title');
  const fromDesc = document.createElement('p');
  fromDesc.className = 'settings-desc';
  fromDesc.textContent = t('options_known_from_desc');

  const fromList = document.createElement('div');
  fromList.id = 'known-from-list';
  fromList.className = 'address-chip-list';

  async function loadKnownFrom() {
    const addresses = await getKnownFromAddresses();
    fromList.innerHTML = '';
    if (addresses.length === 0) {
      const none = document.createElement('span');
      none.className = 'text-dim';
      none.textContent = t('options_known_from_empty');
      fromList.appendChild(none);
      return;
    }

    for (const email of addresses) {
      const chip = document.createElement('div');
      chip.className = 'address-chip';

      const emailText = document.createElement('span');
      emailText.textContent = email;

      const delBtn = document.createElement('button');
      delBtn.className = 'chip-del-btn';
      delBtn.textContent = '×';
      delBtn.title = t('options_delete_address');
      delBtn.onclick = async () => {
        const remaining = addresses.filter((a) => a !== email);
        await browser.storage.local.set({ 'gmail:knownFrom': remaining });
        showToast(t('options_deleted_success'), 'info');
        loadKnownFrom();
      };

      chip.appendChild(emailText);
      chip.appendChild(delBtn);
      fromList.appendChild(chip);
    }
  }

  fromSection.appendChild(fromTitle);
  fromSection.appendChild(fromDesc);
  fromSection.appendChild(fromList);

  container.appendChild(shortcutSection);
  container.appendChild(togglesSection);
  container.appendChild(fromSection);

  function updateShortcutDisplay() {
    if (isRecording) {
      shortcutDisplay.textContent = t('options_press_any_key');
      shortcutDisplay.classList.add('recording');
    } else {
      shortcutDisplay.textContent = comboToLabel(currentSettings.pickerShortcut, isMac);
      shortcutDisplay.classList.remove('recording');
    }
  }

  recordBtn.onclick = () => {
    isRecording = true;
    updateShortcutDisplay();

    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const combo = comboFromEvent(e);
      if (!combo) {
        // Only modifier key pressed, keep waiting
        return;
      }

      window.removeEventListener('keydown', onKey, true);
      isRecording = false;
      currentSettings.pickerShortcut = combo;
      await saveSettings(currentSettings);
      updateShortcutDisplay();
      showToast(t('options_shortcut_updated'), 'success');
    };

    window.addEventListener('keydown', onKey, true);
  };

  resetBtn.onclick = async () => {
    currentSettings.pickerShortcut = { ...DEFAULT_SETTINGS.pickerShortcut };
    await saveSettings(currentSettings);
    updateShortcutDisplay();
    showToast(t('options_shortcut_reset'), 'info');
  };

  getSettings().then((s) => {
    currentSettings = s;
    updateShortcutDisplay();
    (container.querySelector('#toggle-gmail') as HTMLInputElement).checked = s.enabled.gmail;
    (container.querySelector('#toggle-teams') as HTMLInputElement).checked = s.enabled.teams;
    (container.querySelector('#toggle-chat') as HTMLInputElement).checked = s.enabled.chat;
  });

  loadKnownFrom();

  return container;
}
