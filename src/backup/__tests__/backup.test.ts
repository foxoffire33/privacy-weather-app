import { describe, expect, it } from 'vitest';

import { MAX_BACKUP_BYTES, MAX_CITIES, MAX_DAYS_PER_CITY, parseBackup } from '../backup';

const body = {
  exportedAt: '2026-01-01T00:00:00.000Z',
  cities: [{ id: '1', name: 'Lisbon', region: '', lat: 38.7, lon: -9.1, followedAt: '2026-01-01' }],
  history: {},
  settings: { tempUnit: 'C' },
};

const city = (id: string, lat = 38.7, lon = -9.1) => ({ id, name: `City ${id}`, region: '', lat, lon, followedAt: '2026-01-01' });

const parse = (payload: Record<string, unknown>) => parseBackup(JSON.stringify({ version: 1, ...payload }));

describe('parseBackup version handling', () => {
  it('accepts a version 1 backup', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, ...body }));
    expect(backup.version).toBe(1);
    expect(backup.cities).toHaveLength(1);
    expect(backup.exportedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects a backup without a version', () => {
    expect(() => parseBackup(JSON.stringify(body))).toThrow('supported version');
  });

  it('rejects non-integer and zero versions', () => {
    for (const version of ['1', 1.5, 0, null, true, -3]) {
      expect(() => parseBackup(JSON.stringify({ version, ...body }))).toThrow('supported version');
    }
  });

  it('rejects future versions with a distinct message', () => {
    for (const version of [2, 99]) {
      expect(() => parseBackup(JSON.stringify({ version, ...body }))).toThrow('newer version');
    }
  });
});

describe('parseBackup field validation', () => {
  it('imports valid records without skips', () => {
    const backup = parse({
      cities: [city('1', 90, 180), city('2', -90, -180)],
      history: { '1': { '2024-02-29': { hi: 20 } } },
      settings: { snapshotMinutes: 30 },
    });
    expect(backup.skipped).toEqual([]);
    expect(backup.cities).toHaveLength(2);
    expect(backup.history['1']).toHaveProperty('2024-02-29');
    expect(backup.settings.snapshotMinutes).toBe(30);
  });

  it('skips cities with out-of-range coordinates and reports them', () => {
    const backup = parse({ cities: [city('1', 91), city('2', -90.5), city('3', 38.7, 181), city('4', 38.7, -180.5), city('5')] });
    expect(backup.cities.map((c) => c.id)).toEqual(['5']);
    expect(backup.skipped).toEqual([
      { path: 'cities[0]', reason: 'invalid coordinates' },
      { path: 'cities[1]', reason: 'invalid coordinates' },
      { path: 'cities[2]', reason: 'invalid coordinates' },
      { path: 'cities[3]', reason: 'invalid coordinates' },
    ]);
  });

  it('skips cities with missing ids, missing names and duplicate ids', () => {
    const backup = parse({ cities: [city('1'), { name: 'No id', lat: 1, lon: 1 }, { id: '1', name: 'Dupe', lat: 1, lon: 1 }] });
    expect(backup.cities.map((c) => c.id)).toEqual(['1']);
    expect(backup.skipped).toEqual([
      { path: 'cities[1]', reason: 'missing or invalid city id' },
      { path: 'cities[2]', reason: 'duplicate city id' },
    ]);
  });

  it('rejects identifiers with special object prototype semantics', () => {
    const backup = parse({ cities: [city('__proto__'), city('constructor'), city('safe')] });
    expect(backup.cities.map((entry) => entry.id)).toEqual(['safe']);
    expect(backup.skipped).toHaveLength(2);
  });

  it('skips history dates that are not real calendar dates', () => {
    const backup = parse({
      cities: [city('1')],
      history: { '1': { '2026-02-31': { hi: 1 }, '2026-02-29': { hi: 2 }, '2026-1-01': { hi: 3 }, '2026-01-02': { hi: 4 } } },
    });
    expect(Object.keys(backup.history['1'])).toEqual(['2026-01-02']);
    expect(backup.skipped).toEqual([
      { path: 'history.1.2026-02-31', reason: 'not a valid calendar date' },
      { path: 'history.1.2026-02-29', reason: 'not a valid calendar date' },
      { path: 'history.1.2026-1-01', reason: 'not a valid calendar date' },
    ]);
  });

  it('skips invalid weather measurements and snapshot counts without losing other days', () => {
    const backup = parse({
      cities: [city('1')],
      history: { '1': {
        '2026-01-01': { snapshots: -1 },
        '2026-01-02': { snapshots: 2.7 },
        '2026-01-03': { mm: -40 },
        '2026-01-04': { uv: -10 },
        '2026-01-05': { snapshots: 2, mm: 3 },
      } },
    });
    expect(Object.keys(backup.history['1'])).toEqual(['2026-01-05']);
    expect(backup.skipped).toHaveLength(4);
    expect(backup.skipped.every((record) => record.reason === 'invalid weather measurements or snapshot count')).toBe(true);
  });

  it('skips history for cities that were not imported', () => {
    const backup = parse({ cities: [city('1')], history: { '1': { '2026-01-01': { hi: 1 } }, '99': { '2026-01-01': { hi: 2 } } } });
    expect(Object.keys(backup.history)).toEqual(['1']);
    expect(backup.skipped).toEqual([{ path: 'history.99', reason: 'history for an unknown city' }]);
  });

  it('skips out-of-range snapshot intervals and reports them', () => {
    const backup = parse({ cities: [city('1')], settings: { snapshotMinutes: 0 } });
    expect(backup.settings.snapshotMinutes).toBeUndefined();
    expect(backup.skipped).toEqual([{ path: 'settings.snapshotMinutes', reason: 'invalid setting value' }]);
  });

  it('repairs an invalid followedAt to today without skipping the city', () => {
    const backup = parse({ cities: [{ ...city('1'), followedAt: '2026-02-31' }] });
    expect(backup.cities).toHaveLength(1);
    expect(backup.cities[0].followedAt).toBe(new Date().toISOString().slice(0, 10));
    expect(backup.skipped).toEqual([]);
  });

  it('rejects a file larger than the byte limit before parsing', () => {
    expect(() => parseBackup(`{"version":1,"cities":[],"history":{},"settings":{},"pad":"${'a'.repeat(MAX_BACKUP_BYTES)}"}`)).toThrow('too large');
  });

  it('caps the number of imported cities and reports the limit', () => {
    const cities = Array.from({ length: MAX_CITIES + 1 }, (_, i) => city(`c${String(i)}`));
    const backup = parse({ cities });
    expect(backup.cities).toHaveLength(MAX_CITIES);
    expect(backup.skipped).toEqual([{ path: 'cities', reason: 'record limit exceeded' }]);
  });

  it('caps the number of imported days per city and reports the limit', () => {
    const dates = Array.from({ length: MAX_DAYS_PER_CITY + 1 }, (_, i) => new Date(Date.UTC(2000, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));
    const log = Object.fromEntries(dates.map((d) => [d, { hi: 20 }]));
    const backup = parse({ cities: [city('1')], history: { '1': log } });
    expect(Object.keys(backup.history['1'])).toHaveLength(MAX_DAYS_PER_CITY);
    expect(backup.skipped).toEqual([{ path: 'history.1', reason: 'record limit exceeded' }]);
  });
});
