import { astToChatText, astToHtml } from '@/core/html/ast';
import { sanitizeHtml } from '@/core/html/sanitize';
import { t } from '@/core/i18n';
import { MAX_BODY_HTML_BYTES, type Platform } from '@/core/types';
import { createEditorToolbar, type EditorToolbar } from './editor-toolbar';
import { showTableContextMenu } from './table-picker';

export interface BodyEditor {
  readonly element: HTMLElement;
  getHtml(): string;
  setHtml(html: string): void;
  onChange(cb: () => void): void;
  setPlatform(p: Platform): void;
}

type EditorMode = 'visual' | 'html' | 'preview';

export function createBodyEditor(initialPlatform: Platform): BodyEditor {
  const container = document.createElement('div');
  container.className = 'rich-body-editor';

  let currentPlatform: Platform = initialPlatform;
  let currentMode: EditorMode = 'visual';
  let changeListeners: Array<() => void> = [];

  const notifyChange = () => {
    updateByteCount();
    checkChatCompatibility();
    for (const cb of changeListeners) cb();
  };

  // Warning Banner for Google Chat restrictions
  const chatWarningBanner = document.createElement('div');
  chatWarningBanner.className = 'chat-warning-banner';
  chatWarningBanner.textContent = t('editor_chat_unsupported_warning');
  chatWarningBanner.style.display = 'none';

  // Header / Tabs
  const header = document.createElement('div');
  header.className = 'editor-header';

  const tabsRow = document.createElement('div');
  tabsRow.className = 'editor-mode-tabs';

  function createModeTab(mode: EditorMode, labelKey: string) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `editor-mode-tab ${mode === currentMode ? 'active' : ''}`;
    btn.dataset.mode = mode;
    btn.textContent = t(labelKey);
    btn.onclick = (e) => {
      e.preventDefault();
      switchMode(mode);
    };
    return btn;
  }

  const visualTab = createModeTab('visual', 'editor_tab_visual');
  const htmlTab = createModeTab('html', 'editor_tab_html');
  const previewTab = createModeTab('preview', 'editor_tab_preview');

  tabsRow.appendChild(visualTab);
  tabsRow.appendChild(htmlTab);
  tabsRow.appendChild(previewTab);

  const byteCounter = document.createElement('span');
  byteCounter.className = 'byte-counter';

  header.appendChild(tabsRow);
  header.appendChild(byteCounter);

  // Visual Editor
  const visualWrapper = document.createElement('div');
  visualWrapper.className = 'editor-visual-wrapper';

  const visualEl = document.createElement('div');
  visualEl.id = 'body-visual-editor';
  visualEl.className = 'visual-contenteditable';
  visualEl.contentEditable = 'true';
  visualEl.setAttribute('role', 'textbox');

  const toolbar: EditorToolbar = createEditorToolbar(visualEl, notifyChange, initialPlatform);
  visualWrapper.appendChild(toolbar.element);
  visualWrapper.appendChild(visualEl);

  // HTML Source Textarea
  const htmlTextarea = document.createElement('textarea');
  htmlTextarea.id = 'body-html-textarea';
  htmlTextarea.className = 'html-source-textarea';
  htmlTextarea.rows = 12;
  htmlTextarea.placeholder = '<div>Write raw HTML here...</div>';
  htmlTextarea.style.display = 'none';

  // Preview Pane
  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'editor-preview-wrapper';
  previewWrapper.style.display = 'none';

  const htmlPreviewBox = document.createElement('div');
  htmlPreviewBox.className = 'preview-box html-preview-box';

  const chatPreviewBox = document.createElement('div');
  chatPreviewBox.className = 'preview-box chat-preview-box';

  previewWrapper.appendChild(htmlPreviewBox);
  previewWrapper.appendChild(chatPreviewBox);

  container.appendChild(chatWarningBanner);
  container.appendChild(header);
  container.appendChild(visualWrapper);
  container.appendChild(htmlTextarea);
  container.appendChild(previewWrapper);

  // Helper to extract current canonical HTML
  function getCurrentHtml(): string {
    if (currentMode === 'visual') {
      return visualEl.innerHTML;
    }
    if (currentMode === 'html') {
      return htmlTextarea.value;
    }
    // Preview mode
    return visualEl.innerHTML;
  }

  function updateByteCount() {
    const raw = getCurrentHtml();
    const bytes = new TextEncoder().encode(raw).length;
    const max = MAX_BODY_HTML_BYTES;
    byteCounter.textContent = `${(bytes / 1024).toFixed(1)} KB / ${(max / 1024).toFixed(0)} KB`;
    if (bytes > max) {
      byteCounter.classList.add('error');
    } else {
      byteCounter.classList.remove('error');
    }
  }

  function checkChatCompatibility() {
    if (currentPlatform !== 'chat') {
      chatWarningBanner.style.display = 'none';
      return;
    }

    const html = getCurrentHtml().toLowerCase();
    const hasUnsupported =
      html.includes('<table') ||
      html.includes('<img') ||
      html.includes('<h1') ||
      html.includes('<h2') ||
      html.includes('<h3');

    if (hasUnsupported) {
      chatWarningBanner.style.display = 'block';
    } else {
      chatWarningBanner.style.display = 'none';
    }
  }

  function switchMode(newMode: EditorMode) {
    if (newMode === currentMode) return;

    // Synchronize content before switching
    const currentHtml = getCurrentHtml();
    const { html, ast } = sanitizeHtml(currentHtml);

    if (newMode === 'visual') {
      visualEl.innerHTML = html;
      visualWrapper.style.display = 'block';
      htmlTextarea.style.display = 'none';
      previewWrapper.style.display = 'none';
      toolbar.updateState();
    } else if (newMode === 'html') {
      htmlTextarea.value = html;
      visualWrapper.style.display = 'none';
      htmlTextarea.style.display = 'block';
      previewWrapper.style.display = 'none';
    } else if (newMode === 'preview') {
      visualEl.innerHTML = html;
      visualWrapper.style.display = 'none';
      htmlTextarea.style.display = 'none';
      previewWrapper.style.display = 'flex';

      // Render previews
      htmlPreviewBox.innerHTML = `
        <div class="preview-header">${t('editor_preview_html_label')}</div>
        <div class="preview-content">${html}</div>
      `;

      const chatText = astToChatText(ast);
      chatPreviewBox.innerHTML = `
        <div class="preview-header">${t('editor_preview_chat_label')}</div>
        <div class="preview-content chat-text-content">${escapeText(chatText)}</div>
      `;
    }

    currentMode = newMode;
    visualTab.classList.toggle('active', newMode === 'visual');
    htmlTab.classList.toggle('active', newMode === 'html');
    previewTab.classList.toggle('active', newMode === 'preview');

    notifyChange();
  }

  function escapeText(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // Visual editor events
  visualEl.addEventListener('input', notifyChange);

  // Paste handling with HTML sanitization
  visualEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const clip = e.clipboardData;
    if (!clip) return;

    const htmlData = clip.getData('text/html');
    if (htmlData) {
      const { html } = sanitizeHtml(htmlData);
      document.execCommand('insertHTML', false, html);
    } else {
      const textData = clip.getData('text/plain');
      const lines = textData.split('\n');
      const htmlFromText = lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>');
      document.execCommand('insertHTML', false, htmlFromText);
    }
    notifyChange();
  });

  // Table context menu handler
  visualEl.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th') as HTMLTableCellElement | null;
    if (cell && visualEl.contains(cell)) {
      e.preventDefault();
      showTableContextMenu(e, cell, notifyChange);
    }
  });

  // HTML source textarea events
  htmlTextarea.addEventListener('input', notifyChange);

  return {
    element: container,
    getHtml() {
      const raw = getCurrentHtml();
      return sanitizeHtml(raw).html;
    },
    setHtml(newHtml: string) {
      const { html } = sanitizeHtml(newHtml);
      visualEl.innerHTML = html;
      htmlTextarea.value = html;
      updateByteCount();
      checkChatCompatibility();
    },
    onChange(cb: () => void) {
      changeListeners.push(cb);
    },
    setPlatform(p: Platform) {
      currentPlatform = p;
      toolbar.setPlatform(p);
      checkChatCompatibility();
    },
  };
}
