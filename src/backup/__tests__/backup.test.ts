import { describe, expect, it } from 'vitest';

import { parseBackup } from '../backup';

const body = {
  exportedAt: '2026-01-01T00:00:00.000Z',
  cities: [{ id: '1', name: 'Lisbon', region: '', lat: 38.7, lon: -9.1, followedAt: '2026-01-01' }],
  history: {},
  settings: { tempUnit: 'C' },
};

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
