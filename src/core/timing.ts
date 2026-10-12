import { waitFor } from './dom';
import { clampFieldWaitMs, DEFAULT_SETTINGS, FIELD_WAIT_SAFE_MS } from './types';

let fieldWaitMs = DEFAULT_SETTINGS.fieldWaitMs;
let raiseHandler: ((ms: number) => void) | null = null;

export function setFieldWaitMs(ms: number): void {
  fieldWaitMs = clampFieldWaitMs(ms);
}

export function getFieldWaitMs(): number {
  return fieldWaitMs;
}

/**
 * Registers a callback invoked when a wait needed more than fieldWaitMs, with the raised value to persist.
 */
export function onFieldWaitRaised(cb: ((ms: number) => void) | null): void {
  raiseHandler = cb;
}

function raiseFor(elapsed: number): void {
  const next = clampFieldWaitMs(Math.ceil((elapsed * 1.5) / 10) * 10);
  if (next <= fieldWaitMs) return;
  fieldWaitMs = next;
  raiseHandler?.(next);
}

/**
 * Waits up to fieldWaitMs, then keeps waiting up to FIELD_WAIT_SAFE_MS.
 * Success during the extension raises fieldWaitMs so the next run starts with enough margin.
 */
export async function waitField<T>(
  fn: () => T | null | undefined | false,
  interval = 15
): Promise<T | null> {
  const start = Date.now();
  const fast = await waitFor(fn, { timeout: fieldWaitMs, interval });
  if (fast !== null) return fast;

  const remaining = FIELD_WAIT_SAFE_MS - (Date.now() - start);
  if (remaining <= 0) return null;

  const late = await waitFor(fn, { timeout: remaining, interval });
  if (late !== null) {
    raiseFor(Date.now() - start);
  }
  return late;
}
