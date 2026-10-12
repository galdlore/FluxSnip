import { t } from '@/core/i18n';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, kind: ToastKind = 'info', durationMs: number = 3500): void {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;

  c.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => {
    el.classList.add('toast-visible');
  });

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.classList.add('toast-hiding');
    setTimeout(() => {
      el.remove();
    }, 250);
  }, durationMs);
}

/**
 * Reports a failed storage write. Quota errors get their own message since the fix is to free space.
 */
export function showSaveError(err: unknown): void {
  console.error('[FluxSnip] Save failed:', err);
  const detail = err instanceof Error ? err.message : String(err);
  const message = /quota/i.test(detail) ? t('options_save_failed_quota') : t('options_save_failed', detail);
  showToast(message, 'error', 8000);
}
