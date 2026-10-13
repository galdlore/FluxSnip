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
      td.style.padding = '6px 8px';
      td.innerHTML = '<br>';
      row.insertBefore(td, row.cells[colIndex] ?? null);
    }
    distributeColumns(table);
  });

  addItem('editor_table_insert_col_right', () => {
    const colIndex = targetCell.cellIndex;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!row) continue;
      const td = document.createElement(row.cells[0]?.tagName.toLowerCase() === 'th' ? 'th' : 'td');
      td.style.border = '1px solid #999';
      td.style.padding = '6px 8px';
      td.innerHTML = '<br>';
      const target = row.cells[colIndex + 1];
      if (target) {
        row.insertBefore(td, target);
      } else {
        row.appendChild(td);
      }
    }
    distributeColumns(table);
  });

  const sepWidth = document.createElement('div');
  sepWidth.className = 'context-menu-separator';
  menu.appendChild(sepWidth);

  addItem('editor_table_distribute_cols', () => {
    distributeColumns(table);
  });

  addItem('editor_table_widen_col', () => {
    adjustColumnWidth(table, targetCell.cellIndex, 5);
  });

  addItem('editor_table_narrow_col', () => {
    adjustColumnWidth(table, targetCell.cellIndex, -5);
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
    if (table.rows[0]?.cells.length === 0) {
      table.remove();
    } else {
      distributeColumns(table);
    }
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

function distributeColumns(table: HTMLTableElement) {
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
  const firstRow = table.rows[0];
  if (!firstRow) return;
  const numCols = firstRow.cells.length;
  if (numCols === 0) return;
  const colWidth = `${(100 / numCols).toFixed(2)}%`;
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    if (!row) continue;
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (cell) {
        cell.style.width = colWidth;
      }
    }
  }
}

function adjustColumnWidth(table: HTMLTableElement, colIndex: number, deltaPercent: number) {
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
  const firstRow = table.rows[0];
  if (!firstRow) return;
  const numCols = firstRow.cells.length;
  if (numCols <= 1) return;

  const widths: number[] = [];
  let totalPercent = 0;
  for (let c = 0; c < numCols; c++) {
    const styleW = firstRow.cells[c]?.style.width;
    let w = parseFloat(styleW || '');
    if (isNaN(w) || w <= 0) {
      w = 100 / numCols;
    }
    widths.push(w);
    totalPercent += w;
  }
  for (let c = 0; c < numCols; c++) {
    widths[c] = (widths[c]! / totalPercent) * 100;
  }

  const oldTargetW = widths[colIndex] ?? (100 / numCols);
  const newTargetW = Math.max(5, Math.min(85, oldTargetW + deltaPercent));
  const diff = newTargetW - oldTargetW;
  widths[colIndex] = newTargetW;

  const otherTotal = 100 - oldTargetW;
  if (otherTotal > 0) {
    for (let c = 0; c < numCols; c++) {
      if (c !== colIndex) {
        const ratio = widths[c]! / otherTotal;
        widths[c] = Math.max(5, widths[c]! - diff * ratio);
      }
    }
  }

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    if (!row) continue;
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (cell && widths[c] !== undefined) {
        cell.style.width = `${widths[c]!.toFixed(2)}%`;
      }
    }
  }
}

/**
 * Enables interactive column edge dragging to resize table columns in the visual editor.
 */
export function setupTableColumnResizing(
  editorEl: HTMLElement,
  onTableModified: () => void
): () => void {
  let resizingCell: HTMLTableCellElement | null = null;
  let startX = 0;
  let startWidth = 0;
  let tableEl: HTMLTableElement | null = null;

  function onMouseMove(e: MouseEvent) {
    if (!resizingCell || !tableEl) {
      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      if (cell && editorEl.contains(cell)) {
        const rect = cell.getBoundingClientRect();
        if (e.clientX >= rect.right - 6 && e.clientX <= rect.right + 2) {
          editorEl.style.cursor = 'col-resize';
          return;
        }
      }
      editorEl.style.cursor = '';
      return;
    }

    const dx = e.clientX - startX;
    const tableWidth = tableEl.getBoundingClientRect().width;
    if (tableWidth <= 0) return;

    const minPx = 25;
    const newPx = Math.max(minPx, startWidth + dx);
    const newPct = (newPx / tableWidth) * 100;

    const colIndex = resizingCell.cellIndex;
    tableEl.style.tableLayout = 'fixed';
    tableEl.style.width = '100%';

    for (let r = 0; r < tableEl.rows.length; r++) {
      const row = tableEl.rows[r];
      if (row && row.cells[colIndex]) {
        row.cells[colIndex]!.style.width = `${newPct.toFixed(2)}%`;
      }
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th') as HTMLTableCellElement | null;
    if (!cell || !editorEl.contains(cell)) return;

    const rect = cell.getBoundingClientRect();
    if (e.clientX >= rect.right - 6 && e.clientX <= rect.right + 2) {
      resizingCell = cell;
      tableEl = cell.closest('table');
      startX = e.clientX;
      startWidth = rect.width;
      e.preventDefault();
      e.stopPropagation();

      const onMouseUp = () => {
        if (resizingCell) {
          resizingCell = null;
          tableEl = null;
          editorEl.style.cursor = '';
          onTableModified();
        }
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
    }
  }

  editorEl.addEventListener('mousemove', onMouseMove);
  editorEl.addEventListener('mousedown', onMouseDown);

  return () => {
    editorEl.removeEventListener('mousemove', onMouseMove);
    editorEl.removeEventListener('mousedown', onMouseDown);
  };
}

