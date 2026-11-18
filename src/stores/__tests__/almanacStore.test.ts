import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

describe('almanac hydration', () => {
  it('keeps an unrelated persisted this-day entry when normals change before hydration', async () => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    const [idb, almanac] = await Promise.all([import('../core/idb'), import('../almanacStore')]);
    const day = [{ year: 2025, hi: 12, lo: 5 }];
    await idb.idbSet('wl2-almanac', { version: 1, state: { normals: {}, thisDay: { 'city:11-18': day } } });
    const hydration = almanac.useAlmanacStore.persist.rehydrate();
    almanac.useAlmanacStore.setState({ normals: { city: { '11-18': 10 } } });
    await hydration;
    expect(almanac.useAlmanacStore.getState().normals).toEqual({ city: { '11-18': 10 } });
    expect(almanac.useAlmanacStore.getState().thisDay).toEqual({ 'city:11-18': day });
    const persist = await import('../core/persistStorage');
    await persist.flushPersistedState('wl2-almanac');
    expect(await idb.idbGet('wl2-almanac')).toMatchObject({ state: { normals: { city: { '11-18': 10 } }, thisDay: { 'city:11-18': day } } });
  });
});
