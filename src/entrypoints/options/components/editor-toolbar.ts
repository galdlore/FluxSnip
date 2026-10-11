import { t } from '@/core/i18n';
import type { Platform } from '@/core/types';
import { openTableGridPicker } from './table-picker';

export interface EditorToolbar {
  readonly element: HTMLElement;
  updateState(): void;
  setPlatform(p: Platform): void;
}

export function createEditorToolbar(
  visualEditor: HTMLElement,
  onContentChange: () => void,
  initialPlatform: Platform
): EditorToolbar {
  const bar = document.createElement('div');
  bar.className = 'editor-toolbar';

  let currentPlatform: Platform = initialPlatform;

  function exec(command: string, value: string | undefined = undefined) {
    visualEditor.focus();
    document.execCommand(command, false, value);
    updateState();
    onContentChange();
  }

  function createBtn(id: string, label: string, icon: string, titleKey: string, action: () => void) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'toolbar-btn';
    btn.innerHTML = `<span class="toolbar-icon">${icon}</span>`;
    btn.title = t(titleKey);
    btn.onclick = (e) => {
      e.preventDefault();
      action();
    };
    return btn;
  }

  // Format buttons
  const boldBtn = createBtn('btn-format-bold', 'Bold', '<b>B</b>', 'editor_btn_bold', () => exec('bold'));
  const italicBtn = createBtn('btn-format-italic', 'Italic', '<i>I</i>', 'editor_btn_italic', () => exec('italic'));
  const underlineBtn = createBtn('btn-format-underline', 'Underline', '<u>U</u>', 'editor_btn_underline', () => exec('underline'));
  const strikeBtn = createBtn('btn-format-strike', 'Strike', '<s>S</s>', 'editor_btn_strike', () => exec('strikeThrough'));

  // Color popover
  function openColorPopover() {
    const existing = document.querySelector('.color-picker-popover');
    if (existing) {
      existing.remove();
      return;
    }

    // Save selection
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;

    const popover = document.createElement('div');
    popover.className = 'color-picker-popover';

    const grid = document.createElement('div');
    grid.className = 'color-picker-grid';

    const swatches = [
      { color: '#111827', title: 'Default' },
      { color: '#4b5563', title: 'Gray' },
      { color: '#dc2626', title: 'Red' },
      { color: '#ea580c', title: 'Orange' },
      { color: '#ca8a04', title: 'Yellow' },
      { color: '#16a34a', title: 'Green' },
      { color: '#2563eb', title: 'Blue' },
      { color: '#9333ea', title: 'Purple' },
    ];

    const applyColor = (colorHex: string) => {
      visualEditor.focus();
      if (savedRange) {
        const currentSel = window.getSelection();
        if (currentSel) {
          currentSel.removeAllRanges();
          currentSel.addRange(savedRange);
        }
      }
      exec('foreColor', colorHex);
      popover.remove();
    };

    swatches.forEach((s) => {
      const swatchBtn = document.createElement('button');
      swatchBtn.type = 'button';
      swatchBtn.className = 'color-picker-swatch';
      swatchBtn.style.backgroundColor = s.color;
      swatchBtn.title = s.title;
      swatchBtn.onclick = (e) => {
        e.preventDefault();
        applyColor(s.color);
      };
      grid.appendChild(swatchBtn);
    });

    const customRow = document.createElement('div');
    customRow.className = 'color-picker-custom-row';

    const customLabel = document.createElement('span');
    customLabel.textContent = t('editor_color_custom');

    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.className = 'color-picker-custom-input';
    customInput.value = '#dc2626';
    customInput.onchange = () => {
      applyColor(customInput.value);
    };

    customRow.appendChild(customLabel);
    customRow.appendChild(customInput);

    popover.appendChild(grid);
    popover.appendChild(customRow);
    document.body.appendChild(popover);

    const rect = colorBtn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popover.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;

    const onOutsideClick = (e: MouseEvent) => {
      if (!popover.contains(e.target as Node) && !colorBtn.contains(e.target as Node)) {
        popover.remove();
        document.removeEventListener('mousedown', onOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick);
    }, 0);
  }

  const colorBtn = createBtn(
    'btn-format-color',
    'Color',
    '<span style="border-bottom: 3px solid currentColor; font-weight: bold; line-height: 1;">A</span>',
    'editor_btn_color',
    openColorPopover
  );

  const sep1 = document.createElement('span');
  sep1.className = 'toolbar-sep';

  // Link popover
  function openLinkPopover() {
    const existing = document.querySelector('.link-popover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.className = 'link-popover';

    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'https://example.com';
    input.className = 'link-url-input';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-primary btn-sm';
    okBtn.textContent = t('editor_link_apply');

    const unlinkBtn = document.createElement('button');
    unlinkBtn.type = 'button';
    unlinkBtn.className = 'btn btn-secondary btn-sm';
    unlinkBtn.textContent = t('editor_link_remove');

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-outline btn-sm';
    cancelBtn.textContent = t('options_cancel');

    popover.appendChild(input);
    popover.appendChild(okBtn);
    popover.appendChild(unlinkBtn);
    popover.appendChild(cancelBtn);
    document.body.appendChild(popover);

    const rect = linkBtn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popover.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;

    input.focus();

    okBtn.onclick = () => {
      const val = input.value.trim();
      const lower = val.toLowerCase();
      if (['http://', 'https://', 'mailto:', 'tel:'].some((p) => lower.startsWith(p))) {
        exec('createLink', val);
        popover.remove();
      } else {
        input.classList.add('error');
      }
    };

    unlinkBtn.onclick = () => {
      exec('unlink');
      popover.remove();
    };

    cancelBtn.onclick = () => {
      popover.remove();
    };
  }

  const linkBtn = createBtn('btn-format-link', 'Link', '🔗', 'editor_btn_link', openLinkPopover);
  const hrBtn = createBtn('btn-format-hr', 'Horizontal Line', '―', 'editor_btn_hr', () => exec('insertHorizontalRule'));

  const sep2 = document.createElement('span');
  sep2.className = 'toolbar-sep';

  const ulBtn = createBtn('btn-format-ul', 'Bullet List', '•☰', 'editor_btn_ul', () => exec('insertUnorderedList'));
  const olBtn = createBtn('btn-format-ol', 'Numbered List', '1.☰', 'editor_btn_ol', () => exec('insertOrderedList'));
  const quoteBtn = createBtn('btn-format-quote', 'Quote', '❝', 'editor_btn_quote', () => exec('formatBlock', 'blockquote'));
  const clearBtn = createBtn('btn-format-clear', 'Clear', '✕', 'editor_btn_clear', () => exec('removeFormat'));

  const sep3 = document.createElement('span');
  sep3.className = 'toolbar-sep';

  // Table button
  const tableBtn = createBtn('btn-format-table', 'Table', '⊞', 'editor_btn_table', () => {
    openTableGridPicker(tableBtn, (rows, cols) => {
      let tableHtml = '<table style="border-collapse:collapse;width:100%"><tbody>';
      for (let r = 0; r < rows; r++) {
        tableHtml += '<tr>';
        for (let c = 0; c < cols; c++) {
          tableHtml += '<td style="border:1px solid #999;padding:4px 8px"><br></td>';
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table><p><br></p>';
      exec('insertHTML', tableHtml);
    });
  });

  // Variable Insertion Select
  const varSelect = document.createElement('select');
  varSelect.id = 'editor-var-insert-select';
  varSelect.className = 'toolbar-var-select';

  function populateVariables() {
    varSelect.innerHTML = `<option value="">+ ${t('editor_insert_variable')}</option>`;
    const vars = [
      { key: '{{date}}', label: t('options_var_date') },
      { key: '{{date:YYYY/MM/DD}}', label: t('options_var_date_custom') },
      { key: '{{time}}', label: t('options_var_time') },
      { key: '{{weekday}}', label: t('options_var_weekday') },
    ];

    if (currentPlatform === 'gmail') {
      vars.push(
        { key: '{{to.name}}', label: t('options_var_to_name') },
        { key: '{{to.firstName}}', label: t('options_var_to_first_name') },
        { key: '{{to.lastName}}', label: t('options_var_to_last_name') },
        { key: '{{to.email}}', label: t('options_var_to_email') },
        { key: '{{from.name}}', label: t('options_var_from_name') },
        { key: '{{from.email}}', label: t('options_var_from_email') }
      );
    }

    for (const v of vars) {
      const opt = document.createElement('option');
      opt.value = v.key;
      opt.textContent = `${v.key} (${v.label})`;
      varSelect.appendChild(opt);
    }
  }

  varSelect.onchange = () => {
    const val = varSelect.value;
    if (val) {
      exec('insertText', val);
      varSelect.value = '';
    }
  };

  bar.appendChild(boldBtn);
  bar.appendChild(italicBtn);
  bar.appendChild(underlineBtn);
  bar.appendChild(strikeBtn);
  bar.appendChild(colorBtn);
  bar.appendChild(sep1);
  bar.appendChild(linkBtn);
  bar.appendChild(hrBtn);
  bar.appendChild(sep2);
  bar.appendChild(ulBtn);
  bar.appendChild(olBtn);
  bar.appendChild(quoteBtn);
  bar.appendChild(clearBtn);
  bar.appendChild(sep3);
  bar.appendChild(tableBtn);
  bar.appendChild(varSelect);

  function updateState() {
    try {
      boldBtn.classList.toggle('active', document.queryCommandState('bold'));
      italicBtn.classList.toggle('active', document.queryCommandState('italic'));
      underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
      strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
      ulBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
      olBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));
    } catch {
      // In case queryCommandState is unavailable
    }
  }

  function setPlatform(p: Platform) {
    currentPlatform = p;
    tableBtn.style.display = p === 'chat' ? 'none' : 'inline-flex';
    populateVariables();
  }

  // Keyboard shortcuts inside visual editor
  visualEditor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        exec('bold');
      } else if (k === 'i') {
        e.preventDefault();
        exec('italic');
      } else if (k === 'u') {
        e.preventDefault();
        exec('underline');
      } else if (k === 'k') {
        e.preventDefault();
        openLinkPopover();
      }
    }
  });

  visualEditor.addEventListener('keyup', updateState);
  visualEditor.addEventListener('mouseup', updateState);

  populateVariables();
  setPlatform(initialPlatform);

  return {
    element: bar,
    updateState,
    setPlatform,
  };
}
