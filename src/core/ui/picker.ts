import { astToPlainText } from '../html/ast';
import { t } from '../i18n';
import type { Template } from '../types';
import { UI_STYLES } from './theme';

export interface PickerOptions {
  templates: Template[];
  anchorRect: DOMRect;
  onSelect: (t: Template) => void;
  onClose: () => void;
}

/**
 * Pure function for filtering and ranking templates based on search query.
 * Exposed for unit testing.
 */
export function filterAndSortTemplates(templates: Template[], query: string): Template[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...templates].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Precompute searchable text and matches
  const matched = templates.filter((t) => {
    if (t.name.toLowerCase().includes(q)) return true;
    if (t.keyword.toLowerCase().includes(q)) return true;
    if (t.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
    const bodyPlain = astToPlainText(t.bodyAst).toLowerCase();
    return bodyPlain.includes(q);
  });

  return matched.sort((a, b) => {
    const aKw = a.keyword.toLowerCase();
    const bKw = b.keyword.toLowerCase();
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // Group 1: Exact keyword match
    const aKwExact = aKw === q;
    const bKwExact = bKw === q;
    if (aKwExact && !bKwExact) return -1;
    if (!aKwExact && bKwExact) return 1;

    // Group 2: Keyword prefix match
    const aKwPrefix = aKw.startsWith(q);
    const bKwPrefix = bKw.startsWith(q);
    if (aKwPrefix && !bKwPrefix) return -1;
    if (!aKwPrefix && bKwPrefix) return 1;

    // Group 3: Name prefix match
    const aNamePrefix = aName.startsWith(q);
    const bNamePrefix = bName.startsWith(q);
    if (aNamePrefix && !bNamePrefix) return -1;
    if (!aNamePrefix && bNamePrefix) return 1;

    // Group 4: Others, sorted by updatedAt desc
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Opens the Template Picker modal within a closed Shadow DOM.
 */
export function openPicker(opts: PickerOptions): { close(): void } {
  let isClosed = false;

  const host = document.createElement('div');
  host.id = 'fluxsnip-picker-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  // Stop propagation of all keyboard events on the host to prevent page shortcuts (e.g. Gmail)
  const stopEvent = (e: Event) => e.stopPropagation();
  host.addEventListener('keydown', stopEvent, true);
  host.addEventListener('keyup', stopEvent, true);
  host.addEventListener('keypress', stopEvent, true);

  const styleEl = document.createElement('style');
  styleEl.textContent = UI_STYLES;
  shadow.appendChild(styleEl);

  const backdrop = document.createElement('div');
  backdrop.className = 'picker-backdrop';

  const card = document.createElement('div');
  card.className = 'picker-card';

  // Search input wrapper
  const searchWrap = document.createElement('div');
  searchWrap.className = 'picker-search-wrapper';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'picker-search-icon';
  searchIcon.textContent = '🔍';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'picker-search-input';
  searchInput.placeholder = t('picker_search_placeholder') || 'Search templates...';

  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInput);

  // Results list
  const listEl = document.createElement('div');
  listEl.className = 'picker-list';

  // Footer
  const footer = document.createElement('div');
  footer.className = 'picker-footer';

  const hints = document.createElement('div');
  hints.className = 'picker-footer-hints';

  const createKbdHint = (kbd: string, label: string) => {
    const span = document.createElement('span');
    const kbdEl = document.createElement('kbd');
    kbdEl.className = 'picker-kbd';
    kbdEl.textContent = kbd;
    span.appendChild(kbdEl);
    span.appendChild(document.createTextNode(label));
    return span;
  };

  hints.appendChild(createKbdHint('↑↓', t('picker_hint_select') || 'Select'));
  hints.appendChild(createKbdHint('Enter', t('picker_hint_insert') || 'Insert'));
  hints.appendChild(createKbdHint('Esc', t('picker_hint_close') || 'Close'));
  footer.appendChild(hints);

  card.appendChild(searchWrap);
  card.appendChild(listEl);
  card.appendChild(footer);

  backdrop.appendChild(card);
  shadow.appendChild(backdrop);
  document.documentElement.appendChild(host);

  // Position calculation
  const rect = opts.anchorRect;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = 440;
  const estimatedHeight = 360;

  let left = rect.left;
  if (left + cardWidth > viewportWidth - 16) {
    left = viewportWidth - cardWidth - 16;
  }
  if (left < 16) {
    left = 16;
  }

  let top = rect.bottom + 6;
  if (top + estimatedHeight > viewportHeight - 16 && rect.top > estimatedHeight) {
    top = rect.top - estimatedHeight - 6;
  }
  if (top < 16) {
    top = 16;
  }

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;

  // State management
  let filteredTemplates = filterAndSortTemplates(opts.templates, '');
  let selectedIndex = 0;

  function renderList() {
    // Clear list without innerHTML
    while (listEl.firstChild) {
      listEl.removeChild(listEl.firstChild);
    }

    if (filteredTemplates.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty-state';

      const msg = document.createElement('span');
      msg.textContent = t('picker_no_templates') || 'No templates found.';
      empty.appendChild(msg);

      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'picker-options-link';
      optBtn.textContent = t('picker_open_options') || 'Open Options to create templates';
      optBtn.onclick = () => {
        try {
          browser.runtime.sendMessage({ type: 'openOptions' });
        } catch {
          // Ignore
        }
        close();
      };
      empty.appendChild(optBtn);

      listEl.appendChild(empty);
      return;
    }

    filteredTemplates.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `picker-item ${idx === selectedIndex ? 'selected' : ''}`;
      row.dataset.index = String(idx);

      const topRow = document.createElement('div');
      topRow.className = 'picker-item-top';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'picker-item-title-group';

      const nameEl = document.createElement('span');
      nameEl.className = 'picker-item-name';
      nameEl.textContent = item.name;
      titleGroup.appendChild(nameEl);

      if (item.keyword) {
        const kwEl = document.createElement('span');
        kwEl.className = 'picker-keyword-badge';
        kwEl.textContent = item.keyword;
        titleGroup.appendChild(kwEl);
      }

      topRow.appendChild(titleGroup);

      if (item.tags.length > 0) {
        const tagsWrap = document.createElement('div');
        tagsWrap.style.display = 'flex';
        tagsWrap.style.gap = '4px';
        item.tags.slice(0, 2).forEach((tag) => {
          const tagEl = document.createElement('span');
          tagEl.className = 'picker-tag-badge';
          tagEl.textContent = tag;
          tagsWrap.appendChild(tagEl);
        });
        topRow.appendChild(tagsWrap);
      }

      const selectHint = document.createElement('span');
      selectHint.className = 'picker-item-select-hint';
      selectHint.textContent = '↵ Enter';
      topRow.appendChild(selectHint);

      const previewEl = document.createElement('div');
      previewEl.className = 'picker-item-preview';
      const plain = astToPlainText(item.bodyAst);
      previewEl.textContent = plain.slice(0, 80) || '(empty)';

      row.appendChild(topRow);
      row.appendChild(previewEl);

      row.onmouseenter = () => {
        selectedIndex = idx;
        updateSelectionHighlight();
      };

      row.onclick = (e) => {
        e.stopPropagation();
        selectItem(item);
      };

      listEl.appendChild(row);
    });

    scrollSelectedIntoView();
  }

  function updateSelectionHighlight() {
    const rows = listEl.querySelectorAll('.picker-item');
    rows.forEach((row, idx) => {
      row.classList.toggle('selected', idx === selectedIndex);
    });
  }

  function scrollSelectedIntoView() {
    const selectedEl = listEl.querySelector(`.picker-item[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectItem(t: Template) {
    close();
    opts.onSelect(t);
  }

  function handleGlobalKey(e: KeyboardEvent) {
    if (isClosed) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (filteredTemplates.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredTemplates.length;
        updateSelectionHighlight();
        scrollSelectedIntoView();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (filteredTemplates.length > 0) {
        selectedIndex = (selectedIndex - 1 + filteredTemplates.length) % filteredTemplates.length;
        updateSelectionHighlight();
        scrollSelectedIntoView();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const current = filteredTemplates[selectedIndex];
      if (current) {
        selectItem(current);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      close();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Auto-focus search input if user starts typing printable character
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (shadow.activeElement !== searchInput) {
        searchInput.focus();
      }
    }
  }

  window.addEventListener('keydown', handleGlobalKey, true);

  function close() {
    if (isClosed) return;
    isClosed = true;
    window.removeEventListener('keydown', handleGlobalKey, true);
    host.remove();
    opts.onClose();
  }

  // Search input change filtering
  searchInput.addEventListener('input', () => {
    filteredTemplates = filterAndSortTemplates(opts.templates, searchInput.value);
    selectedIndex = 0;
    renderList();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
    }
  });

  renderList();
  setTimeout(() => {
    searchInput.focus();
  }, 10);

  return { close };
}
