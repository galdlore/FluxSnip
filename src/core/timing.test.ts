import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFieldWaitMs, onFieldWaitRaised, setFieldWaitMs, waitField } from './timing';
import { FIELD_WAIT_SAFE_MS } from './types';

describe('waitField', () => {
  afterEach(() => {
    vi.useRealTimers();
    onFieldWaitRaised(null);
    setFieldWaitMs(150);
  });

  it('returns within the configured wait without raising it', async () => {
    setFieldWaitMs(50);
    const raised = vi.fn();
    onFieldWaitRaised(raised);

    const result = await waitField(() => 'ok');

    expect(result).toBe('ok');
    expect(raised).not.toHaveBeenCalled();
    expect(getFieldWaitMs()).toBe(50);
  });

  it('keeps waiting past the configured wait and raises it when the condition is met late', async () => {
    vi.useFakeTimers();
    setFieldWaitMs(50);
    const raised = vi.fn();
    onFieldWaitRaised(raised);

    const readyAt = Date.now() + 200;
    const pending = waitField(() => Date.now() >= readyAt);
    await vi.advanceTimersByTimeAsync(300);

    expect(await pending).toBe(true);
    expect(raised).toHaveBeenCalledTimes(1);
    const next = raised.mock.calls[0]?.[0] as number;
    expect(next).toBeGreaterThanOrEqual(300);
    expect(next).toBeLessThanOrEqual(FIELD_WAIT_SAFE_MS);
    expect(getFieldWaitMs()).toBe(next);
  });

  it('gives up at the safe margin without raising', async () => {
    vi.useFakeTimers();
    setFieldWaitMs(50);
    const raised = vi.fn();
    onFieldWaitRaised(raised);

    const pending = waitField(() => false);
    await vi.advanceTimersByTimeAsync(FIELD_WAIT_SAFE_MS + 100);

    expect(await pending).toBeNull();
    expect(raised).not.toHaveBeenCalled();
    expect(getFieldWaitMs()).toBe(50);
  });

  it('clamps out-of-range values', () => {
    setFieldWaitMs(1);
    expect(getFieldWaitMs()).toBe(20);
    setFieldWaitMs(100000);
    expect(getFieldWaitMs()).toBe(FIELD_WAIT_SAFE_MS);
  });
});
