import type { Platform } from '@/core/types';

export interface BodyEditor {
  readonly element: HTMLElement;
  getHtml(): string;
  setHtml(html: string): void;
  onChange(cb: () => void): void;
  setPlatform(p: Platform): void;
}

export function createBodyEditor(platform: Platform): BodyEditor {
  const wrapper = document.createElement('div');
  wrapper.className = 'body-editor-wrapper';

  const textarea = document.createElement('textarea');
  textarea.id = 'template-body-input';
  textarea.className = 'body-editor-textarea';
  textarea.placeholder = '<p>Write your template HTML or text here...</p>';
  textarea.rows = 10;

  wrapper.appendChild(textarea);

  let changeListeners: Array<() => void> = [];

  textarea.addEventListener('input', () => {
    for (const cb of changeListeners) {
      cb();
    }
  });

  return {
    element: wrapper,
    getHtml() {
      return textarea.value;
    },
    setHtml(html: string) {
      textarea.value = html;
    },
    onChange(cb: () => void) {
      changeListeners.push(cb);
    },
    setPlatform(_p: Platform) {
      // Placeholder for T03 platform specific warnings
    },
  };
}
