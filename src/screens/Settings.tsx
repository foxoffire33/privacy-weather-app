import { Box, Button, ColorPicker, ColorSwatch, FileButton, Group, PasswordInput, SegmentedControl, Select, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useRef, useState } from 'react';
import { clearHistory, exportSnapshot, importBackup, refreshAll, storedCounts, useSettings, useUpdateSettings } from '../storesV2';
import type { Accent, TempUnit, WindUnit } from '../storesV2';
import { ACCENTS } from '../theme';
import { downloadFile } from '../lib/format';
import { countDays, parseBackup, type Backup, type BackupParts } from '../lib/backup';
import { ScreenHeader } from '../components/ScreenHeader';
import { LANGUAGES, systemLanguage, t } from '../i18n';
import { version } from '../../package.json';

const ACCENT_KEYS = { green: 'settings.accentGreen', red: 'settings.accentRed', blue: 'settings.accentBlue', off: 'settings.accentOff' } as const;

export function Settings() {
  const settings = useSettings();
  const set = useUpdateSettings();
  const counts = storedCounts();
  const s = { settings };
  const resetFile = useRef<() => void>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [parts, setParts] = useState<BackupParts>({ cities: true, history: true, settings: false });
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const onFile = async (file: File | null) => {
    setImportMsg(null);
    if (!file) return;
    try {
      const b = parseBackup(await file.text());
      setParts({ cities: b.cities.length > 0, history: countDays(b) > 0, settings: false });
      setPending(b);
    } catch (e) {
      setPending(null);
      setImportMsg({ ok: false, text: (e as Error).message });
    }
    resetFile.current?.();
  };
  const doImport = () => {
    if (!pending) return;
    const r = importBackup(pending, parts);
    setImportMsg({ ok: true, text: t('settings.imported', { cities: r.cities, days: r.days }) });
    setPending(null);
  };
  const exportAll = () => {
    const { cities, history, settings: stored } = exportSnapshot();
    const { apiKey: _omit, ...safeSettings } = stored;
    downloadFile('weather-log.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings: safeSettings, cities, history }, null, 2), 'application/json');
  };
  return (
    <Box className="screen">
      <ScreenHeader />
      <Title className="display display-sm">{t('settings.title')}</Title>
      <Stack gap={0} px={20} pb={24}>
        <Box className="kicker">{t('settings.language')}</Box>
        <Box py={12} className="row">
          <Select label={t('settings.language')} description={t('settings.languageNote')} allowDeselect={false} searchable={false}
            value={s.settings.language ?? 'system'} onChange={(v) => v && set({ language: v })}
            data={[
              { value: 'system', label: t('settings.languageSystem', { name: LANGUAGES.find((l) => l.code === systemLanguage())?.name }) },
              ...LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
            ]} />
        </Box>

        <Box className="kicker">{t('settings.dataSource')}</Box>
        <Box py={12} className="row">
          <PasswordInput label={t('settings.apiKey')} placeholder={t('settings.optional')} value={s.settings.apiKey}
            description={t('settings.apiKeyNote')}
            onChange={(e) => set({ apiKey: e.currentTarget.value.trim() })} />
        </Box>
        <Box py={12} className="row">
          <TextInput label={t('settings.server')} placeholder="https://api.open-meteo.com" value={s.settings.server}
            description={t('settings.serverNote')}
            onChange={(e) => set({ server: e.currentTarget.value.trim() })} />
        </Box>
        <Button variant="subtle" color="gray" mt={8} onClick={() => void refreshAll({ maxAgeMs: 0 })}>{t('settings.apply')}</Button>

        <Box className="kicker">{t('settings.appearance')}</Box>
        <Box py={12} className="row">
          <Text fz={14} fw={600}>{t('settings.accent')}</Text>
          <Text fz={12} c="dimmed" mb={10}>{t('settings.accentNote')}</Text>
          <Group gap={8}>
            {(Object.keys(ACCENTS) as Exclude<Accent, 'custom'>[]).map((a) => (
              <UnstyledButton key={a} aria-pressed={s.settings.accent === a} onClick={() => set({ accent: a })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                  border: `2px solid ${s.settings.accent === a ? '#fff' : 'var(--rule-soft)'}` }}>
                <ColorSwatch color={a === 'off' ? '#000' : ACCENTS[a].tuple[5]} size={16} radius={0} withShadow={false} style={{ border: '1px solid var(--rule)' }} />
                <Text fz={13} fw={800}>{t(ACCENT_KEYS[a])}</Text>
              </UnstyledButton>
            ))}
            <UnstyledButton aria-pressed={s.settings.accent === 'custom'} onClick={() => set({ accent: 'custom' })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                border: `2px solid ${s.settings.accent === 'custom' ? '#fff' : 'var(--rule-soft)'}` }}>
              <ColorSwatch color={s.settings.accentColor} size={16} radius={0} withShadow={false} style={{ border: '1px solid var(--rule)' }} />
              <Text fz={13} fw={800}>{t('settings.custom')}</Text>
            </UnstyledButton>
          </Group>
          {s.settings.accent === 'custom' && (
            <Box mt={12}>
              <ColorPicker fullWidth format="hex" value={s.settings.accentColor} onChange={(accentColor) => set({ accent: 'custom', accentColor })}
                swatchesPerRow={7} swatches={['#e11d48', '#f97316', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777', '#78716c', '#0f766e', '#b91c1c', '#1d4ed8', '#7e22ce']} />
              <TextInput mt={8} label={t('settings.hex')} value={s.settings.accentColor} maxLength={7}
                onChange={(e) => set({ accent: 'custom', accentColor: e.currentTarget.value })} />
              <Text fz={12} c="dimmed" mt={4}>{t('settings.hexNote')}</Text>
            </Box>
          )}
        </Box>

        <Box className="kicker">{t('settings.units')}</Box>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>{t('settings.temperature')}</Text>
          <SegmentedControl value={s.settings.tempUnit} onChange={(v) => set({ tempUnit: v as TempUnit })}
            data={[{ label: '°C', value: 'C' }, { label: '°F', value: 'F' }]} />
        </Group>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>{t('settings.wind')}</Text>
          <SegmentedControl value={s.settings.windUnit} onChange={(v) => set({ windUnit: v as WindUnit })}
            data={[{ label: 'km/h', value: 'kmh' }, { label: 'm/s', value: 'ms' }, { label: 'mph', value: 'mph' }]} />
        </Group>

        <Box className="kicker">{t('settings.history')}</Box>
        <Box py={12} className="row">
          <Select label={t('settings.interval')} value={String(s.settings.snapshotMinutes)} allowDeselect={false}
            description={t('settings.intervalNote')}
            onChange={(v) => v && set({ snapshotMinutes: Number(v) })}
            data={[
              { value: '15', label: t('settings.every15') },
              { value: '30', label: t('settings.every30') },
              { value: '60', label: t('settings.hourly') },
              { value: '180', label: t('settings.every180') },
            ]} />
        </Box>
        <Box py={12} className="row">
          <Switch label={t('settings.fillGaps')} description={t('settings.fillGapsNote')}
            checked={s.settings.backfill} onChange={(e) => set({ backfill: e.currentTarget.checked })} />
        </Box>
        <Group py={12} className="row" justify="space-between" wrap="nowrap">
          <Box>
            <Text fz={14} fw={600}>{t('settings.stored')}</Text>
            <Text fz={12} c="dimmed">{t('settings.storedCount', { cities: counts.cities, days: counts.days })}</Text>
          </Box>
          <Group gap={8} wrap="nowrap">
            <Button variant="outline" color="gray" onClick={exportAll}>{t('settings.export')}</Button>
            <FileButton resetRef={resetFile} accept="application/json,.json" onChange={(file) => void onFile(file)}>
              {(props) => <Button {...props} variant="outline" color="gray">{t('settings.import')}</Button>}
            </FileButton>
          </Group>
        </Group>
        {pending && (
          <Box py={12} className="row">
            <Text fz={14} fw={600}>{t('settings.importTitle')}</Text>
            <Text fz={12} c="dimmed" mb={8}>
              {pending.exportedAt ? t('settings.exported', { date: pending.exportedAt.slice(0, 10) }) : ''}{t('settings.importNote')}
            </Text>
            <Stack gap={10}>
              <Switch label={t('settings.importCities', { n: pending.cities.length })} description={t('settings.importCitiesNote')}
                disabled={!pending.cities.length} checked={parts.cities} onChange={(e) => setParts({ ...parts, cities: e.currentTarget.checked })} />
              <Switch label={t('settings.importHistory', { n: countDays(pending) })} description={t('settings.importHistoryNote')}
                disabled={!countDays(pending)} checked={parts.history} onChange={(e) => setParts({ ...parts, history: e.currentTarget.checked })} />
              <Switch label={t('settings.importSettings')} description={t('settings.importSettingsNote')}
                disabled={!Object.keys(pending.settings).length} checked={parts.settings} onChange={(e) => setParts({ ...parts, settings: e.currentTarget.checked })} />
            </Stack>
            <Group mt={12} gap={8}>
              <Button disabled={!parts.cities && !parts.history && !parts.settings} onClick={doImport}>{t('settings.importSelected')}</Button>
              <Button variant="subtle" color="gray" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
            </Group>
          </Box>
        )}
        {importMsg && <Text fz={13} py={8} c={importMsg.ok ? undefined : 'signal.3'} role="status">{importMsg.text}</Text>}
        <Button variant="subtle" color="signal" mt={8}
          onClick={() => { if (window.confirm(t('settings.confirmDeleteAll'))) clearHistory(); }}>
          {t('settings.deleteAll')}
        </Button>

        <Box className="kicker">{t('settings.about')}</Box>
        <Stack gap={4} py={12}>
          <Text fz={13} c="dimmed">{t('settings.license', { version })}</Text>
          <Text fz={13} c="dimmed">{t('settings.attribution')}</Text>
        </Stack>
      </Stack>
    </Box>
  );
}
