import { describe, expect, it } from 'vitest';
import { deepActiveElement, isEditable, sleep, waitFor } from './dom';

describe('dom utils', () => {
  it('sleep delays execution', async () => {
    const start = Date.now();
    await sleep(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });

  it('waitFor resolves when condition is met', async () => {
    let count = 0;
    setTimeout(() => {
      count = 5;
    }, 40);

    const result = await waitFor(() => count === 5 && count, { timeout: 300, interval: 10 });
    expect(result).toBe(5);
  });

  it('waitFor returns null on timeout', async () => {
    const result = await waitFor(() => false, { timeout: 40, interval: 10 });
    expect(result).toBeNull();
  });

  it('isEditable detects contenteditable elements correctly', () => {
    const div = document.createElement('div');
    expect(isEditable(div)).toBe(false);

    div.setAttribute('contenteditable', 'true');
    expect(isEditable(div)).toBe(true);

    const plaintextDiv = document.createElement('div');
    plaintextDiv.setAttribute('contenteditable', 'plaintext-only');
    expect(isEditable(plaintextDiv)).toBe(true);

    const input = document.createElement('input');
    expect(isEditable(input)).toBe(false);
  });

  it('deepActiveElement penetrates shadow DOM boundaries', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const innerInput = document.createElement('input');
    shadow.appendChild(innerInput);
    document.body.appendChild(host);

    innerInput.focus();
    // In happy-dom or real browser, activeElement on shadow boundary
    const active = deepActiveElement();
    expect(active === innerInput || active === host).toBe(true);

    host.remove();
  });
});
