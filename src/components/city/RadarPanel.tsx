import { Box, Button, ColorSwatch, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { t } from '../../i18n';
import { loadRadar, useIsOffline, useRadarData, useRadarServer, useRadarStore } from '../../stores';
import { useUiStore } from '../../stores/uiStore';
import { clockAt } from '../../utils/format';
import { paths } from '../../utils/paths';
import { hoursLabel, nowIndex, rainLabel, rainNear, relativeTime, selectedIndex } from '../../utils/radar';
import { Icon } from '../Icon';

import { RadarMap } from './RadarMap';

import type { RadarFrame } from '../../stores';
import type { RadarFramesProps, RadarNoticeProps, RadarPanelProps, RadarReadoutProps } from '../../types';
import type { ReactElement } from 'react';

const REFRESH_MS = 5 * 60 * 1000;
const PLAY_MS = 600;
const BAR_MAX = 26;
const BAR_MIN = 3;
const NO_FRAMES: RadarFrame[] = [];

function Notice({ text, action, onAction }: RadarNoticeProps): ReactElement {
  return (
    <Stack gap={10} py={16}>
      <Text fz={13} c="dimmed">{text}</Text>
      {action !== undefined && <Button fullWidth onClick={onAction}>{action}</Button>}
    </Stack>
  );
}

function barColor(selected: boolean, forecast: boolean): string {
  if (selected) { return 'signal.5'; }
  return forecast ? 'dark.6' : 'dark.5';
}

function RadarFrames({ frames, selected, cols, rows, onSelect }: RadarFramesProps): ReactElement {
  const amounts = frames.map((f) => rainNear(f, cols, rows));
  const top = Math.max(1, ...amounts);
  const now = nowIndex(frames);
  const first = frames.at(0);
  const last = frames.at(-1);
  const nowTime = frames[now]?.time ?? 0;
  return (
    <>
      <Group gap={2} wrap="nowrap" align="flex-end" h={BAR_MAX} mt={10}>
        {frames.map((f, i) => (
          <UnstyledButton key={f.time} flex={1} h="100%" display="flex" style={{ alignItems: 'flex-end' }}
            aria-label={relativeTime(f.time, nowTime)} aria-pressed={i === selected} onClick={() => { onSelect(f.time); }}>
            <Box w="100%" h={Math.max(BAR_MIN, (amounts[i] ?? 0) / top * BAR_MAX)}
              bg={barColor(i === selected, f.forecast)} />
          </UnstyledButton>
        ))}
      </Group>
      <Group justify="space-between" mt={4} fz={11} c="dimmed" wrap="nowrap">
        <Text span inherit>{first === undefined ? '' : hoursLabel(first.time, nowTime)}</Text>
        <Text span inherit fw={800} c="white">{t('radar.now')}</Text>
        <Text span inherit>{last === undefined || last.time === nowTime ? '' : hoursLabel(last.time, nowTime)}</Text>
      </Group>
    </>
  );
}

function Readout({ frame, nowTime, timeZone }: RadarReadoutProps): ReactElement {
  return (
    <Group justify="space-between" wrap="nowrap" gap={8} mih={24} px={8} py={3} fz={12} lh="16px" style={{ border: '1px solid var(--rule)' }}>
      {frame === undefined ? <Text span inherit c="dimmed">{t('radar.waiting')}</Text> : (
        <>
          <Text span inherit truncate="end"><Text span inherit fw={800} fz={13}>{clockAt(frame.time * 1000, timeZone)}</Text>{` · ${relativeTime(frame.time, nowTime)}`}</Text>
          <Text span inherit fw={800} c={frame.cityDbz === null ? 'dimmed' : 'signal.3'} style={{ flex: 'none' }}>{rainLabel(frame)}</Text>
        </>
      )}
    </Group>
  );
}

function Legend(): ReactElement {
  const items = [['signal.8', t('radar.light')], ['signal.5', t('radar.moderate')], ['signal.4', t('radar.heavy')], ['white', t('radar.city')]] as const;
  return (
    <Group gap={16} mt={12} fz={12}>
      {items.map(([color, label]) => (
        <Group key={label} gap={6} wrap="nowrap">
          <ColorSwatch color={`var(--mantine-color-${color.replace('.', '-')})`} size={12} radius={0} withShadow={false} />
          <Text span inherit>{label}</Text>
        </Group>
      ))}
    </Group>
  );
}

function RadarContent({ cityId, timeZone, height }: RadarPanelProps): ReactElement {
  const { land, radar, query } = useRadarData(cityId);
  const offline = useIsOffline();
  const retry = useRadarStore((s) => s.retry);
  const frameTime = useUiStore((s) => s.radarFrame);
  const setFrame = useUiStore((s) => s.setRadarFrame);
  const [playing, setPlaying] = useState(false);
  const frames = radar?.frames ?? NO_FRAMES;
  const index = selectedIndex(frames, frameTime);
  const nowTime = frames[nowIndex(frames)]?.time ?? 0;
  const step = (by: number) => {
    const next = frames.at((index + by) % Math.max(1, frames.length));
    if (next !== undefined) { setFrame(next.time); }
  };
  useEffect(() => {
    if (offline) { return; }
    void loadRadar(cityId);
    const timer = setInterval(() => { void loadRadar(cityId); }, REFRESH_MS);
    return () => { clearInterval(timer); };
  }, [cityId, offline]);
  useEffect(() => {
    if (!playing || frames.length === 0) { return; }
    const next = frames.at((index + 1) % frames.length);
    const timer = setTimeout(() => { if (next !== undefined) { setFrame(next.time); } }, PLAY_MS);
    return () => { clearTimeout(timer); };
  }, [playing, frames, index, setFrame]);
  if (land === undefined && radar === undefined) {
    if (offline) { return <Notice text={t('radar.offline')} />; }
    return <Notice text={query.error ?? t('radar.failed')} action={t('radar.retry')} onAction={() => { retry(cityId); void loadRadar(cityId); }} />;
  }
  const map = land ?? { version: 0, cols: 46, rows: 40, cells: '' };
  return (
    <>
      <Readout frame={frames[index]} nowTime={nowTime} timeZone={timeZone} />
      <Box mt={8}><RadarMap land={map} frame={frames[index]} height={height} /></Box>
      <Text fz={10} c="dimmed" ta="right" mt={4}>{t('radar.credit')}</Text>
      {query.status === 'error' && !offline && (
        <Group justify="space-between" wrap="nowrap" mt={4}>
          <Text fz={12} c="dimmed">{t('radar.stale')}</Text>
          <UnstyledButton fz={12} fw={800} c="signal.3" onClick={() => { retry(cityId); void loadRadar(cityId); }}>{t('radar.retry')}</UnstyledButton>
        </Group>
      )}
      {frames.length > 0 && (
        <>
          <RadarFrames frames={frames} selected={index} cols={map.cols} rows={map.rows} onSelect={(time) => { setPlaying(false); setFrame(time); }} />
          <Group grow gap={4} mt={10} wrap="nowrap">
            <Button variant="default" aria-label={t('radar.prev')} onClick={() => { setPlaying(false); step(-1); }}><Icon name="prev" size={18} /></Button>
            <Button variant="default" onClick={() => { setPlaying((p) => !p); }}>
              <Group gap={8} wrap="nowrap"><Icon name={playing ? 'pause' : 'play'} size={16} />{playing ? t('radar.pause') : t('radar.play')}</Group>
            </Button>
            <Button variant="default" aria-label={t('radar.next')} onClick={() => { setPlaying(false); step(1); }}><Icon name="next" size={18} /></Button>
          </Group>
        </>
      )}
      <Legend />
    </>
  );
}

export function RadarPanel({ cityId, timeZone, height }: RadarPanelProps): ReactElement {
  const server = useRadarServer();
  const navigate = useNavigate();
  if (server.trim() === '') {
    return <Notice text={t('radar.noServer')} action={t('radar.openSettings')} onAction={() => { void navigate(paths.settings); }} />;
  }
  return <RadarContent cityId={cityId} timeZone={timeZone} height={height} />;
}
