import { describe, expect, it } from 'vitest';

import { defaultSettings, validatePersistedSettings } from '../settingsSchema';

describe('validatePersistedSettings', () => {
  it('accepts valid settings unchanged', () => {
    const stored = { ...defaultSettings, snapshotMinutes: 30, language: 'de' };
    const { value, issues } = validatePersistedSettings(stored);
    expect(value).toEqual(stored);
    expect(issues).toEqual([]);
  });

  it('defaults every field when the stored value is not an object', () => {
    for (const raw of [null, 'settings', 42, [], undefined]) {
      const { value, issues } = validatePersistedSettings(raw);
      expect(value).toEqual(defaultSettings);
      expect(issues).toEqual(['settings: expected an object']);
    }
  });

  it('keeps valid fields and defaults invalid ones', () => {
    const { value, issues } = validatePersistedSettings({ tempUnit: 'X', snapshotMinutes: 30, language: 'de' });
    expect(value).toEqual({ ...defaultSettings, snapshotMinutes: 30, language: 'de' });
    expect(issues).toEqual(['tempUnit: Invalid option: expected one of "C"|"F"']);
  });

  it('applies defaults to missing fields without recording issues', () => {
    const { value, issues } = validatePersistedSettings({ tempUnit: 'F' });
    expect(value).toEqual({ ...defaultSettings, tempUnit: 'F' });
    expect(issues).toEqual([]);
  });

  it('ignores unknown extra keys', () => {
    const { value, issues } = validatePersistedSettings({ ...defaultSettings, legacy: true });
    expect(value).toEqual(defaultSettings);
    expect(issues).toEqual([]);
  });

  it('accepts http and https server URLs and the empty default', () => {
    for (const good of ['', 'http://192.168.1.10:8080', 'https://example.com/base', '/weather']) {
      const { value, issues } = validatePersistedSettings({ server: good });
      expect(value.server).toBe(good);
      expect(issues).toEqual([]);
    }
  });

  it('rejects unsupported URL schemes and malformed URLs', () => {
    for (const bad of ['ftp://files.example.com', 'mailto:user@example.com', 'not a url']) {
      const { value, issues } = validatePersistedSettings({ server: bad });
      expect(value.server).toBe(bad);
      expect(issues).toHaveLength(1);
    }
  });

  it('validates the snapshot interval range', () => {
    for (const bad of [0, -5, 5000, 2.5, '60']) {
      const { value, issues } = validatePersistedSettings({ snapshotMinutes: bad });
      expect(value.snapshotMinutes).toBe(60);
      expect(issues).toHaveLength(1);
    }
    for (const good of [1, 15, 1440]) {
      const { value, issues } = validatePersistedSettings({ snapshotMinutes: good });
      expect(value.snapshotMinutes).toBe(good);
      expect(issues).toEqual([]);
    }
  });

  it('validates the accent color format', () => {
    expect(validatePersistedSettings({ accentColor: '#ABCDEF' }).value.accentColor).toBe('#ABCDEF');
    const { value, issues } = validatePersistedSettings({ accentColor: '#178' });
    expect(value.accentColor).toBe('#178a4a');
    expect(issues).toHaveLength(1);
  });

  it('validates the language code', () => {
    expect(validatePersistedSettings({ language: 'sv' }).value.language).toBe('sv');
    const { value, issues } = validatePersistedSettings({ language: 'zz' });
    expect(value.language).toBe('system');
    expect(issues).toHaveLength(1);
  });

  it('defaults every invalid enum and boolean field', () => {
    const { value, issues } = validatePersistedSettings({ tempUnit: 'K', windUnit: 'kn', accent: 'purple', backfill: 'yes', offline: 1 });
    expect(value).toEqual(defaultSettings);
    expect(issues).toHaveLength(5);
  });

  it('never includes stored values in issue messages', () => {
    const { issues } = validatePersistedSettings({ apiKey: 42, server: 'not-a-url-with-secret-token', tempUnit: 42 });
    expect(issues).toHaveLength(3);
    for (const issue of issues) {
      expect(issue).not.toContain('secret-token');
    }
  });
});
