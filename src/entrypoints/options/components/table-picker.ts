import { t } from '@/core/i18n';

export function openTableGridPicker(
  anchorBtn: HTMLElement,
  onSelect: (rows: number, cols: number) => void
): { close(): void } {
  const overlay = document.createElement('div');
  overlay.className = 'popover-overlay';

  const popover = document.createElement('div');
  popover.className = 'table-picker-popover';

  const title = document.createElement('div');
  title.className = 'table-picker-title';
  title.textContent = t('editor_table_grid_title');

  const gridContainer = document.createElement('div');
  gridContainer.className = 'table-picker-grid';

  const status = document.createElement('div');
  status.className = 'table-picker-status';
  status.textContent = '1 × 1';

  const MAX_ROWS = 8;
  const MAX_COLS = 8;
  const cells: HTMLElement[][] = [];

  for (let r = 0; r < MAX_ROWS; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'table-picker-row';
    cells[r] = [];

    for (let c = 0; c < MAX_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'table-picker-cell';
      cell.dataset.row = String(r + 1);
      cell.dataset.col = String(c + 1);

      cell.onmouseenter = () => {
        highlight(r + 1, c + 1);
      };

      cell.onmousedown = (e) => {
        e.preventDefault();
      };

      cell.onclick = (e) => {
        e.stopPropagation();
        close();
        onSelect(r + 1, c + 1);
      };

      rowEl.appendChild(cell);
      cells[r]![c] = cell;
    }
    gridContainer.appendChild(rowEl);
  }

  popover.onmousedown = (e) => {
    e.preventDefault();
  };

  function highlight(rowCount: number, colCount: number) {
    status.textContent = `${rowCount} × ${colCount}`;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < MAX_COLS; c++) {
        if (r < rowCount && c < colCount) {
          cells[r]![c]!.classList.add('selected');
        } else {
          cells[r]![c]!.classList.remove('selected');
        }
      }
    }
  }

  popover.appendChild(title);
  popover.appendChild(gridContainer);
  popover.appendChild(status);
  overlay.appendChild(popover);
  document.body.appendChild(overlay);

  // Position relative to button
  const rect = anchorBtn.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
  popover.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;

  function close() {
    overlay.remove();
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      close();
    }
  };

  highlight(1, 1);
  return { close };
}

export function showTableContextMenu(
  e: MouseEvent,
  targetCell: HTMLTableCellElement,
  onTableModified: () => void
): void {
  const existing = document.querySelector('.table-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'table-context-menu';

  const table = targetCell.closest('table');
  const tr = targetCell.closest('tr');
  if (!table || !tr) return;

  function addItem(labelKey: string, action: () => void) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = t(labelKey);
    item.onclick = (ev) => {
      ev.stopPropagation();
      menu.remove();
      action();
      onTableModified();
    };
    menu.appendChild(item);
  }

  addItem('editor_table_insert_row_above', () => {
    const newTr = document.createElement('tr');
    for (let i = 0; i < tr.cells.length; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #999';
      td.style.padding = '4px 8px';
      td.innerHTML = '<br>';
      newTr.appendChild(td);
    }
    table.insertBefore(newTr, tr);
  });

  addItem('editor_table_insert_row_below', () => {
    const newTr = document.createElement('tr');
    for (let i = 0; i < tr.cells.length; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #999';
      td.style.padding = '4px 8px';
      td.innerHTML = '<br>';
      newTr.appendChild(td);
    }
    if (tr.nextSibling) {
      table.insertBefore(newTr, tr.nextSibling);
    } else {
      table.appendChild(newTr);
    }
  });

  addItem('editor_table_insert_col_left', () => {
    const colIndex = targetCell.cellIndex;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const td = document.createElement(row.cells[0]?.tagName.toLowerCase() === 'th' ? 'th' : 'td');
      td.style.border = '1px solid #999';
      td.style.padding = '4px 8px';
      td.innerHTML = '<br>';
      row.insertBefore(td, row.cells[colIndex] ?? null);
    }
  });

  addItem('editor_table_insert_col_right', () => {
    const colIndex = targetCell.cellIndex;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const td = document.createElement(row.cells[0]?.tagName.toLowerCase() === 'th' ? 'th' : 'td');
      td.style.border = '1px solid #999';
      td.style.padding = '4px 8px';
      td.innerHTML = '<br>';
      const target = row.cells[colIndex + 1];
      if (target) {
        row.insertBefore(td, target);
      } else {
        row.appendChild(td);
      }
    }
  });

  const sep = document.createElement('div');
  sep.className = 'context-menu-separator';
  menu.appendChild(sep);

  addItem('editor_table_delete_row', () => {
    tr.remove();
    if (table.rows.length === 0) table.remove();
  });

  addItem('editor_table_delete_col', () => {
    const colIndex = targetCell.cellIndex;
    for (let i = table.rows.length - 1; i >= 0; i--) {
      const row = table.rows[i];
      if (row?.cells[colIndex]) {
        row.cells[colIndex]?.remove();
      }
    }
    if (table.rows[0]?.cells.length === 0) table.remove();
  });

  addItem('editor_table_delete_table', () => {
    table.remove();
  });

  menu.style.top = `${e.pageY + 2}px`;
  menu.style.left = `${e.pageX + 2}px`;

  document.body.appendChild(menu);

  const closeMenu = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) {
      menu.remove();
      window.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => window.addEventListener('click', closeMenu), 50);
}
