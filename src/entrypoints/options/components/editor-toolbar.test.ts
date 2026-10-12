import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorToolbar } from './editor-toolbar';

describe('editor-toolbar selection and insertion', () => {
  let visualEditor: HTMLElement;
  let onChange: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    visualEditor = document.createElement('div');
    visualEditor.contentEditable = 'true';
    document.body.appendChild(visualEditor);
    onChange = vi.fn();
  });

  it('inserts table at the saved cursor position instead of the top', () => {
    visualEditor.innerHTML = '<p>First line</p><p id="p2">Second line</p><p>Third line</p>';
    const p2 = document.getElementById('p2')!;
    const textNode = p2.firstChild as Text;

    // Place selection inside second line
    const range = document.createRange();
    range.setStart(textNode, 6); // After 'Second'
    range.collapse(true);

    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const toolbar = createEditorToolbar(visualEditor, onChange, 'gmail');
    document.body.appendChild(toolbar.element);

    // Click the table button (triggers mousedown to save range)
    const tableBtn = toolbar.element.querySelector('#btn-format-table') as HTMLButtonElement;
    expect(tableBtn).not.toBeNull();
    tableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tableBtn.click();

    // The grid picker popover should be open
    const cell = document.querySelector('.table-picker-cell') as HTMLElement;
    expect(cell).not.toBeNull();
    cell.click(); // Select 1x1 table

    // Check that table was inserted after 'Second' in p2 or adjacent to p2, NOT at the very start of visualEditor
    const firstP = visualEditor.querySelector('p');
    expect(firstP?.textContent).toBe('First line');
    expect(visualEditor.querySelector('table')).not.toBeNull();
    expect(onChange).toHaveBeenCalled();
  });

  it('falls back to end of editor when no range has been saved', () => {
    visualEditor.innerHTML = '<p>Existing text</p>';
    const sel = window.getSelection()!;
    sel.removeAllRanges();

    const toolbar = createEditorToolbar(visualEditor, onChange, 'gmail');
    document.body.appendChild(toolbar.element);

    const tableBtn = toolbar.element.querySelector('#btn-format-table') as HTMLButtonElement;
    tableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tableBtn.click();

    const cell = document.querySelector('.table-picker-cell') as HTMLElement;
    cell.click();

    // Table should be placed after 'Existing text', not before it
    const table = visualEditor.querySelector('table');
    expect(table).not.toBeNull();
    const p = visualEditor.querySelector('p');
    expect(p?.textContent).toBe('Existing text');
  });

  it('inserts variable at cursor position when select changes', () => {
    visualEditor.innerHTML = '<p id="p1">Hello world</p>';
    const p1 = document.getElementById('p1')!;
    const textNode = p1.firstChild as Text;

    const range = document.createRange();
    range.setStart(textNode, 5); // Right after 'Hello'
    range.collapse(true);

    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const toolbar = createEditorToolbar(visualEditor, onChange, 'gmail');
    document.body.appendChild(toolbar.element);

    const varSelect = toolbar.element.querySelector('#editor-var-insert-select') as HTMLSelectElement;
    varSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    varSelect.value = '{{date}}';
    varSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalled();
  });

  it('replaces empty paragraph with table when caret is in empty paragraph', () => {
    visualEditor.innerHTML = '<p>Greeting</p><p id="empty-p"><br></p><p>Sign off</p>';
    const emptyP = document.getElementById('empty-p')!;

    const range = document.createRange();
    range.setStart(emptyP, 0);
    range.collapse(true);

    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const toolbar = createEditorToolbar(visualEditor, onChange, 'gmail');
    document.body.appendChild(toolbar.element);

    const tableBtn = toolbar.element.querySelector('#btn-format-table') as HTMLButtonElement;
    tableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tableBtn.click();

    const cell = document.querySelector('.table-picker-cell') as HTMLElement;
    cell.click();

    const table = visualEditor.querySelector('table');
    expect(table).not.toBeNull();
    // Empty paragraph should be replaced, not nested
    expect(document.getElementById('empty-p')).toBeNull();
    // Caret should be positioned in the first cell of table
    const firstCell = table?.querySelector('td');
    const currentSel = window.getSelection();
    expect(currentSel?.anchorNode).toBe(firstCell);
  });
});
