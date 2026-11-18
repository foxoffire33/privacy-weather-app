import { describe, expect, it } from 'vitest';

import { activeRadarRunCount, useRadarStore } from '../radarStore';

describe('radar lifecycle bookkeeping', () => {
  it('does not retain city IDs after thousands of drops', () => {
    for (let i = 0; i < 2000; i += 1) { useRadarStore.getState().drop(`test-city-${String(i)}`); }
    expect(activeRadarRunCount()).toBe(0);
  });
});
