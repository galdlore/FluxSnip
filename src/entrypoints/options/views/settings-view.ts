import {
  clampFieldWaitMs,
  DEFAULT_SETTINGS,
  FIELD_WAIT_MIN_MS,
  FIELD_WAIT_SAFE_MS,
  normalizeUiLanguage,
  type Settings,
  type UiLanguage,
} from '@/core/types';
import {
  browser,
} from 'wxt/browser';
import {
  getKnownFromAddresses,
  getSettings,
  onSettingsChanged,
  saveSettings,
} from '@/core/storage';
import { comboFromEvent, comboToLabel } from '@/core/shortcut';
import { t } from '@/core/i18n';
import { showSaveError, showToast } from '../components/toast';

export function createSettingsView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'settings-view-container';

  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let isRecording = false;

  async function persist(patch: Partial<Settings>, successMessage: string, kind: 'success' | 'info'): Promise<boolean> {
    try {
      await saveSettings(patch);
      showToast(successMessage, kind);
      return true;
    } catch (err) {
      showSaveError(err);
      return false;
    }
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  // Display language
  const languageSection = document.createElement('section');
  languageSection.className = 'settings-section';

  const languageTitle = document.createElement('h3');
  languageTitle.id = 'ui-language-heading';
  languageTitle.textContent = t('options_language_title');
  const languageDesc = document.createElement('p');
  languageDesc.className = 'settings-desc';
  languageDesc.textContent = t('options_language_desc');

  const languageSelect = document.createElement('select');
  languageSelect.id = 'ui-language-select';
  languageSelect.setAttribute('aria-labelledby', 'ui-language-heading');

  const languageChoices: { value: UiLanguage; labelKey: string }[] = [
    { value: 'auto', labelKey: 'options_language_auto' },
    { value: 'en', labelKey: 'options_language_en' },
    { value: 'ja', labelKey: 'options_language_ja' },
  ];
  for (const choice of languageChoices) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = t(choice.labelKey);
    languageSelect.appendChild(option);
  }
  languageSelect.value = currentSettings.uiLanguage;

  let reloading = false;
  const reloadForLanguage = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  languageSelect.onchange = () => {
    const next = normalizeUiLanguage(languageSelect.value);
    if (next === currentSettings.uiLanguage) return;
    void persist({ uiLanguage: next }, t('options_language_saved'), 'success').then((ok) => {
      if (!ok) {
        languageSelect.value = currentSettings.uiLanguage;
        return;
      }
      reloadForLanguage();
    });
  };

  languageSection.appendChild(languageTitle);
  languageSection.appendChild(languageDesc);
  languageSection.appendChild(languageSelect);

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
      const enabled = { ...currentSettings.enabled, [platformId]: input.checked };
      if (await persist({ enabled }, t('options_saved_success'), 'success')) {
        currentSettings.enabled = enabled;
      } else {
        input.checked = !input.checked;
      }
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

  // Gmail field wait
  const waitSection = document.createElement('section');
  waitSection.className = 'settings-section';

  const waitTitle = document.createElement('h3');
  waitTitle.textContent = t('options_field_wait_title');
  const waitDesc = document.createElement('p');
  waitDesc.className = 'settings-desc';
  waitDesc.textContent = t('options_field_wait_desc', [String(FIELD_WAIT_SAFE_MS)]);

  const waitRow = document.createElement('div');
  waitRow.className = 'shortcut-row';

  const waitInput = document.createElement('input');
  waitInput.type = 'number';
  waitInput.id = 'field-wait-input';
  waitInput.min = String(FIELD_WAIT_MIN_MS);
  waitInput.max = String(FIELD_WAIT_SAFE_MS);
  waitInput.step = '10';
  waitInput.value = String(currentSettings.fieldWaitMs);

  const waitUnit = document.createElement('span');
  waitUnit.textContent = 'ms';

  const waitResetBtn = document.createElement('button');
  waitResetBtn.className = 'btn btn-outline';
  waitResetBtn.textContent = t('options_reset_default');

  const saveFieldWait = async (value: unknown) => {
    const ms = clampFieldWaitMs(value);
    waitInput.value = String(ms);
    if (await persist({ fieldWaitMs: ms }, t('options_saved_success'), 'success')) {
      currentSettings.fieldWaitMs = ms;
    } else {
      waitInput.value = String(currentSettings.fieldWaitMs);
    }
  };

  waitInput.onchange = () => saveFieldWait(waitInput.value);
  waitResetBtn.onclick = () => saveFieldWait(DEFAULT_SETTINGS.fieldWaitMs);

  waitRow.appendChild(waitInput);
  waitRow.appendChild(waitUnit);
  waitRow.appendChild(waitResetBtn);

  waitSection.appendChild(waitTitle);
  waitSection.appendChild(waitDesc);
  waitSection.appendChild(waitRow);

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
      delBtn.setAttribute('aria-label', t('options_delete_address'));
      delBtn.onclick = async () => {
        const remaining = addresses.filter((a) => a !== email);
        try {
          await browser.storage.local.set({ 'gmail:knownFrom': remaining });
        } catch (err) {
          showSaveError(err);
          return;
        }
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

  container.appendChild(languageSection);
  container.appendChild(shortcutSection);
  container.appendChild(togglesSection);
  container.appendChild(waitSection);
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
      if (await persist({ pickerShortcut: combo }, t('options_shortcut_updated'), 'success')) {
        currentSettings.pickerShortcut = combo;
      }
      updateShortcutDisplay();
    };

    window.addEventListener('keydown', onKey, true);
  };

  resetBtn.onclick = async () => {
    const combo = { ...DEFAULT_SETTINGS.pickerShortcut };
    if (await persist({ pickerShortcut: combo }, t('options_shortcut_reset'), 'info')) {
      currentSettings.pickerShortcut = combo;
    }
    updateShortcutDisplay();
  };

  const applySettings = (s: Settings) => {
    const rendered = document.documentElement.dataset.uiLanguage;
    if (rendered && s.uiLanguage !== rendered) {
      reloadForLanguage();
      return;
    }
    currentSettings = s;
    languageSelect.value = s.uiLanguage;
    if (!isRecording) updateShortcutDisplay();
    (container.querySelector('#toggle-gmail') as HTMLInputElement).checked = s.enabled.gmail;
    (container.querySelector('#toggle-teams') as HTMLInputElement).checked = s.enabled.teams;
    (container.querySelector('#toggle-chat') as HTMLInputElement).checked = s.enabled.chat;
    if (document.activeElement !== waitInput) {
      waitInput.value = String(s.fieldWaitMs);
    }
  };

  getSettings().then(applySettings);
  // Gmail tabs may raise fieldWaitMs while this page is open; keep the local copy current
  onSettingsChanged(applySettings);

  loadKnownFrom();

  return container;
}
