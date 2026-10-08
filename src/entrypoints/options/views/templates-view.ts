import {
  deleteTemplate,
  getTemplates,
  saveTemplate,
} from '@/core/storage';
import { sanitizeHtml } from '@/core/html/sanitize';
import { newTemplate, validateTemplate } from '@/core/validate';
import { t } from '@/core/i18n';
import type { GmailTemplate, Platform, Template } from '@/core/types';
import { createBodyEditor, type BodyEditor } from '../components/body-editor';
import { createGmailFields, type GmailFieldsComponent } from './gmail-fields';
import { showToast } from '../components/toast';

export function createTemplatesView(platform: Platform): HTMLElement {
  const root = document.createElement('div');
  root.className = 'templates-view-container';

  let currentTemplates: Template[] = [];
  let selectedTemplate: Template | null = null;
  let isDirty = false;

  // Split layout: Sidebar (List) + Main (Editor Form)
  const sidebar = document.createElement('aside');
  sidebar.className = 'templates-sidebar';

  const sidebarHeader = document.createElement('div');
  sidebarHeader.className = 'sidebar-header';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = `${platform}-search-input`;
  searchInput.className = 'search-input';
  searchInput.placeholder = t('options_search_placeholder');

  const newBtn = document.createElement('button');
  newBtn.id = `${platform}-new-btn`;
  newBtn.className = 'btn btn-primary new-btn';
  newBtn.textContent = t('options_new_template');

  sidebarHeader.appendChild(searchInput);
  sidebarHeader.appendChild(newBtn);

  const listEl = document.createElement('div');
  listEl.id = `${platform}-template-list`;
  listEl.className = 'template-list';

  sidebar.appendChild(sidebarHeader);
  sidebar.appendChild(listEl);

  // Main Editor Form
  const main = document.createElement('main');
  main.className = 'templates-main';

  const form = document.createElement('div');
  form.className = 'template-form';

  // Empty state
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = t('options_select_or_create_prompt');

  // Form Fields
  const nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';
  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = `${platform}-name-input`;
  nameLabel.textContent = t('options_template_name');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = `${platform}-name-input`;
  const nameError = document.createElement('div');
  nameError.className = 'field-error';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  nameGroup.appendChild(nameError);

  const metaRow = document.createElement('div');
  metaRow.className = 'form-row';

  const kwGroup = document.createElement('div');
  kwGroup.className = 'form-group flex-1';
  const kwLabel = document.createElement('label');
  kwLabel.htmlFor = `${platform}-keyword-input`;
  kwLabel.textContent = t('options_template_keyword');
  const kwInput = document.createElement('input');
  kwInput.type = 'text';
  kwInput.id = `${platform}-keyword-input`;
  kwInput.placeholder = ';thx';
  const kwError = document.createElement('div');
  kwError.className = 'field-error';
  kwGroup.appendChild(kwLabel);
  kwGroup.appendChild(kwInput);
  kwGroup.appendChild(kwError);

  const tagsGroup = document.createElement('div');
  tagsGroup.className = 'form-group flex-1';
  const tagsLabel = document.createElement('label');
  tagsLabel.htmlFor = `${platform}-tags-input`;
  tagsLabel.textContent = t('options_template_tags');
  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.id = `${platform}-tags-input`;
  tagsInput.placeholder = 'work, support';
  tagsGroup.appendChild(tagsLabel);
  tagsGroup.appendChild(tagsInput);

  metaRow.appendChild(kwGroup);
  metaRow.appendChild(tagsGroup);

  // Gmail extra fields
  let gmailFields: GmailFieldsComponent | null = null;
  if (platform === 'gmail') {
    gmailFields = createGmailFields();
  }

  // Body Editor
  const bodyGroup = document.createElement('div');
  bodyGroup.className = 'form-group body-group';
  const bodyLabel = document.createElement('label');
  bodyLabel.textContent = t('options_template_body');
  const bodyEditor: BodyEditor = createBodyEditor(platform);
  const bodyError = document.createElement('div');
  bodyError.className = 'field-error';
  bodyGroup.appendChild(bodyLabel);
  bodyGroup.appendChild(bodyEditor.element);
  bodyGroup.appendChild(bodyError);

  // Variables Help Accordion
  const helpAccordion = document.createElement('details');
  helpAccordion.className = 'variables-help';
  const helpSummary = document.createElement('summary');
  helpSummary.textContent = t('options_variables_help_title');
  const helpContent = document.createElement('div');
  helpContent.className = 'variables-help-content';
  helpContent.innerHTML = `
    <table class="help-table">
      <tr><td><code>{{date}}</code></td><td>${t('options_var_date')} (YYYY/MM/DD)</td></tr>
      <tr><td><code>{{date:YYYY年M月D日}}</code></td><td>${t('options_var_date_custom')}</td></tr>
      <tr><td><code>{{time}}</code></td><td>${t('options_var_time')} (HH:mm)</td></tr>
      <tr><td><code>{{weekday}}</code></td><td>${t('options_var_weekday')}</td></tr>
      ${
        platform === 'gmail'
          ? `
      <tr><td><code>{{to.name}}</code></td><td>${t('options_var_to_name')}</td></tr>
      <tr><td><code>{{to.firstName}}</code></td><td>${t('options_var_to_first_name')}</td></tr>
      <tr><td><code>{{to.lastName}}</code></td><td>${t('options_var_to_last_name')}</td></tr>
      <tr><td><code>{{to.email}}</code></td><td>${t('options_var_to_email')}</td></tr>
      <tr><td><code>{{from.name}}</code></td><td>${t('options_var_from_name')}</td></tr>
      <tr><td><code>{{from.email}}</code></td><td>${t('options_var_from_email')}</td></tr>
      `
          : ''
      }
    </table>
  `;
  helpAccordion.appendChild(helpSummary);
  helpAccordion.appendChild(helpContent);

  // Action Buttons
  const actionsRow = document.createElement('div');
  actionsRow.className = 'form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.id = `${platform}-save-btn`;
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = t('options_save_btn');

  const duplicateBtn = document.createElement('button');
  duplicateBtn.id = `${platform}-duplicate-btn`;
  duplicateBtn.className = 'btn btn-secondary';
  duplicateBtn.textContent = t('options_duplicate_btn');

  const deleteBtn = document.createElement('button');
  deleteBtn.id = `${platform}-delete-btn`;
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = t('options_delete_btn');

  actionsRow.appendChild(saveBtn);
  actionsRow.appendChild(duplicateBtn);
  actionsRow.appendChild(deleteBtn);

  form.appendChild(nameGroup);
  form.appendChild(metaRow);
  if (gmailFields) {
    form.appendChild(gmailFields.element);
  }
  form.appendChild(bodyGroup);
  form.appendChild(helpAccordion);
  form.appendChild(actionsRow);

  main.appendChild(emptyState);
  main.appendChild(form);

  root.appendChild(sidebar);
  root.appendChild(main);

  // Set initial state
  form.style.display = 'none';

  // Modal confirm utility
  function showConfirmModal(title: string, message: string, onConfirm: () => void) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;

    const row = document.createElement('div');
    row.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('options_cancel');
    cancelBtn.onclick = () => overlay.remove();

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-danger';
    okBtn.textContent = t('options_confirm');
    okBtn.onclick = () => {
      overlay.remove();
      onConfirm();
    };

    row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    dialog.appendChild(h3);
    dialog.appendChild(p);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // Change tracking
  const markDirty = () => {
    isDirty = true;
  };
  nameInput.addEventListener('input', markDirty);
  kwInput.addEventListener('input', markDirty);
  tagsInput.addEventListener('input', markDirty);
  bodyEditor.onChange(markDirty);
  if (gmailFields) {
    gmailFields.onChange(markDirty);
  }

  function clearErrors() {
    nameError.textContent = '';
    kwError.textContent = '';
    bodyError.textContent = '';
  }

  function renderList() {
    listEl.innerHTML = '';
    const query = searchInput.value.toLowerCase().trim();

    // Check keyword duplicates
    const kwCount = new Map<string, number>();
    for (const item of currentTemplates) {
      if (item.keyword) {
        kwCount.set(item.keyword, (kwCount.get(item.keyword) || 0) + 1);
      }
    }

    const filtered = currentTemplates.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.keyword.toLowerCase().includes(query) ||
        item.tags.some((tg) => tg.toLowerCase().includes(query)) ||
        item.bodyHtml.toLowerCase().includes(query)
      );
    });

    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = `template-card ${selectedTemplate?.id === item.id ? 'active' : ''}`;
      card.dataset.id = item.id;

      const titleRow = document.createElement('div');
      titleRow.className = 'card-title-row';

      const title = document.createElement('span');
      title.className = 'card-title';
      title.textContent = item.name || t('options_untitled');
      titleRow.appendChild(title);

      if (kwCount.get(item.keyword)! > 1) {
        const warnIcon = document.createElement('span');
        warnIcon.className = 'kw-warn-icon';
        warnIcon.title = t('validate_keyword_duplicate');
        warnIcon.textContent = ' ⚠️';
        titleRow.appendChild(warnIcon);
      }

      const meta = document.createElement('div');
      meta.className = 'card-meta';

      const kwBadge = document.createElement('span');
      kwBadge.className = 'badge keyword-badge';
      kwBadge.textContent = item.keyword || '---';
      meta.appendChild(kwBadge);

      for (const tag of item.tags) {
        const tBadge = document.createElement('span');
        tBadge.className = 'badge tag-badge';
        tBadge.textContent = tag;
        meta.appendChild(tBadge);
      }

      if (platform === 'gmail') {
        const g = item as GmailTemplate;
        if (g.to?.emails?.length || g.from) {
          const recBadge = document.createElement('span');
          recBadge.className = 'badge info-badge';
          recBadge.textContent = '✉';
          meta.appendChild(recBadge);
        }
      }

      card.appendChild(titleRow);
      card.appendChild(meta);

      card.onclick = () => {
        if (selectedTemplate?.id === item.id) return;
        if (isDirty) {
          showConfirmModal(
            t('options_discard_changes_title'),
            t('options_discard_changes_msg'),
            () => selectTemplate(item)
          );
        } else {
          selectTemplate(item);
        }
      };

      listEl.appendChild(card);
    }
  }

  function selectTemplate(tpl: Template | null) {
    selectedTemplate = tpl;
    clearErrors();
    isDirty = false;

    if (!tpl) {
      emptyState.style.display = 'block';
      form.style.display = 'none';
      renderList();
      return;
    }

    emptyState.style.display = 'none';
    form.style.display = 'block';

    nameInput.value = tpl.name;
    kwInput.value = tpl.keyword;
    tagsInput.value = tpl.tags.join(', ');
    bodyEditor.setHtml(tpl.bodyHtml);

    if (platform === 'gmail' && gmailFields) {
      gmailFields.setValues(tpl as GmailTemplate);
    }

    renderList();
  }

  async function loadTemplates() {
    currentTemplates = await getTemplates(platform);
    currentTemplates.sort((a, b) => b.updatedAt - a.updatedAt);
    renderList();
  }

  newBtn.onclick = () => {
    if (isDirty) {
      showConfirmModal(
        t('options_discard_changes_title'),
        t('options_discard_changes_msg'),
        () => createNew()
      );
    } else {
      createNew();
    }
  };

  function createNew() {
    const fresh = newTemplate(platform);
    selectTemplate(fresh);
  }

  async function handleSave() {
    if (!selectedTemplate) return;
    clearErrors();

    const name = nameInput.value.trim();
    const keyword = kwInput.value.trim();
    const tags = tagsInput.value
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const rawHtml = bodyEditor.getHtml();
    const { html, ast } = sanitizeHtml(rawHtml);

    let updatedTpl: Template = {
      ...selectedTemplate,
      name,
      keyword,
      tags,
      bodyHtml: html,
      bodyAst: ast,
      updatedAt: Date.now(),
    };

    if (platform === 'gmail' && gmailFields) {
      const gVals = gmailFields.getValues();
      updatedTpl = {
        ...updatedTpl,
        ...gVals,
      } as GmailTemplate;
    }

    const issues = validateTemplate(updatedTpl, currentTemplates);
    if (issues.length > 0) {
      for (const issue of issues) {
        const msg = t(issue.messageKey);
        if (issue.field === 'name') nameError.textContent = msg;
        else if (issue.field === 'keyword') kwError.textContent = msg;
        else if (issue.field === 'bodyHtml') bodyError.textContent = msg;
        else showToast(msg, 'error');
      }
      return;
    }

    await saveTemplate(updatedTpl);
    isDirty = false;
    showToast(t('options_saved_success'), 'success');

    await loadTemplates();
    const saved = currentTemplates.find((i) => i.id === updatedTpl.id);
    selectTemplate(saved || null);
  }

  saveBtn.onclick = handleSave;

  duplicateBtn.onclick = () => {
    if (!selectedTemplate) return;
    const isJapanese = (navigator.language || '').toLowerCase().startsWith('ja');
    const copySuffix = isJapanese ? '（コピー）' : ' (copy)';

    const duplicated: Template = {
      ...selectedTemplate,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `copy-${Date.now()}`,
      name: `${selectedTemplate.name}${copySuffix}`,
      keyword: '', // Keyword is cleared for new copy
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    selectTemplate(duplicated);
    isDirty = true;
    showToast(t('options_duplicated_prompt'), 'info');
  };

  deleteBtn.onclick = () => {
    if (!selectedTemplate) return;
    showConfirmModal(
      t('options_delete_confirm_title'),
      t('options_delete_confirm_msg', selectedTemplate.name),
      async () => {
        if (selectedTemplate) {
          await deleteTemplate(platform, selectedTemplate.id);
          showToast(t('options_deleted_success'), 'success');
          await loadTemplates();
          selectTemplate(null);
        }
      }
    );
  };

  searchInput.addEventListener('input', () => {
    renderList();
  });

  // Shortcut Ctrl+S / Cmd+S
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      if (selectedTemplate && form.style.display !== 'none') {
        e.preventDefault();
        handleSave();
      }
    }
  });

  loadTemplates();
  return root;
}
