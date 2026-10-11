/**
 * Minimal stand-in for Gmail's PeopleKit recipient widget, for tests only:
 * the chip delete button removes its chip, and a comma keydown in a recipient
 * input turns the typed address into a chip.
 */
export function simulatePeopleKit(scope: HTMLElement): void {
  scope.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as Element | null)?.closest?.('.afX');
      btn?.closest('.afZ, .afV')?.remove();
    },
    true
  );

  scope.addEventListener(
    'keydown',
    (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || (e as KeyboardEvent).key !== ',') return;

      const email = input.value.replace(/,/g, '').trim();
      if (!email) return;

      const chip = document.createElement('div');
      chip.className = 'afZ';
      chip.setAttribute('data-hovercard-id', email);
      const label = document.createElement('div');
      label.className = 'akl';
      label.textContent = email;
      chip.appendChild(label);

      input.parentElement?.insertBefore(chip, input);
      input.value = '';
    },
    true
  );
}
