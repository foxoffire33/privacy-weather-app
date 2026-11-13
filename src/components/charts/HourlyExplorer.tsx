import { BarChart, CompositeChart, LineChart } from '@mantine/charts';
import { Box, UnstyledButton } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';

import { t } from '../../i18n';
import { convTemp, convWind, hourOf, weekday, windUnitLabel } from '../../lib/format';
import { below } from '../../lib/scale';
import { useUnits } from '../../stores';
import { useUiStore } from '../../stores/uiStore';

import { INLINE_HEIGHT } from './FullscreenChart';
import { useSeriesToggle } from './SeriesToggle';

import type { HourlyVar } from '../../stores/api/variables';
import type { HourlyExplorerProps, HourlyMetric, HourlyRow, HourlyRowInput, Labelled, MetricChartProps } from '../../types';
import type { ReactElement } from 'react';

const BASE = { h: 180, dataKey: 'label' };

const TEMP = [{ name: 'Air', label: 'chart.airTemp', color: 'signal.4' }, { name: 'Feels like', label: 'chart.feelsLike', color: 'dark.2' }, { name: 'Dew point', label: 'chart.dewPoint', color: 'dark.4' }] as const;
const RAIN = [{ name: 'mm', label: 'chart.mm', type: 'bar' as const, color: 'signal.7' }, { name: 'Chance %', label: 'chart.chance', type: 'line' as const, color: 'signal.4', yAxisId: 'right' }] as const;
const WIND = [{ name: 'Wind', label: 'chart.wind', color: 'signal.4' }, { name: 'Gusts', label: 'chart.gusts', color: 'signal.7' }] as const;
const CLOUDS = [{ name: 'Total', label: 'chart.total', color: 'signal.4' }, { name: 'Low', label: 'chart.low', color: 'signal.7' }, { name: 'High', label: 'chart.high', color: 'dark.4' }] as const;
const tr = <S extends Labelled>(series: readonly S[]) => series.map((x) => ({ ...x, label: t(x.label) }));

const METRICS: HourlyMetric[] = [
  { value: 'temp', label: 'chart.temp', needs: 'temperature_2m' },
  { value: 'rain', label: 'chart.rain', needs: 'precipitation' },
  { value: 'wind', label: 'chart.wind', needs: 'wind_speed_10m' },
  { value: 'uv', label: 'chart.uv', needs: 'uv_index' },
  { value: 'clouds', label: 'chart.clouds', needs: 'cloud_cover' },
  { value: 'pressure', label: 'chart.pressure', needs: 'pressure_msl' },
  { value: 'humidity', label: 'chart.humidity', needs: 'relative_humidity_2m' },
  { value: 'air', label: 'chart.air', needs: 'aqi' },
];

function hourlyRows({ time, v, aqi, from, end, tempUnit, windUnit }: HourlyRowInput): HourlyRow[] {
  const at = (k: HourlyVar, i: number) => v[k]?.[i] ?? null;
  const rows: HourlyRow[] = [];
  for (let i = from; i < end; i++) {
    const stamp = time[i];
    const day = weekday(stamp.slice(0, 10));
    const hour = hourOf(stamp);
    rows.push({
      when: t('chart.hourLabel', { day, hour }),
      label: hour === '00' && i !== from ? day : hour,
      Air: convTemp(at('temperature_2m', i), tempUnit),
      'Feels like': convTemp(at('apparent_temperature', i), tempUnit),
      'Dew point': convTemp(at('dew_point_2m', i), tempUnit),
      mm: at('precipitation', i),
      'Chance %': at('precipitation_probability', i),
      Wind: convWind(at('wind_speed_10m', i), windUnit),
      Gusts: convWind(at('wind_gusts_10m', i), windUnit),
      UV: at('uv_index', i),
      Total: at('cloud_cover', i),
      Low: at('cloud_cover_low', i),
      High: at('cloud_cover_high', i),
      hPa: at('pressure_msl', i),
      Humidity: at('relative_humidity_2m', i),
      AQI: aqi?.[stamp] ?? null,
    });
  }
  return rows;
}

const PAD_DOMAIN: [(m: number) => number, (m: number) => number] = [(m) => Math.floor(m - 2), (m) => Math.ceil(m + 2)];

function MetricChart({ metric, data, height, windUnit, hasChance, toggle }: MetricChartProps): ReactElement | null {
  const common = { ...BASE, h: height, data, xAxisProps: { interval: Math.max(0, Math.ceil(data.length / 8) - 1) } };
  switch (metric) {
    case 'temp': {
      return (
        <>
          <LineChart {...common} unit="°" yAxisProps={{ width: 36, domain: PAD_DOMAIN, allowDecimals: false }}
            withLegend={false} series={toggle.visible(tr(TEMP))} />
          {toggle.legend(tr(TEMP))}
        </>
      );
    }
    case 'rain': {
      if (!hasChance) {
        return <BarChart {...common} series={[{ name: 'mm', label: t('chart.mm'), color: 'signal.5' }]} />;
      }
      return (
        <>
          <CompositeChart {...common} withRightYAxis rightYAxisProps={{ domain: [0, 100], width: 36 }}
            withLegend={false} series={toggle.visible(tr(RAIN))} />
          {toggle.legend(tr(RAIN))}
        </>
      );
    }
    case 'wind': {
      return (
        <>
          <LineChart {...common} unit={` ${windUnitLabel(windUnit)}`} yAxisProps={{ width: 44 }}
            withLegend={false} series={toggle.visible(tr(WIND))} />
          {toggle.legend(tr(WIND))}
        </>
      );
    }
    case 'uv': {
      return (
        <BarChart {...common} getBarColor={(val) => below(val, [[3, 'dark.4'], [6, 'signal.7'], [8, 'signal.4']], 'signal.5')}
          series={[{ name: 'UV', label: t('chart.uv'), color: 'signal.4' }]} />
      );
    }
    case 'clouds': {
      return (
        <>
          <LineChart {...common} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }}
            withLegend={false} series={toggle.visible(tr(CLOUDS))} />
          {toggle.legend(tr(CLOUDS))}
        </>
      );
    }
    case 'pressure': {
      return (
        <LineChart {...common} withLegend={false} yAxisProps={{ width: 44, domain: PAD_DOMAIN, allowDecimals: false }}
          series={[{ name: 'hPa', color: 'signal.4' }]} />
      );
    }
    case 'humidity': {
      return (
        <LineChart {...common} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }} withLegend={false}
          series={[{ name: 'Humidity', label: t('chart.humidity'), color: 'signal.4' }]} />
      );
    }
    case 'air': {
      return (
        <LineChart {...common} withLegend={false}
          referenceLines={[{ y: 20, label: t('chart.good'), color: 'dark.4' }, { y: 40, label: t('chart.fair'), color: 'dark.4' }, { y: 60, label: t('chart.moderate'), color: 'signal.5' }]}
          series={[{ name: 'AQI', color: 'signal.4' }]} />
      );
    }
    case undefined: {
      return null;
    }
    default: {
      return null;
    }
  }
}

export function HourlyExplorer({ time, v, aqi, from = 0, to, height = INLINE_HEIGHT }: HourlyExplorerProps): ReactElement {
  const units = useUnits();
  const s = useUiStore(useShallow((st) => ({ metric: st.chartMetric, setMetric: st.setChartMetric })));
  const end = Math.min(to ?? time.length, time.length);
  const has = (k: HourlyVar | 'aqi') => (k === 'aqi'
    ? Object.values(aqi ?? {}).some((x) => x !== null)
    : (v[k] ?? []).slice(from, end).some((x) => x !== null));
  const available = METRICS.filter((m) => has(m.needs));
  const active = available.find((m) => m.value === s.metric)?.value ?? available.at(0)?.value;
  const data = hourlyRows({ time, v, aqi, from, end, tempUnit: units.temp, windUnit: units.wind });
  const toggle = useSeriesToggle(active ?? s.metric);
  return (
    <Box>
      <Box className="metric-tabs" role="tablist">
        {available.map(({ value, label }) => (
          <UnstyledButton key={value} type="button" role="tab" aria-selected={value === active}
            data-active={value === active || undefined} onClick={() => { s.setMetric(value); }}>{t(label)}</UnstyledButton>
        ))}
      </Box>
      <MetricChart metric={active} data={data} height={height} windUnit={units.wind} hasChance={has('precipitation_probability')} toggle={toggle} />
    </Box>
  );
}
