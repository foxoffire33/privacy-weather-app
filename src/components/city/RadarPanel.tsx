import { Box, Button, ColorSwatch, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { t } from '../../i18n';
import { loadRadar, RADAR_CELLS, useIsOffline, useRadarData, useRadarServer, useRadarStore } from '../../stores';
import { useUiStore } from '../../stores/uiStore';
import { useNowSeconds } from '../../utils/clock';
import { clockAt } from '../../utils/format';
import { paths } from '../../utils/paths';
import { hoursLabel, nowIndex, rainLabel, rainNear, relativeTime, selectedIndex } from '../../utils/radar';
import { Icon } from '../Icon';

import { RadarMap } from './RadarMap';

import type { LandMap, RadarFrame } from '../../stores';
import type { RadarControlsProps, RadarFramesProps, RadarNoticeProps, RadarPanelProps, RadarReadoutProps, RadarZoomProps } from '../../types';
import type { ReactElement } from 'react';

const REFRESH_MS = 5 * 60 * 1000;
const PLAY_MS = 600;
const BAR_MAX = 26;
const BAR_MIN = 3;
const NO_FRAMES: RadarFrame[] = [];
const CELLS: readonly number[] = RADAR_CELLS;
const LANDSCAPE_MAP_H = 'calc(100dvh - 150px)';
const EMPTY_LAND: LandMap = { version: 0, cols: 46, rows: 40, cells: '' };

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
  const nowTime = useNowSeconds();
  const now = nowIndex(frames, nowTime);
  const first = frames.at(0);
  const last = frames.at(-1);
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
        <Text span inherit>{last === undefined || last === frames[now] ? '' : hoursLabel(last.time, nowTime)}</Text>
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

function ZoomRow({ cell, fullscreenId, full }: RadarZoomProps): ReactElement {
  const setCell = useUiStore((s) => s.setRadarCell);
  const openChart = useUiStore((s) => s.openChart);
  const at = CELLS.indexOf(cell);
  const zoom = (by: number) => {
    const next = at + by >= 0 ? CELLS.at(at + by) : undefined;
    if (next !== undefined) { startTransition(() => { setCell(next); }); }
  };
  return (
    <Group grow gap={4} mt={4} wrap="nowrap">
      <Button variant="default" aria-label={t('radar.zoomOut')} disabled={at >= CELLS.length - 1} onClick={() => { zoom(1); }}><Icon name="minus" size={18} /></Button>
      <Button variant="default" aria-label={t('radar.zoomIn')} disabled={at <= 0} onClick={() => { zoom(-1); }}><Icon name="plus" size={18} /></Button>
      {!full && <Button variant="default" aria-label={t('chart.fullscreen')} onClick={() => { openChart(fullscreenId); }}><Icon name="expand" size={18} /></Button>}
    </Group>
  );
}

function RadarControls({ frames, index, cols, rows, cell, fullscreenId, full, stale, onRetry }: RadarControlsProps): ReactElement {
  const setFrame = useUiStore((s) => s.setRadarFrame);
  const [playing, setPlaying] = useState(false);
  const step = (by: number) => {
    setPlaying(false);
    const next = frames.at((index + by) % Math.max(1, frames.length));
    if (next !== undefined) { setFrame(next.time); }
  };
  useEffect(() => {
    if (!playing || frames.length === 0) { return; }
    const next = frames.at((index + 1) % frames.length);
    const timer = setTimeout(() => { if (next !== undefined) { setFrame(next.time); } }, PLAY_MS);
    return () => { clearTimeout(timer); };
  }, [playing, frames, index, setFrame]);
  return (
    <>
      {stale && (
        <Group justify="space-between" wrap="nowrap" mt={4}>
          <Text fz={12} c="dimmed">{t('radar.stale')}</Text>
          <UnstyledButton fz={12} fw={800} c="signal.3" onClick={onRetry}>{t('radar.retry')}</UnstyledButton>
        </Group>
      )}
      {frames.length > 0 && (
        <>
          <RadarFrames frames={frames} selected={index} cols={cols} rows={rows} onSelect={(time) => { setPlaying(false); setFrame(time); }} />
          <Group grow gap={4} mt={10} wrap="nowrap">
            <Button variant="default" aria-label={t('radar.prev')} onClick={() => { step(-1); }}><Icon name="prev" size={18} /></Button>
            <Button variant="default" onClick={() => { setPlaying((p) => !p); }}>
              <Group gap={8} wrap="nowrap"><Icon name={playing ? 'pause' : 'play'} size={16} />{playing ? t('radar.pause') : t('radar.play')}</Group>
            </Button>
            <Button variant="default" aria-label={t('radar.next')} onClick={() => { step(1); }}><Icon name="next" size={18} /></Button>
          </Group>
        </>
      )}
      <ZoomRow cell={cell} fullscreenId={fullscreenId} full={full} />
      <Legend />
    </>
  );
}

function RadarContent({ cityId, timeZone, height, fullscreenId }: RadarPanelProps): ReactElement {
  const cell = useUiStore((s) => s.radarCell);
  const { key, land, radar, query } = useRadarData(cityId, cell);
  const offline = useIsOffline();
  const landscape = useMediaQuery('(orientation: landscape)');
  const retry = useRadarStore((s) => s.retry);
  const frameTime = useUiStore((s) => s.radarFrame);
  const frames = radar?.frames ?? NO_FRAMES;
  const nowTime = useNowSeconds();
  const index = selectedIndex(frames, frameTime, nowTime);
  const reload = () => { retry(key); void loadRadar(cityId, cell); };
  useEffect(() => {
    if (offline) { return; }
    void loadRadar(cityId, cell);
    const timer = setInterval(() => { void loadRadar(cityId, cell); }, REFRESH_MS);
    return () => { clearInterval(timer); };
  }, [cityId, cell, offline]);
  if (land === undefined && radar === undefined) {
    if (offline) { return <Notice text={t('radar.offline')} />; }
    return <Notice text={query.error ?? t('radar.failed')} action={t('radar.retry')} onAction={reload} />;
  }
  const map = land ?? EMPTY_LAND;
  const side = height !== undefined && landscape;
  const readout = <Readout frame={frames[index]} nowTime={nowTime} timeZone={timeZone} />;
  const mapBox = (
    <>
      <RadarMap land={map} frame={frames[index]} height={side ? LANDSCAPE_MAP_H : height} />
      <Group justify="space-between" wrap="nowrap" mt={4} fz={10} c="dimmed">
        <Text span inherit style={{ flex: 'none' }}>{t('radar.area', { km: Math.round((map.cols * cell) / 1000) })}</Text>
        <Text span inherit ta="right">{t('radar.credit')}</Text>
      </Group>
    </>
  );
  const controls = (
    <RadarControls frames={frames} index={index} cols={map.cols} rows={map.rows} cell={cell} fullscreenId={fullscreenId}
      full={height !== undefined} stale={query.status === 'error' && !offline} onRetry={reload} />
  );
  if (side) {
    return <SimpleGrid cols={2} spacing={16}><Box>{mapBox}</Box><Box>{readout}{controls}</Box></SimpleGrid>;
  }
  return <>{readout}<Box mt={8}>{mapBox}</Box>{controls}</>;
}

export function RadarPanel({ cityId, timeZone, height, fullscreenId }: RadarPanelProps): ReactElement {
  const server = useRadarServer();
  const navigate = useNavigate();
  if (server.trim() === '') {
    return <Notice text={t('radar.noServer')} action={t('radar.openSettings')} onAction={() => { void navigate(paths.settings); }} />;
  }
  return <RadarContent cityId={cityId} timeZone={timeZone} height={height} fullscreenId={fullscreenId} />;
}
