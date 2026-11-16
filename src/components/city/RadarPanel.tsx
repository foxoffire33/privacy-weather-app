import { Box, Button, ColorSwatch, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { useInViewport, useMediaQuery } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { t } from '../../i18n';
import { loadRadar, RADAR_CELLS, useIsOffline, VISIBLE_COLS, VISIBLE_ROWS, useRadarData, useRadarServer, useRadarStore } from '../../stores';
import { useUiStore } from '../../stores/uiStore';
import { useNowSeconds } from '../../utils/clock';
import { clockAt } from '../../utils/format';
import { paths } from '../../utils/paths';
import { buildTimeline, isWet, nowIndex, rainLabel, rainNear, relativeTime, selectedIndex } from '../../utils/radar';
import { Icon } from '../Icon';

import { RadarMap } from './RadarMap';

import type { LandMap, RadarFrame } from '../../stores';
import type { RadarControlsProps, TimelineKind, RadarFramesProps, RadarNoticeProps, RadarPanelProps, RadarReadoutProps, RadarZoomProps } from '../../types';
import type { ReactElement } from 'react';

const REFRESH_MS = 5 * 60 * 1000;
const PLAY_MS = 600;
const BAR_MAX = 26;
const BAR_MIN = 3;
const NO_FRAMES: RadarFrame[] = [];
const CELLS: readonly number[] = RADAR_CELLS;
const LANDSCAPE_MAP_H = 'calc(100dvh - 150px)';
const EMPTY_LAND: LandMap = { version: 0, cols: VISIBLE_COLS * 2, rows: VISIBLE_ROWS * 2, cells: '' };

function Notice({ text, action, onAction }: RadarNoticeProps): ReactElement {
  return (
    <Stack gap={10} py={16}>
      <Text fz={13} c="dimmed">{text}</Text>
      {action !== undefined && <Button fullWidth onClick={onAction}>{action}</Button>}
    </Stack>
  );
}

function barColor(selected: boolean, kind: TimelineKind): string {
  if (selected) { return 'signal.5'; }
  return kind === 'radar' ? 'dark.5' : 'dark.6';
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
              bg={barColor(i === selected, f.kind)} opacity={f.kind === 'model' && i !== selected ? 0.7 : 1} />
          </UnstyledButton>
        ))}
      </Group>
      <Group justify="space-between" mt={4} fz={11} c="dimmed" wrap="nowrap">
        <Text span inherit>{first === undefined ? '' : relativeTime(first.time, nowTime)}</Text>
        <Text span inherit fw={800} c="white">{t('radar.now')}</Text>
        <Text span inherit>{last === undefined || last === frames[now] ? '' : relativeTime(last.time, nowTime)}</Text>
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
          <Text span inherit fw={800} c={isWet(frame) ? 'signal.3' : 'dimmed'} style={{ flex: 'none' }}>{rainLabel(frame)}</Text>
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

function zoomedCell(cell: number, by: number): number | undefined {
  const at = CELLS.indexOf(cell) + by;
  return at >= 0 ? CELLS.at(at) : undefined;
}

function ZoomRow({ cell }: RadarZoomProps): ReactElement {
  const setCell = useUiStore((s) => s.setRadarCell);
  const at = CELLS.indexOf(cell);
  const zoom = (by: number) => {
    const next = zoomedCell(cell, by);
    if (next !== undefined) { setCell(next); }
  };
  return (
    <Group grow gap={4} mt={4} wrap="nowrap">
      <Button variant="default" aria-label={t('radar.zoomOut')} disabled={at >= CELLS.length - 1} onClick={() => { zoom(1); }}><Icon name="minus" size={18} /></Button>
      <Button variant="default" aria-label={t('radar.zoomIn')} disabled={at <= 0} onClick={() => { zoom(-1); }}><Icon name="plus" size={18} /></Button>
    </Group>
  );
}

function RadarControls({ frames, index, cols, rows, cell, stale, visible, onRetry }: RadarControlsProps): ReactElement {
  const setFrame = useUiStore((s) => s.setRadarFrame);
  const [paused, setPaused] = useState(false);
  const playing = visible && !paused;
  const step = (by: number) => {
    setPaused(true);
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
          <RadarFrames frames={frames} selected={index} cols={cols} rows={rows} onSelect={(time) => { setPaused(true); setFrame(time); }} />
          <Group grow gap={4} mt={10} wrap="nowrap">
            <Button variant="default" aria-label={t('radar.prev')} onClick={() => { step(-1); }}><Icon name="prev" size={18} /></Button>
            <Button variant="default" onClick={() => { setPaused(playing); }}>
              <Group gap={8} wrap="nowrap"><Icon name={playing ? 'pause' : 'play'} size={16} />{playing ? t('radar.pause') : t('radar.play')}</Group>
            </Button>
            <Button variant="default" aria-label={t('radar.next')} onClick={() => { step(1); }}><Icon name="next" size={18} /></Button>
          </Group>
        </>
      )}
      <ZoomRow cell={cell} />
      <Legend />
    </>
  );
}

function RadarContent({ cityId, timeZone, forecast, height }: RadarPanelProps): ReactElement {
  const cell = useUiStore((s) => s.radarCell);
  const setCell = useUiStore((s) => s.setRadarCell);
  const { ref: viewportRef, inViewport } = useInViewport();
  const { key, land, radar, query, shownCell } = useRadarData(cityId, cell);
  const offline = useIsOffline();
  const landscape = useMediaQuery('(orientation: landscape)');
  const retry = useRadarStore((s) => s.retry);
  const frameTime = useUiStore((s) => s.radarFrame);
  const nowTime = useNowSeconds();
  const frames = buildTimeline(radar?.frames ?? NO_FRAMES, forecast, nowTime);
  const index = selectedIndex(frames, frameTime, nowTime);
  const selected = frames.at(index);
  const pinchZoom = (ratio: number) => {
    const at = Math.min(CELLS.length - 1, Math.max(0, CELLS.indexOf(cell) - Math.round(Math.log2(ratio))));
    const next = CELLS.at(at);
    if (next === undefined || next === cell) { return false; }
    setCell(next);
    return true;
  };
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
  const readout = <Readout frame={selected} nowTime={nowTime} timeZone={timeZone} />;
  const mapBox = (
    <Box ref={viewportRef}>
      <RadarMap land={map} frame={selected?.frame} height={side ? LANDSCAPE_MAP_H : height} visibleCols={VISIBLE_COLS} visibleRows={VISIBLE_ROWS}
        baseScale={shownCell / cell} onPinchZoom={pinchZoom} />
      {selected?.kind === 'model' && <Text fz={11} c="dimmed" mt={4}>{t('radar.modelNote')}</Text>}
      <Group justify="space-between" wrap="nowrap" mt={4} fz={10} c="dimmed">
        <Text span inherit style={{ flex: 'none' }}>{t('radar.area', { km: Math.round((VISIBLE_COLS * cell) / 1000) })}</Text>
        <Text span inherit ta="right">{t('radar.credit')}</Text>
      </Group>
    </Box>
  );
  const controls = (
    <RadarControls frames={frames} index={index} cols={map.cols} rows={map.rows} cell={cell} visible={inViewport}
      stale={query.status === 'error' && !offline} onRetry={reload} />
  );
  if (side) {
    return <SimpleGrid cols={2} spacing={16}><Box>{mapBox}</Box><Box>{readout}{controls}</Box></SimpleGrid>;
  }
  return <>{readout}<Box mt={8}>{mapBox}</Box>{controls}</>;
}

export function RadarPanel({ cityId, timeZone, forecast, height }: RadarPanelProps): ReactElement {
  const server = useRadarServer();
  const navigate = useNavigate();
  if (server.trim() === '') {
    return <Notice text={t('radar.noServer')} action={t('radar.openSettings')} onAction={() => { void navigate(paths.settings); }} />;
  }
  return <RadarContent cityId={cityId} timeZone={timeZone} forecast={forecast} height={height} />;
}
