import { beforeEach, describe, expect, it } from 'vitest';
import { listFromOptions, readFrom, selectFrom } from './from';

const fixtureHtml = `
<div id="gmail-compose-root" role="dialog">
  <input type="hidden" name="from" value="qc@sunace-corp.com" />
  <div class="az3">
    <div role="button" aria-haspopup="true" class="J-JN-M-I">
      <span class="az1">田所 功次 &lt;qc@sunace-corp.com&gt;</span>
    </div>
  </div>
</div>

<div id="menu-container" role="menu" aria-haspopup="true" class="J-M" style="display: none">
  <div class="SK AX">
    <div role="menuitem" class="J-N" value="tadokoro.k@sunace-corp.com">田所功次 &lt;tadokoro.k@sunace-corp.com&gt;</div>
    <div role="menuitem" class="J-N" value="qc@sunace-corp.com">田所 功次 &lt;qc@sunace-corp.com&gt;</div>
  </div>
</div>
`;

describe('gmail from alias', () => {
  let root: HTMLElement;
  let menu: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
    root = document.getElementById('gmail-compose-root') as HTMLElement;
    menu = document.getElementById('menu-container') as HTMLElement;

    // Simulate dropdown opening on button click
    const btn = root.querySelector('div[role="button"]') as HTMLElement;
    btn.addEventListener('click', () => {
      menu.style.display = 'block';
    });

    // Simulate selecting item
    menu.querySelectorAll('div[role="menuitem"]').forEach((item) => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('value') || '';
        const hidden = root.querySelector('input[name="from"]') as HTMLInputElement;
        hidden.value = val;
        const display = root.querySelector('span.az1') as HTMLElement;
        display.textContent = item.textContent;
        menu.style.display = 'none';
      });
    });
  });

  it('reads current From alias from hidden input and display', () => {
    const current = readFrom(root);
    expect(current).not.toBeNull();
    expect(current?.email).toBe('qc@sunace-corp.com');
  });

  it('selects another available From alias from dropdown', async () => {
    const success = await selectFrom(root, 'tadokoro.k@sunace-corp.com');
    expect(success).toBe(true);

    const updated = readFrom(root);
    expect(updated?.email).toBe('tadokoro.k@sunace-corp.com');
  });

  it('returns false when requested alias is not present in menu', async () => {
    const success = await selectFrom(root, 'nonexistent@example.com');
    expect(success).toBe(false);
  });

  it('lists available aliases via listFromOptions', async () => {
    const options = await listFromOptions(root);
    expect(options).toContain('tadokoro.k@sunace-corp.com');
    expect(options).toContain('qc@sunace-corp.com');
  });
});
