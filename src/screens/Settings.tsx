import { Box, Button, ColorPicker, ColorSwatch, FileButton, Group, PasswordInput, SegmentedControl, Select, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { version } from '../../package.json';
import { countDays } from '../backup/backup';
import { ScreenHeader } from '../components/ScreenHeader';
import { SettingsAbout } from '../components/SettingsAbout';
import { LANGUAGES, systemLanguage, t } from '../i18n';
import { clearHistory, refreshAll, storedCounts, useSettings, useUpdateSettings } from '../stores';
import { useBackupStore } from '../stores/backupStore';
import { ACCENT_NAMES, ACCENTS } from '../theme';

import type { BackupResult, StatusMessage } from '../types';
import type { ReactElement } from 'react';

const ACCENT_KEYS = { green: 'settings.accentGreen', red: 'settings.accentRed', blue: 'settings.accentBlue', off: 'settings.accentOff' } as const;

function backupResultMessage(result: BackupResult | null): StatusMessage | null {
  if (result === null) { return null; }
  if (!result.ok) { return { ok: false, text: result.error }; }
  return { ok: true, text: t('settings.imported', { cities: result.cities, days: result.days }) };
}

export function Settings(): ReactElement {
  const settings = useSettings();
  const set = useUpdateSettings();
  const counts = storedCounts();
  const s = { settings };
  const resetFile = useRef<() => void>(null);
  const { pending, parts, result, pick, setPart, confirm, cancel, exportFile } = useBackupStore(useShallow((st) => ({
    pending: st.pending, parts: st.parts, result: st.result,
    pick: st.pick, setPart: st.setPart, confirm: st.confirm, cancel: st.cancel, exportFile: st.exportFile,
  })));
  const onFile = async (file: File | null) => {
    await pick(file);
    resetFile.current?.();
  };
  const importMsg = backupResultMessage(result);
  return (
    <Box className="screen">
      <ScreenHeader />
      <Title className="display display-sm">{t('settings.title')}</Title>
      <Stack gap={0} px={20} pb={24}>
        <Box className="kicker">{t('settings.language')}</Box>
        <Box py={12} className="row">
          <Select label={t('settings.language')} description={t('settings.languageNote')} allowDeselect={false} searchable={false}
            value={s.settings.language} onChange={(v) => { if (v !== null && v !== '') { set({ language: v }); } }}
            data={[
              { value: 'system', label: t('settings.languageSystem', { name: LANGUAGES.find((l) => l.code === systemLanguage())?.name }) },
              ...LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
            ]} />
        </Box>

        <Box className="kicker">{t('settings.dataSource')}</Box>
        <Box py={12} className="row">
          <PasswordInput label={t('settings.apiKey')} placeholder={t('settings.optional')} value={s.settings.apiKey}
            description={t('settings.apiKeyNote')}
            onChange={(e) => { set({ apiKey: e.currentTarget.value.trim() }); }} />
        </Box>
        <Box py={12} className="row">
          <TextInput label={t('settings.server')} placeholder="https://api.open-meteo.com" value={s.settings.server}
            description={t('settings.serverNote')}
            onChange={(e) => { set({ server: e.currentTarget.value.trim() }); }} />
        </Box>
        <Button variant="subtle" color="gray" mt={8} onClick={() => void refreshAll({ maxAgeMs: 0 })}>{t('settings.apply')}</Button>

        <Box className="kicker">{t('settings.appearance')}</Box>
        <Box py={12} className="row">
          <Text fz={14} fw={600}>{t('settings.accent')}</Text>
          <Text fz={12} c="dimmed" mb={10}>{t('settings.accentNote')}</Text>
          <Group gap={8}>
            {ACCENT_NAMES.map((a) => (
              <UnstyledButton key={a} aria-pressed={s.settings.accent === a} onClick={() => { set({ accent: a }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                  border: `2px solid ${s.settings.accent === a ? '#fff' : 'var(--rule-soft)'}` }}>
                <ColorSwatch color={a === 'off' ? '#000' : ACCENTS[a].tuple[5]} size={16} radius={0} withShadow={false} style={{ border: '1px solid var(--rule)' }} />
                <Text fz={13} fw={800}>{t(ACCENT_KEYS[a])}</Text>
              </UnstyledButton>
            ))}
            <UnstyledButton aria-pressed={s.settings.accent === 'custom'} onClick={() => { set({ accent: 'custom' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                border: `2px solid ${s.settings.accent === 'custom' ? '#fff' : 'var(--rule-soft)'}` }}>
              <ColorSwatch color={s.settings.accentColor} size={16} radius={0} withShadow={false} style={{ border: '1px solid var(--rule)' }} />
              <Text fz={13} fw={800}>{t('settings.custom')}</Text>
            </UnstyledButton>
          </Group>
          {s.settings.accent === 'custom' && (
            <Box mt={12}>
              <ColorPicker fullWidth format="hex" value={s.settings.accentColor} onChange={(accentColor) => { set({ accent: 'custom', accentColor }); }}
                swatchesPerRow={7} swatches={['#e11d48', '#f97316', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777', '#78716c', '#0f766e', '#b91c1c', '#1d4ed8', '#7e22ce']} />
              <TextInput mt={8} label={t('settings.hex')} value={s.settings.accentColor} maxLength={7}
                onChange={(e) => { set({ accent: 'custom', accentColor: e.currentTarget.value }); }} />
              <Text fz={12} c="dimmed" mt={4}>{t('settings.hexNote')}</Text>
            </Box>
          )}
        </Box>

        <Box className="kicker">{t('settings.units')}</Box>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>{t('settings.temperature')}</Text>
          <SegmentedControl value={s.settings.tempUnit} onChange={(v) => { set({ tempUnit: v }); }}
            data={[{ label: '°C', value: 'C' }, { label: '°F', value: 'F' }]} />
        </Group>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>{t('settings.wind')}</Text>
          <SegmentedControl value={s.settings.windUnit} onChange={(v) => { set({ windUnit: v }); }}
            data={[{ label: 'km/h', value: 'kmh' }, { label: 'm/s', value: 'ms' }, { label: 'mph', value: 'mph' }]} />
        </Group>

        <Box className="kicker">{t('settings.history')}</Box>
        <Box py={12} className="row">
          <Switch label={t('offline.label')} description={t('offline.note')}
            checked={s.settings.offline} onChange={(e) => { set({ offline: e.currentTarget.checked }); }} />
        </Box>
        <Box py={12} className="row">
          <Select label={t('settings.interval')} value={String(s.settings.snapshotMinutes)} allowDeselect={false}
            description={t('settings.intervalNote')}
            onChange={(v) => { if (v !== null && v !== '') { set({ snapshotMinutes: Number(v) }); } }}
            data={[
              { value: '15', label: t('settings.every15') },
              { value: '30', label: t('settings.every30') },
              { value: '60', label: t('settings.hourly') },
              { value: '180', label: t('settings.every180') },
            ]} />
        </Box>
        <Box py={12} className="row">
          <Switch label={t('settings.fillGaps')} description={t('settings.fillGapsNote')}
            checked={s.settings.backfill} onChange={(e) => { set({ backfill: e.currentTarget.checked }); }} />
        </Box>
        <Group py={12} className="row" justify="space-between" wrap="nowrap">
          <Box>
            <Text fz={14} fw={600}>{t('settings.stored')}</Text>
            <Text fz={12} c="dimmed">{t('settings.storedCount', { cities: counts.cities, days: counts.days })}</Text>
          </Box>
          <Group gap={8} wrap="nowrap">
            <Button variant="outline" color="gray" onClick={exportFile}>{t('settings.export')}</Button>
            <FileButton resetRef={resetFile} accept="application/json,.json" onChange={(file) => void onFile(file)}>
              {(props) => <Button {...props} variant="outline" color="gray">{t('settings.import')}</Button>}
            </FileButton>
          </Group>
        </Group>
        {pending && (
          <Box py={12} className="row">
            <Text fz={14} fw={600}>{t('settings.importTitle')}</Text>
            <Text fz={12} c="dimmed" mb={8}>
              {pending.exportedAt === '' ? '' : t('settings.exported', { date: pending.exportedAt.slice(0, 10) })}{t('settings.importNote')}
            </Text>
            <Stack gap={10}>
              <Switch label={t('settings.importCities', { n: pending.cities.length })} description={t('settings.importCitiesNote')}
                disabled={pending.cities.length === 0} checked={parts.cities} onChange={(e) => { setPart('cities', e.currentTarget.checked); }} />
              <Switch label={t('settings.importHistory', { n: countDays(pending) })} description={t('settings.importHistoryNote')}
                disabled={countDays(pending) === 0} checked={parts.history} onChange={(e) => { setPart('history', e.currentTarget.checked); }} />
              <Switch label={t('settings.importSettings')} description={t('settings.importSettingsNote')}
                disabled={Object.keys(pending.settings).length === 0} checked={parts.settings} onChange={(e) => { setPart('settings', e.currentTarget.checked); }} />
            </Stack>
            <Group mt={12} gap={8}>
              <Button disabled={!parts.cities && !parts.history && !parts.settings} onClick={confirm}>{t('settings.importSelected')}</Button>
              <Button variant="subtle" color="gray" onClick={cancel}>{t('common.cancel')}</Button>
            </Group>
          </Box>
        )}
        {importMsg && <Text fz={13} py={8} c={importMsg.ok ? undefined : 'signal.3'} role="status">{importMsg.text}</Text>}
        <Button variant="subtle" color="signal" mt={8}
          onClick={() => modals.openConfirmModal({
            groupProps: { grow: true, wrap: 'nowrap', mt: 16 },
            children: t('settings.confirmDeleteAll'),
            labels: { confirm: t('common.delete'), cancel: t('common.cancel') },
            onConfirm: clearHistory,
          })}>
          {t('settings.deleteAll')}
        </Button>

        <SettingsAbout version={version} />
      </Stack>
    </Box>
  );
}
