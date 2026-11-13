import { ActionIcon, Badge, Box, Button, Group, Text, Title, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sk } from '../components/Skeletons';
import { t, tl } from '../i18n';
import { unfollowCity, useCities, useCityStore, useForecastStore, useLogStore, useUnits } from '../stores';
import { useUiStore } from '../stores/uiStore';
import { fmtTemp } from '../utils/format';
import { conditionLabel } from '../weather/weatherCodes';

import type { ReorderDrag } from '../types';
import type { PointerEvent, ReactElement } from 'react';

const EDGE = 70;

function edgeSpeed(y: number, r: DOMRect): number {
  if (y < r.top + EDGE) { return -(r.top + EDGE - y) / 5; }
  if (y > r.bottom - EDGE) { return (y - (r.bottom - EDGE)) / 5; }
  return 0;
}

export function Cities(): ReactElement {
  const cities = useCities();
  const forecasts = useForecastStore((s) => s.forecasts);
  const logged = useLogStore((s) => s.dates);
  const tempUnit = useUnits().temp;
  const reorderCities = useCityStore((s) => s.reorder);
  const { goHome, navigate } = useUiStore(useShallow((s) => ({ goHome: s.goHome, navigate: s.navigate })));
  const n = cities.length;
  const scroller = useRef<HTMLDivElement>(null);
  const firstRow = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<ReorderDrag | null>(null);
  const g = useRef({ startY: 0, startScroll: 0, pointerY: 0, rowH: 1, from: 0, raf: 0 });
  const update = () => {
    const el = scroller.current;
    if (!el) { return; }
    const dy = g.current.pointerY - g.current.startY + (el.scrollTop - g.current.startScroll);
    const to = Math.max(0, Math.min(n - 1, g.current.from + Math.round(dy / g.current.rowH)));
    setDrag({ from: g.current.from, to, dy, rowH: g.current.rowH });
  };
  const tick = () => {
    const el = scroller.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const y = g.current.pointerY;
      const speed = edgeSpeed(y, r);
      if (speed !== 0) { el.scrollTop += speed; update(); }
    }
    g.current.raf = requestAnimationFrame(tick);
  };
  useEffect(() => () => { cancelAnimationFrame(g.current.raf); }, []);
  const onDown = (e: PointerEvent<HTMLElement>, i: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    g.current = { ...g.current, startY: e.clientY, pointerY: e.clientY, startScroll: scroller.current?.scrollTop ?? 0, rowH: Math.max(1, firstRow.current?.offsetHeight ?? 0), from: i };
    setDrag({ from: i, to: i, dy: 0, rowH: g.current.rowH });
    g.current.raf = requestAnimationFrame(tick);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag) { return; }
    g.current.pointerY = e.clientY;
    update();
  };
  const onUp = () => {
    cancelAnimationFrame(g.current.raf);
    if (drag && drag.from !== drag.to) { reorderCities(drag.from, drag.to); }
    setDrag(null);
  };
  const shift = (i: number) => {
    if (!drag || i === drag.from) { return 0; }
    if (drag.from < drag.to && i > drag.from && i <= drag.to) { return -drag.rowH; }
    if (drag.from > drag.to && i < drag.from && i >= drag.to) { return drag.rowH; }
    return 0;
  };
  return (
    <Box className="screen" style={{ overflow: 'hidden' }}>
      <Box className="cities-scroll" ref={scroller} style={{ overflowY: drag ? 'hidden' : undefined }}>
        <ScreenHeader />
        <Title className="display" style={{ whiteSpace: 'pre-line' }}>{t('cities.title', { count: n, word: tl('cities.count')[n] ?? n })}</Title>
        <Text px={20} pb={16} fz={13} c="dimmed">{t('cities.hint')}</Text>

        <Box className="rule-top">
          {cities.map((c, i) => {
            const f = forecasts[c.id];
            const days = (logged[c.id] ?? []).length;
            const dragging = drag?.from === i;
            return (
              <Box key={c.id} ref={i === 0 ? firstRow : undefined} className="city-row" data-dragging={dragging || undefined}
                style={{
                  transform: `translateY(${String(dragging ? drag.dy : shift(i))}px)`,
                  transition: dragging ? 'none' : 'transform .18s ease',
                }}>
                <Group gap={0} wrap="nowrap" align="stretch">
                  <Box className="drag-handle" role="button" aria-label={t('cities.reorder', { name: c.name })} tabIndex={0}
                    onPointerDown={(e) => { onDown(e, i); }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                    <Icon name="grip" size={20} />
                  </Box>
                  <Group justify="space-between" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }} py={16} pr={8}>
                    <UnstyledButton onClick={() => { goHome(i); }} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={8} wrap="nowrap">
                        <Text fz={22} fw={800} truncate>{c.name}</Text>
                        {i === 0 && <Badge size="sm">{t('common.default')}</Badge>}
                      </Group>
                      {f ? (
                        <Text fz={13} c="dimmed" truncate>
                          {conditionLabel(f.data.current.v.weather_code)} · {t('common.daysLogged', { count: days })}
                        </Text>
                      ) : <Sk w={150} h={13} mt={4} />}
                    </UnstyledButton>
                    {f ? (
                      <Text fz={44} fw={800} lh={0.9} style={{ letterSpacing: '-.04em' }}>
                        {fmtTemp(f.data.current.v.temperature_2m, tempUnit)}°
                      </Text>
                    ) : <Sk w={56} h={40} />}
                    <ActionIcon size={40} aria-label={t('cities.unfollow', { name: c.name })}
                      onClick={() => modals.openConfirmModal({
                        groupProps: { grow: true, wrap: 'nowrap', mt: 16 },
                        children: t('cities.confirmUnfollow', { name: c.name }),
                        labels: { confirm: t('cities.stopFollowing'), cancel: t('common.cancel') },
                        onConfirm: () => { unfollowCity(c.id); },
                      })}>
                      <Icon name="x" size={18} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Button size="xl" fullWidth rightSection={<Icon name="plus" />} onClick={() => { navigate({ name: 'search' }); }}>
        {t('cities.followCity')}
      </Button>
    </Box>
  );
}
