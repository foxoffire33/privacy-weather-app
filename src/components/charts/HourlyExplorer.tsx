import { BarChart, CompositeChart, LineChart } from '@mantine/charts';
import { Box } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useUnits } from '../../storesV2';
import { useUiStore } from '../../store/uiStore';
import { useSeriesToggle } from './SeriesToggle';
import type { HourlyVar } from '../../storesV2/api/variables';
import { convTemp, convWind, hourOf, weekday, windUnitLabel } from '../../lib/format';
import { t, t as tt, type MessageKey } from '../../i18n';

type Series = Partial<Record<HourlyVar, (number | null)[]>>;

const BASE = { h: 180, dataKey: 'label' };
const LINE = BASE;

const TEMP = [{ name: 'Air', label: 'chart.airTemp', color: 'signal.4' }, { name: 'Feels like', label: 'chart.feelsLike', color: 'dark.2' }, { name: 'Dew point', label: 'chart.dewPoint', color: 'dark.4' }] as const;
const RAIN = [{ name: 'mm', label: 'chart.mm', type: 'bar' as const, color: 'signal.7' }, { name: 'Chance %', label: 'chart.chance', type: 'line' as const, color: 'signal.4', yAxisId: 'right' }] as const;
const WIND = [{ name: 'Wind', label: 'chart.wind', color: 'signal.4' }, { name: 'Gusts', label: 'chart.gusts', color: 'signal.7' }] as const;
const CLOUDS = [{ name: 'Total', label: 'chart.total', color: 'signal.4' }, { name: 'Low', label: 'chart.low', color: 'signal.7' }, { name: 'High', label: 'chart.high', color: 'dark.4' }] as const;
const tr = <S extends { label: MessageKey }>(series: readonly S[]) => series.map((x) => ({ ...x, label: t(x.label) }));

const METRICS: { value: string; label: MessageKey; needs: HourlyVar | 'aqi' }[] = [
  { value: 'temp', label: 'chart.temp', needs: 'temperature_2m' },
  { value: 'rain', label: 'chart.rain', needs: 'precipitation' },
  { value: 'wind', label: 'chart.wind', needs: 'wind_speed_10m' },
  { value: 'uv', label: 'chart.uv', needs: 'uv_index' },
  { value: 'clouds', label: 'chart.clouds', needs: 'cloud_cover' },
  { value: 'pressure', label: 'chart.pressure', needs: 'pressure_msl' },
  { value: 'humidity', label: 'chart.humidity', needs: 'relative_humidity_2m' },
  { value: 'air', label: 'chart.air', needs: 'aqi' },
];

export function HourlyExplorer({ time, v, aqi, from = 0, to }: {
  time: string[]; v: Series; aqi?: Record<string, number | null>; from?: number; to?: number;
}) {
  const units = useUnits();
  const s = useUiStore(useShallow((st) => ({ metric: st.chartMetric, setMetric: st.setChartMetric })));
  const end = Math.min(to ?? time.length, time.length);
  const has = (k: HourlyVar | 'aqi') => (k === 'aqi'
    ? Object.values(aqi ?? {}).some((x) => x != null)
    : (v[k] ?? []).slice(from, end).some((x) => x != null));
  const available = METRICS.filter((m) => has(m.needs));
  const active = available.find((m) => m.value === s.metric)?.value ?? available[0]?.value;
  const at = (k: HourlyVar, i: number) => v[k]?.[i] ?? null;
  const data = [];
  for (let i = from; i < end; i++) {
    const t = time[i];
    data.push({
      when: tt('chart.hourLabel', { day: weekday(t.slice(0, 10)), hour: hourOf(t) }),
      label: hourOf(t) === '00' && i !== from ? weekday(t.slice(0, 10)) : hourOf(t),
      Air: convTemp(at('temperature_2m', i), units.temp),
      'Feels like': convTemp(at('apparent_temperature', i), units.temp),
      'Dew point': convTemp(at('dew_point_2m', i), units.temp),
      mm: at('precipitation', i),
      'Chance %': at('precipitation_probability', i),
      Wind: convWind(at('wind_speed_10m', i), units.wind),
      Gusts: convWind(at('wind_gusts_10m', i), units.wind),
      UV: at('uv_index', i),
      Total: at('cloud_cover', i),
      Low: at('cloud_cover_low', i),
      High: at('cloud_cover_high', i),
      hPa: at('pressure_msl', i),
      Humidity: at('relative_humidity_2m', i),
      AQI: aqi?.[t] ?? null,
    });
  }
  const tg = useSeriesToggle(String(active));
  const xAxisProps = { interval: Math.max(0, Math.ceil(data.length / 8) - 1) };
  const hasChance = has('precipitation_probability');
  return (
    <Box>
      <div className="metric-tabs" role="tablist">
        {available.map(({ value, label }) => (
          <button key={value} type="button" role="tab" aria-selected={value === active}
            data-active={value === active || undefined} onClick={() => s.setMetric(value)}>{t(label)}</button>
        ))}
      </div>
      {active === 'temp' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="°"
          yAxisProps={{ width: 36, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }}
          withLegend={false} series={tg.visible(tr(TEMP))} data={data} />
      )}
      {active === 'temp' && tg.legend(tr(TEMP))}
      {active === 'rain' && (hasChance ? (
        <CompositeChart {...LINE} xAxisProps={xAxisProps} withRightYAxis rightYAxisProps={{ domain: [0, 100], width: 36 }}
          withLegend={false} series={tg.visible(tr(RAIN))} data={data} />
      ) : (
        <BarChart {...BASE} xAxisProps={xAxisProps} series={[{ name: 'mm', label: t('chart.mm'), color: 'signal.5' }]} data={data} />
      ))}
      {active === 'wind' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit={` ${windUnitLabel(units.wind)}`} yAxisProps={{ width: 44 }}
          withLegend={false} series={tg.visible(tr(WIND))} data={data} />
      )}
      {active === 'wind' && tg.legend(tr(WIND))}
      {active === 'uv' && (
        <BarChart {...BASE} xAxisProps={xAxisProps}
          getBarColor={(val) => (val >= 8 ? 'signal.5' : val >= 6 ? 'signal.4' : val >= 3 ? 'signal.7' : 'dark.4')}
          series={[{ name: 'UV', label: t('chart.uv'), color: 'signal.4' }]} data={data} />
      )}
      {active === 'clouds' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }}
          withLegend={false} series={tg.visible(tr(CLOUDS))} data={data} />
      )}
      {active === 'clouds' && tg.legend(tr(CLOUDS))}
      {active === 'rain' && hasChance && tg.legend(tr(RAIN))}
      {active === 'pressure' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} withLegend={false} yAxisProps={{ width: 44, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }}
          series={[{ name: 'hPa', color: 'signal.4' }]} data={data} />
      )}
      {active === 'humidity' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }} withLegend={false}
          series={[{ name: 'Humidity', label: t('chart.humidity'), color: 'signal.4' }]} data={data} />
      )}
      {active === 'air' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} withLegend={false}
          referenceLines={[{ y: 20, label: t('chart.good'), color: 'dark.4' }, { y: 40, label: t('chart.fair'), color: 'dark.4' }, { y: 60, label: t('chart.moderate'), color: 'signal.5' }]}
          series={[{ name: 'AQI', color: 'signal.4' }]} data={data} />
      )}
    </Box>
  );
}
