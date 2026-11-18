import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Barrel from '..';

vi.mock('..', async (importOriginal) => {
  const actual = await importOriginal<typeof Barrel>();
  return { ...actual, fillRange: vi.fn() };
});

describe('trends download failures', () => {
  beforeEach(() => { vi.resetModules(); });

  it('keeps errors assigned to their failed windows across independent recoveries', async () => {
    const [trends, barrel] = await Promise.all([import('../trendsStore'), import('..')]);
    const windows = [{ from: '2025-01-01', to: '2025-01-01' }, { from: '2025-02-01', to: '2025-02-01' }];
    vi.mocked(barrel.fillRange).mockImplementation(async (_city, from) => {
      await Promise.resolve();
      throw new Error(from === windows[0].from ? 'first timeout' : 'second rate limit');
    });
    await trends.useTrendsStore.getState().ensureWindows('city', windows);
    const keys = windows.map((w) => trends.windowKey('city', w));
    expect(trends.useTrendsStore.getState().failed).toEqual(keys);
    expect(trends.useTrendsStore.getState().failureErrors[keys[0]].cause).toMatchObject({ message: 'first timeout' });
    expect(trends.useTrendsStore.getState().failureErrors[keys[1]].cause).toMatchObject({ message: 'second rate limit' });

    vi.mocked(barrel.fillRange).mockImplementation(async () => { await Promise.resolve(); });
    await trends.useTrendsStore.getState().retryFailed('city', [windows[0]]);
    expect(trends.useTrendsStore.getState().failed).toEqual([keys[1]]);
    expect(Object.keys(trends.useTrendsStore.getState().failureErrors)).toEqual([keys[1]]);
  });
});
