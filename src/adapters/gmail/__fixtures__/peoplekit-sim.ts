/**
 * Minimal stand-in for Gmail's PeopleKit recipient widget, for tests only.
 * Mirrors real Gmail as observed by e2e: a pasted address or Enter turns the input into a chip,
 * while a typed comma or a blur does not. The chip delete button removes its chip.
 * Addresses in `reject` never become chips.
 */
export function simulatePeopleKit(scope: HTMLElement, opts: { reject?: string[] } = {}): void {
  const reject = new Set((opts.reject ?? []).map((e) => e.toLowerCase()));

  const commit = (input: HTMLInputElement, raw: string) => {
    const email = raw.replace(/,/g, '').trim();
    if (!email || reject.has(email.toLowerCase())) return;

    const chip = document.createElement('div');
    chip.className = 'afZ';
    chip.setAttribute('data-hovercard-id', email);
    const label = document.createElement('div');
    label.className = 'akl';
    label.textContent = email;
    chip.appendChild(label);
    const del = document.createElement('div');
    del.className = 'afX';
    del.setAttribute('aria-label', '削除');
    chip.appendChild(del);

    input.parentElement?.insertBefore(chip, input);
    input.value = '';
  };

  scope.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as Element | null)?.closest?.('.afX');
      btn?.closest('.afZ, .afV')?.remove();
    },
    true
  );

  scope.addEventListener(
    'paste',
    (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      e.preventDefault();
      commit(input, (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? '');
    },
    true
  );

  scope.addEventListener(
    'keydown',
    (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || (e as KeyboardEvent).key !== 'Enter') return;
      commit(input, input.value);
    },
    true
  );
}
