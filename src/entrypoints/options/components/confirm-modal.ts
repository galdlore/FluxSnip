import { t } from '@/core/i18n';

/**
 * Shows a modal confirmation dialog. Resolves true only when the user presses the confirm button.
 */
export function confirmModal(title: string, message: string, confirmLabel = t('options_confirm')): Promise<boolean> {
  return new Promise((resolve) => {
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

    const finish = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('options_cancel');
    cancelBtn.onclick = () => finish(false);

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-danger';
    okBtn.textContent = confirmLabel;
    okBtn.onclick = () => finish(true);

    row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    dialog.appendChild(h3);
    dialog.appendChild(p);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    cancelBtn.focus();
  });
}
