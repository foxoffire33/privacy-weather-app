import { CompositeChart } from '@mantine/charts';
import { Box } from '@mantine/core';
import { useTimeout } from '@mantine/hooks';
import { useEffect, useState } from 'react';

import { t } from '../../i18n';
import { convTemp, weekday } from '../../lib/format';
import { nowIndex } from '../../lib/insights';
import { ExpandButton, FullscreenChart, INLINE_HEIGHT } from '../charts/FullscreenChart';
import { HourlyExplorer } from '../charts/HourlyExplorer';
import { useSeriesToggle } from '../charts/SeriesToggle';
import { ChartSk } from '../Skeletons';

import { Section } from './Parts';

import type { ChartHeight, CityDataProps, DeferredProps } from '../../types';
import type { ReactElement } from 'react';

const weekSeries = () => [
  { name: 'mm', label: t('chart.mm'), type: 'bar' as const, color: 'signal.7', yAxisId: 'right' },
  { name: 'High', label: t('city.high'), type: 'line' as const, color: 'signal.4' },
  { name: 'Low', label: t('city.low'), type: 'line' as const, color: 'signal.2' },
];

function Deferred({ h, children }: DeferredProps): ReactElement {
  const [ready, setReady] = useState(false);
  const { start, clear } = useTimeout(() => { setReady(true); }, 250);
  useEffect(() => { start(); return clear; }, [start, clear]);
  return ready ? <>{children}</> : <ChartSk h={h} />;
}

export function Next48Section({ city, entry }: CityDataProps): ReactElement {
  const { data, air } = entry;
  const h0 = nowIndex(data);
  const airByTime = air ? Object.fromEntries(air.hourly.time.map((tm, i) => [tm, air.hourly.aqi[i]])) : undefined;
  const chart = (height: ChartHeight) => (
    <HourlyExplorer time={data.hourly.time} v={data.hourly.v} from={h0} to={h0 + 48} aqi={airByTime} height={height} />
  );
  return (
    <Section title={t('city.next48')} action={<ExpandButton id={`next48:${city.id}`} />}>
      <Box pt={12}><Deferred h={270}>{chart(INLINE_HEIGHT)}</Deferred></Box>
      <FullscreenChart id={`next48:${city.id}`} title={t('city.next48')} render={chart} />
    </Section>
  );
}

export function Next7Section({ city, entry, units }: CityDataProps): ReactElement {
  const weekTg = useSeriesToggle('week');
  const d = entry.pastDays;
  const dv = entry.data.daily.v;
  const rows = entry.data.daily.time.slice(d, d + 7).map((date, k) => ({
    label: k === 0 ? t('common.today') : weekday(date),
    High: convTemp(dv.temperature_2m_max[d + k], units.temp),
    Low: convTemp(dv.temperature_2m_min[d + k], units.temp),
    mm: dv.precipitation_sum[d + k],
  }));
  const chart = (height: ChartHeight) => (
    <>
      <CompositeChart h={height} dataKey="label"
        yAxisProps={{ width: 36, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }} withRightYAxis rightYAxisProps={{ width: 32 }}
        data={rows} withLegend={false} series={weekTg.visible(weekSeries())} />
      {weekTg.legend(weekSeries())}
    </>
  );
  return (
    <Section title={t('city.next7')} action={<ExpandButton id={`next7:${city.id}`} />}>
      <Box pt={12}><Deferred h={230}>{chart(200)}</Deferred></Box>
      <FullscreenChart id={`next7:${city.id}`} title={t('city.next7')} render={chart} />
    </Section>
  );
}
