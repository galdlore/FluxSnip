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
