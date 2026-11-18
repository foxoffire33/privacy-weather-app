import { describe, expect, it } from 'vitest';

import { isPersistedCity, isPersistedDayRecord } from '../validation';

const city = { id: '1', name: 'Amsterdam', region: '', lat: 52.37, lon: 4.89, followedAt: '2026-01-01' };
const day = { id: '1:2026-01-01', cityId: '1', date: '2026-01-01', source: 'log', snapshots: 2 };

describe('durable entity validation', () => {
  it('accepts complete and geographically valid cities', () => {
    const badLongitude: unknown = { ...city, lon: 181 };
    const badDate: unknown = { ...city, followedAt: '2026-02-30' };
    expect(isPersistedCity(city as unknown)).toBe(true);
    expect(isPersistedCity({ id: '1', lat: 52 })).toBe(false);
    expect(isPersistedCity(badLongitude)).toBe(false);
    expect(isPersistedCity(badDate)).toBe(false);
  });

  it('rejects corrupt user-owned day records', () => {
    expect(isPersistedDayRecord(day as unknown)).toBe(true);
    expect(isPersistedDayRecord({ ...day, snapshots: -1 })).toBe(false);
    expect(isPersistedDayRecord({ ...day, mm: -2 })).toBe(false);
    expect(isPersistedDayRecord({ ...day, date: '2026-02-30' })).toBe(false);
  });
});
