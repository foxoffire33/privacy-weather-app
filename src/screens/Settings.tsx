import { Box, Button, ColorPicker, Group, PasswordInput, SegmentedControl, Select, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import type { Accent, TempUnit, WindUnit } from '../types';
import { ACCENTS } from '../theme';
import { downloadFile } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';

export function Settings() {
  const s = useWeatherStore(useShallow((st) => ({
    settings: st.settings,
    cityCount: st.cities.length,
    dayCount: Object.values(st.history).reduce((n, log) => n + Object.keys(log).length, 0),
    updateSettings: st.updateSettings,
    refreshAll: st.refreshAll,
    clearHistory: st.clearHistory,
  })));
  const set = s.updateSettings;

  const exportAll = () => {
    const { cities, history, settings } = useWeatherStore.getState();
    const { apiKey: _omit, ...safeSettings } = settings;
    downloadFile('weather-log.json', JSON.stringify({ exportedAt: new Date().toISOString(), settings: safeSettings, cities, history }, null, 2), 'application/json');
  };

  return (
    <div className="screen">
      <ScreenHeader />
      <Title className="display display-sm">Settings.</Title>
      <Stack gap={0} px={20} pb={24}>
        <div className="kicker">Data source</div>
        <Box py={12} className="row">
          <PasswordInput label="API key" placeholder="Optional" value={s.settings.apiKey}
            description="Leave empty for the free API. Add a key only for a commercial Open-Meteo plan."
            onChange={(e) => set({ apiKey: e.currentTarget.value.trim() })} />
        </Box>
        <Box py={12} className="row">
          <TextInput label="Forecast server" placeholder="https://api.open-meteo.com" value={s.settings.server}
            description="Point to your own self-hosted Open-Meteo instance."
            onChange={(e) => set({ server: e.currentTarget.value.trim() })} />
        </Box>
        <Button variant="subtle" color="gray" mt={8} onClick={() => s.refreshAll({ maxAgeMs: 0 })}>Apply and refresh now</Button>

        <div className="kicker">Appearance</div>
        <Box py={12} className="row">
          <Text fz={14} fw={600}>Accent colour</Text>
          <Text fz={12} c="dimmed" mb={10}>Used for the main temperature panel and buttons. Off keeps everything black and white.</Text>
          <Group gap={8}>
            {(Object.keys(ACCENTS) as Exclude<Accent, 'custom'>[]).map((a) => (
              <UnstyledButton key={a} aria-pressed={s.settings.accent === a} onClick={() => set({ accent: a })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                  border: `2px solid ${s.settings.accent === a ? '#fff' : 'var(--rule-soft)'}` }}>
                <span style={{ width: 16, height: 16, background: a === 'off' ? '#000' : ACCENTS[a].tuple[5], border: '1px solid var(--rule)' }} />
                <Text fz={13} fw={800}>{ACCENTS[a].label}</Text>
              </UnstyledButton>
            ))}
            <UnstyledButton aria-pressed={s.settings.accent === 'custom'} onClick={() => set({ accent: 'custom' })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', minHeight: 44,
                border: `2px solid ${s.settings.accent === 'custom' ? '#fff' : 'var(--rule-soft)'}` }}>
              <span style={{ width: 16, height: 16, background: s.settings.accentColor, border: '1px solid var(--rule)' }} />
              <Text fz={13} fw={800}>Custom</Text>
            </UnstyledButton>
          </Group>
          {s.settings.accent === 'custom' && (
            <Box mt={12}>
              <ColorPicker fullWidth format="hex" value={s.settings.accentColor} onChange={(accentColor) => set({ accent: 'custom', accentColor })}
                swatchesPerRow={7} swatches={['#e11d48', '#f97316', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#db2777', '#78716c', '#0f766e', '#b91c1c', '#1d4ed8', '#7e22ce']} />
              <TextInput mt={8} label="Hex colour" value={s.settings.accentColor} maxLength={7}
                onChange={(e) => set({ accent: 'custom', accentColor: e.currentTarget.value })} />
              <Text fz={12} c="dimmed" mt={4}>Colours too light for white text are darkened automatically.</Text>
            </Box>
          )}
        </Box>

        <div className="kicker">Units</div>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>Temperature</Text>
          <SegmentedControl value={s.settings.tempUnit} onChange={(v) => set({ tempUnit: v as TempUnit })}
            data={[{ label: '°C', value: 'C' }, { label: '°F', value: 'F' }]} />
        </Group>
        <Group py={12} className="row" justify="space-between">
          <Text fz={14} fw={600}>Wind</Text>
          <SegmentedControl value={s.settings.windUnit} onChange={(v) => set({ windUnit: v as WindUnit })}
            data={[{ label: 'km/h', value: 'kmh' }, { label: 'm/s', value: 'ms' }, { label: 'mph', value: 'mph' }]} />
        </Group>

        <div className="kicker">History</div>
        <Box py={12} className="row">
          <Select label="Snapshot interval" value={String(s.settings.snapshotMinutes)} allowDeselect={false}
            description="While the app is open. The Android build will use a background job."
            onChange={(v) => v && set({ snapshotMinutes: Number(v) })}
            data={[
              { value: '15', label: 'Every 15 minutes' },
              { value: '30', label: 'Every 30 minutes' },
              { value: '60', label: 'Hourly' },
              { value: '180', label: 'Every 3 hours' },
            ]} />
        </Box>
        <Box py={12} className="row">
          <Switch label="Fill gaps from archive" description="Days the app was closed are filled from Open-Meteo (up to 92 days)."
            checked={s.settings.backfill} onChange={(e) => set({ backfill: e.currentTarget.checked })} />
        </Box>
        <Group py={12} className="row" justify="space-between" wrap="nowrap">
          <Box>
            <Text fz={14} fw={600}>Stored on this device</Text>
            <Text fz={12} c="dimmed">{s.cityCount} cities · {s.dayCount} days · IndexedDB</Text>
          </Box>
          <Button variant="outline" color="gray" onClick={exportAll}>Export JSON</Button>
        </Group>
        <Button variant="subtle" color="signal" mt={8}
          onClick={() => { if (window.confirm('Delete all logged history? This cannot be undone.')) s.clearHistory(); }}>
          Delete all history
        </Button>

        <div className="kicker">About</div>
        <Stack gap={4} py={12}>
          <Text fz={13} c="dimmed">Open source · GPL-3.0 · v0.1.2</Text>
          <Text fz={13} c="dimmed">Weather data by Open-Meteo.com (CC BY 4.0)</Text>
        </Stack>
      </Stack>
    </div>
  );
}
