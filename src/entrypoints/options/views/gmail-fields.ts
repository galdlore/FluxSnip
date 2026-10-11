import { getKnownFromAddresses } from '@/core/storage';
import { parseEmailList } from '@/core/validate';
import { t } from '@/core/i18n';
import type { GmailTemplate, RecipientField, RecipientMode, SubjectMode } from '@/core/types';

export interface GmailFieldsComponent {
  readonly element: HTMLElement;
  setValues(tpl: Partial<GmailTemplate>): void;
  getValues(): Partial<GmailTemplate>;
  onChange(cb: () => void): void;
}

export function createGmailFields(): GmailFieldsComponent {
  const container = document.createElement('div');
  container.className = 'gmail-fields-container';

  let changeCallbacks: Array<() => void> = [];
  const notifyChange = () => {
    for (const cb of changeCallbacks) cb();
  };

  // From address
  const fromGroup = document.createElement('div');
  fromGroup.className = 'form-group';
  const fromLabel = document.createElement('label');
  fromLabel.htmlFor = 'gmail-from-input';
  fromLabel.textContent = t('options_gmail_from');
  const fromInput = document.createElement('input');
  fromInput.type = 'email';
  fromInput.id = 'gmail-from-input';
  fromInput.setAttribute('list', 'gmail-known-from-list');
  fromInput.placeholder = 'alias@example.com';
  const fromDataList = document.createElement('datalist');
  fromDataList.id = 'gmail-known-from-list';
  const fromHelp = document.createElement('span');
  fromHelp.className = 'form-help-text';
  fromHelp.textContent = t('options_gmail_from_help');

  fromGroup.appendChild(fromLabel);
  fromGroup.appendChild(fromInput);
  fromGroup.appendChild(fromDataList);
  fromGroup.appendChild(fromHelp);
  fromInput.addEventListener('input', notifyChange);

  // Load known from addresses into datalist
  getKnownFromAddresses().then((emails) => {
    fromDataList.innerHTML = '';
    for (const email of emails) {
      const opt = document.createElement('option');
      opt.value = email;
      fromDataList.appendChild(opt);
    }
  });

  // Subject
  const subjectGroup = document.createElement('div');
  subjectGroup.className = 'form-group';
  const subjectLabel = document.createElement('label');
  subjectLabel.htmlFor = 'gmail-subject-input';
  subjectLabel.textContent = t('options_gmail_subject');
  const subjectRow = document.createElement('div');
  subjectRow.className = 'form-row';

  const subjectInput = document.createElement('input');
  subjectInput.type = 'text';
  subjectInput.id = 'gmail-subject-input';
  subjectInput.placeholder = t('options_gmail_subject_placeholder');
  subjectInput.addEventListener('input', notifyChange);

  const subjectModeSelect = document.createElement('select');
  subjectModeSelect.id = 'gmail-subject-mode-select';
  subjectModeSelect.className = 'segment-select';
  const optSubReplace = document.createElement('option');
  optSubReplace.value = 'replace';
  optSubReplace.textContent = t('options_mode_replace');
  const optSubIfEmpty = document.createElement('option');
  optSubIfEmpty.value = 'ifEmpty';
  optSubIfEmpty.textContent = t('options_mode_if_empty');
  subjectModeSelect.appendChild(optSubReplace);
  subjectModeSelect.appendChild(optSubIfEmpty);
  subjectModeSelect.addEventListener('change', notifyChange);

  subjectRow.appendChild(subjectInput);
  subjectRow.appendChild(subjectModeSelect);
  subjectGroup.appendChild(subjectLabel);
  subjectGroup.appendChild(subjectRow);

  // Helper for To / Cc / Bcc fields
  function createRecipientRow(fieldId: 'to' | 'cc' | 'bcc', labelKey: string) {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.htmlFor = `gmail-${fieldId}-input`;
    label.textContent = t(labelKey);

    const row = document.createElement('div');
    row.className = 'form-row';

    const textarea = document.createElement('textarea');
    textarea.id = `gmail-${fieldId}-input`;
    textarea.rows = 2;
    textarea.placeholder = 'alice@example.com, bob@example.com';
    textarea.addEventListener('input', notifyChange);

    const modeSelect = document.createElement('select');
    modeSelect.id = `gmail-${fieldId}-mode-select`;
    modeSelect.className = 'segment-select';
    const optReplace = document.createElement('option');
    optReplace.value = 'replace';
    optReplace.textContent = t('options_mode_replace');
    const optAppend = document.createElement('option');
    optAppend.value = 'append';
    optAppend.textContent = t('options_mode_append');
    modeSelect.appendChild(optReplace);
    modeSelect.appendChild(optAppend);
    modeSelect.addEventListener('change', notifyChange);

    row.appendChild(textarea);
    row.appendChild(modeSelect);
    group.appendChild(label);
    group.appendChild(row);

    return { group, textarea, modeSelect };
  }

  const toField = createRecipientRow('to', 'options_gmail_to');
  const ccField = createRecipientRow('cc', 'options_gmail_cc');
  const bccField = createRecipientRow('bcc', 'options_gmail_bcc');

  // Gemini AI prompt auto submit checkbox
  const aiGroup = document.createElement('div');
  aiGroup.className = 'form-group form-group-checkbox';

  const aiLabel = document.createElement('label');
  aiLabel.className = 'checkbox-label';

  const aiCheckbox = document.createElement('input');
  aiCheckbox.type = 'checkbox';
  aiCheckbox.id = 'gmail-auto-submit-ai-checkbox';
  aiCheckbox.addEventListener('change', notifyChange);

  const aiText = document.createElement('span');
  aiText.textContent = t('options_gmail_auto_submit_ai');

  aiLabel.appendChild(aiCheckbox);
  aiLabel.appendChild(aiText);

  const aiHelp = document.createElement('span');
  aiHelp.className = 'form-help-text';
  aiHelp.textContent = t('options_gmail_auto_submit_ai_help');

  aiGroup.appendChild(aiLabel);
  aiGroup.appendChild(aiHelp);

  container.appendChild(fromGroup);
  container.appendChild(subjectGroup);
  container.appendChild(toField.group);
  container.appendChild(ccField.group);
  container.appendChild(bccField.group);
  container.appendChild(aiGroup);

  return {
    element: container,
    setValues(tpl: Partial<GmailTemplate>) {
      fromInput.value = tpl.from || '';

      if (tpl.subject) {
        subjectInput.value = tpl.subject.value || '';
        subjectModeSelect.value = tpl.subject.mode || 'replace';
      } else {
        subjectInput.value = '';
        subjectModeSelect.value = 'replace';
      }

      const applyRec = (field: ReturnType<typeof createRecipientRow>, rec?: RecipientField) => {
        if (rec && rec.emails && rec.emails.length > 0) {
          field.textarea.value = rec.emails.join(', ');
          field.modeSelect.value = rec.mode || 'replace';
        } else {
          field.textarea.value = '';
          field.modeSelect.value = 'replace';
        }
      };

      applyRec(toField, tpl.to);
      applyRec(ccField, tpl.cc);
      applyRec(bccField, tpl.bcc);

      aiCheckbox.checked = !!tpl.autoSubmitAi;
    },
    getValues(): Partial<GmailTemplate> {
      const fromVal = fromInput.value.trim();
      const subjectVal = subjectInput.value.trim();

      const parseRec = (field: ReturnType<typeof createRecipientRow>): RecipientField | undefined => {
        const emails = parseEmailList(field.textarea.value);
        if (emails.length === 0) return undefined;
        return {
          mode: field.modeSelect.value as RecipientMode,
          emails,
        };
      };

      return {
        from: fromVal.length > 0 ? fromVal : undefined,
        subject: subjectVal.length > 0
          ? {
              value: subjectVal,
              mode: subjectModeSelect.value as SubjectMode,
            }
          : undefined,
        to: parseRec(toField),
        cc: parseRec(ccField),
        bcc: parseRec(bccField),
        autoSubmitAi: aiCheckbox.checked,
      };
    },
    onChange(cb: () => void) {
      changeCallbacks.push(cb);
    },
  };
}
