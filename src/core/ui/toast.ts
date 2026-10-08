import { UI_STYLES } from './theme';

let toastHost: HTMLDivElement | null = null;
let toastContainer: HTMLDivElement | null = null;

function ensureToastContainer(): HTMLDivElement {
  if (toastContainer && toastHost && toastHost.isConnected) {
    return toastContainer;
  }

  toastHost = document.createElement('div');
  toastHost.id = 'fluxsnip-toast-host';
  const shadow = toastHost.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = UI_STYLES;
  shadow.appendChild(styleEl);

  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  shadow.appendChild(toastContainer);

  document.documentElement.appendChild(toastHost);
  return toastContainer;
}

/**
 * Displays a toast notification in the bottom right corner via Shadow DOM.
 */
export function showToast(
  message: string,
  kind: 'info' | 'success' | 'warn' | 'error' = 'info',
  ms: number = 4000
): void {
  const container = ensureToastContainer();

  const item = document.createElement('div');
  item.className = `toast-item toast-${kind}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  const icons: Record<string, string> = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    error: '✕',
  };
  iconEl.textContent = icons[kind] ?? 'ℹ';

  const contentEl = document.createElement('span');
  contentEl.className = 'toast-content';
  contentEl.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '✕';

  const dismiss = () => {
    item.classList.add('toast-out');
    setTimeout(() => {
      item.remove();
      if (toastContainer && toastContainer.childElementCount === 0 && toastHost) {
        toastHost.remove();
        toastHost = null;
        toastContainer = null;
      }
    }, 150);
  };

  closeBtn.onclick = (e) => {
    e.stopPropagation();
    dismiss();
  };

  item.appendChild(iconEl);
  item.appendChild(contentEl);
  item.appendChild(closeBtn);
  container.appendChild(item);

  if (ms > 0) {
    setTimeout(dismiss, ms);
  }
}
