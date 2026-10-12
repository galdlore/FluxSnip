import { beforeEach, describe, expect, it } from 'vitest';
import { listFromOptions, readFrom, selectFrom } from './from';

const fixtureHtml = `
<div id="gmail-compose-root" role="dialog">
  <input type="hidden" name="from" value="primary@example.com" />
  <div class="az3">
    <div role="button" aria-haspopup="true" class="J-JN-M-I">
      <span class="az1">山田 太郎 &lt;primary@example.com&gt;</span>
    </div>
  </div>
</div>

<div id="menu-container" role="menu" aria-haspopup="true" class="J-M" style="display: none">
  <div class="SK AX">
    <div role="menuitem" class="J-N" value="alias@example.com">山田太郎 &lt;alias@example.com&gt;</div>
    <div role="menuitem" class="J-N" value="primary@example.com">山田 太郎 &lt;primary@example.com&gt;</div>
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
    expect(current?.email).toBe('primary@example.com');
  });

  it('selects another available From alias from dropdown', async () => {
    const success = await selectFrom(root, 'alias@example.com');
    expect(success).toBe(true);

    const updated = readFrom(root);
    expect(updated?.email).toBe('alias@example.com');
  });

  it('returns false when requested alias is not present in menu', async () => {
    const success = await selectFrom(root, 'nonexistent@example.com');
    expect(success).toBe(false);
  });

  it('ignores hidden unrelated menus that appear earlier in the DOM', async () => {
    const decoy = document.createElement('div');
    decoy.className = 'J-M';
    decoy.setAttribute('role', 'menu');
    decoy.setAttribute('aria-haspopup', 'true');
    decoy.style.display = 'none';
    const decoyItem = document.createElement('div');
    decoyItem.setAttribute('role', 'menuitem');
    decoyItem.textContent = 'ラベルを管理';
    decoy.appendChild(decoyItem);
    document.body.insertBefore(decoy, document.body.firstChild);

    const success = await selectFrom(root, 'alias@example.com');
    expect(success).toBe(true);
  });

  it('lists available aliases via listFromOptions', async () => {
    const options = await listFromOptions(root);
    expect(options).toContain('alias@example.com');
    expect(options).toContain('primary@example.com');
  });
});
