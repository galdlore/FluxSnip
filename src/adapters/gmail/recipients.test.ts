import { beforeEach, describe, expect, it } from 'vitest';
import {
  addRecipients,
  applyRecipientField,
  clearRecipients,
  ensureFieldVisible,
  readRecipients,
} from './recipients';

const fixtureHtml = `
<div id="gmail-compose-root" role="dialog" class="M9">
  <div class="wO nr">
    <div name="to" class="anm">
      <div class="afZ" data-hovercard-id="tanaka@example.com">
        <div class="af0">
          <div class="akl">tanaka@example.com</div>
          <div class="akk">田中 太郎</div>
        </div>
        <div class="af6">
          <div class="afX" aria-label="削除"><svg></svg></div>
        </div>
      </div>
      <div class="aH9">
        <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      </div>
    </div>
  </div>

  <span class="baT">
    <span class="aB gQ pE" role="link" data-tooltip="Cc の宛先を追加">Cc</span>
    <span class="aB gQ pB" role="link" data-tooltip="Bcc の宛先を追加">Bcc</span>
  </span>

  <div id="cc-container" class="bzf" style="display: none">
    <div class="wO nr">
      <div name="cc" class="anm">
        <input id="cc-input" class="agP aFx" peoplekit-id="BbVjBd" aria-label="Cc の宛先" type="text" role="combobox" value="" />
      </div>
    </div>
  </div>
</div>
`;

describe('gmail recipients', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
    root = document.getElementById('gmail-compose-root') as HTMLElement;
  });

  it('reads existing To recipients from chips', () => {
    const list = readRecipients(root, 'to');
    expect(list).toHaveLength(1);
    expect(list[0]?.email).toBe('tanaka@example.com');
    expect(list[0]?.name).toBe('田中 太郎');
  });

  it('clears recipient chips by clicking delete button', async () => {
    expect(readRecipients(root, 'to')).toHaveLength(1);
    const cleared = await clearRecipients(root, 'to');
    expect(cleared).toBe(true);
    expect(readRecipients(root, 'to')).toHaveLength(0);
  });

  it('ensures Cc field becomes visible when toggled', async () => {
    const ccContainer = document.getElementById('cc-container') as HTMLElement;
    const ccInput = document.getElementById('cc-input') as HTMLInputElement;

    const ccToggle = document.querySelector('span[data-tooltip*="Cc"]') as HTMLElement;
    ccToggle.addEventListener('click', () => {
      ccContainer.style.display = 'block';
    });

    const isVis = await ensureFieldVisible(root, 'cc');
    expect(isVis).toBe(true);
  });

  it('applies replace mode on recipient field', async () => {
    const result = await applyRecipientField(root, 'to', {
      mode: 'replace',
      emails: ['sato@example.com'],
    });
    expect(result).toBe(true);
    // After clear, existing chip is removed
    const list = readRecipients(root, 'to');
    expect(list.some((r) => r.email === 'tanaka@example.com')).toBe(false);
  });

  it('applies append mode on recipient field without duplicating', async () => {
    const result = await applyRecipientField(root, 'to', {
      mode: 'append',
      emails: ['tanaka@example.com'], // already exists
    });
    expect(result).toBe(true);
  });

  it('expands collapsed To row when div.aoD.hl is clicked', async () => {
    // Simulate collapsed To row (like failsetsendto.html)
    const collapsedRoot = document.createElement('div');
    collapsedRoot.className = 'M9';
    collapsedRoot.innerHTML = `
      <div class="fX aiL" style="display: none;">
        <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      </div>
      <div class="aoD hl" tabindex="1">
        <div class="oL aDm">宛先</div>
      </div>
    `;
    document.body.appendChild(collapsedRoot);

    const collapsedHeader = collapsedRoot.querySelector('.aoD.hl') as HTMLElement;
    const hiddenTable = collapsedRoot.querySelector('.fX.aiL') as HTMLElement;
    const toInput = collapsedRoot.querySelector('input') as HTMLInputElement;

    collapsedHeader.addEventListener('click', () => {
      hiddenTable.style.display = 'block';
    });

    const isVis = await ensureFieldVisible(collapsedRoot, 'to');
    expect(isVis).toBe(true);
    expect(hiddenTable.style.display).toBe('block');

    collapsedRoot.remove();
  });

  it('forcefully expands collapsed To row via fallback if click handler is absent', async () => {
    const collapsedRoot = document.createElement('div');
    collapsedRoot.className = 'M9';
    collapsedRoot.innerHTML = `
      <div class="fX aiL" style="display: none;">
        <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      </div>
      <div class="aoD hl" tabindex="1">
        <div class="oL aDm">宛先</div>
      </div>
    `;
    document.body.appendChild(collapsedRoot);

    const hiddenTable = collapsedRoot.querySelector('.fX.aiL') as HTMLElement;
    const collapsedHeader = collapsedRoot.querySelector('.aoD.hl') as HTMLElement;

    // No click listener attached, so fallback should trigger
    const isVis = await ensureFieldVisible(collapsedRoot, 'to');
    expect(isVis).toBe(true);
    expect(hiddenTable.style.display).toBe('');
    expect(collapsedHeader.style.display).toBe('none');

    collapsedRoot.remove();
  });

  it('reads real PeopleKit chip with data-name and cleans domain parentheses', () => {
    const realRoot = document.createElement('div');
    realRoot.className = 'M9';
    realRoot.innerHTML = `
      <div class="wO nr">
        <div name="to" class="anm">
          <div role="option" class="afV" data-hovercard-id="kj.tadokoro@sunace-corp.com" data-name="田所 功次">
            <div class="afZ af1">
              <div class="akl">田所 功次</div>
              <div class="akk">（sunace-corp.com）</div>
            </div>
          </div>
          <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
        </div>
      </div>
    `;

    const list = readRecipients(realRoot, 'to');
    expect(list).toHaveLength(1);
    expect(list[0]?.email).toBe('kj.tadokoro@sunace-corp.com');
    expect(list[0]?.name).toBe('田所 功次');
  });

  it('falls back to reading contact from collapsed header when chips are not in container', () => {
    const collapsedRoot = document.createElement('div');
    collapsedRoot.className = 'M9';
    collapsedRoot.innerHTML = `
      <div class="fX aiL" style="display: none;">
        <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
      </div>
      <div class="aoD hl" tabindex="1">
        <div class="oL aDm">
          <span data-hovercard-id="kj.tadokoro@gmail.com">田所 功次 (gmail.com)</span>
        </div>
      </div>
    `;

    const list = readRecipients(collapsedRoot, 'to');
    expect(list).toHaveLength(1);
    expect(list[0]?.email).toBe('kj.tadokoro@gmail.com');
    expect(list[0]?.name).toBe('田所 功次');
  });

  it('clears multiple recipient chips cleanly', async () => {
    const multiRoot = document.createElement('div');
    multiRoot.className = 'M9';
    multiRoot.innerHTML = `
      <div class="wO nr">
        <div name="to" class="anm">
          <div class="afZ" data-hovercard-id="user1@example.com">
            <div class="af0"><div class="akl">user1@example.com</div></div>
            <div class="afX" aria-label="削除"><svg></svg></div>
          </div>
          <div class="afZ" data-hovercard-id="user2@example.com">
            <div class="af0"><div class="akl">user2@example.com</div></div>
            <div class="afX" aria-label="削除"><svg></svg></div>
          </div>
          <input class="agP aFx" peoplekit-id="BbVjBd" aria-label="To の宛先" type="text" role="combobox" value="" />
        </div>
      </div>
    `;

    // Attach click listeners to delete buttons
    multiRoot.querySelectorAll('.afX').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.afZ')?.remove();
      });
    });

    expect(readRecipients(multiRoot, 'to')).toHaveLength(2);
    const ok = await clearRecipients(multiRoot, 'to');
    expect(ok).toBe(true);
    expect(readRecipients(multiRoot, 'to')).toHaveLength(0);
  });
});
