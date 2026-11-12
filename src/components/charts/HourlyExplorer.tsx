import { BarChart, CompositeChart, LineChart } from '@mantine/charts';
import { Box } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../../store';
import { useSeriesToggle } from './SeriesToggle';
import type { HourlyVar } from '../../api/variables';
import { convTemp, convWind, hourOf, weekday, windUnitLabel } from '../../lib/format';

type Series = Partial<Record<HourlyVar, (number | null)[]>>;

// Visual defaults (grid, ticks, legend, tooltip) come from theme.ts.
const BASE = { h: 180, dataKey: 'label' };
const LINE = BASE;

const TEMP = [{ name: 'Air', color: 'signal.4' }, { name: 'Feels like', color: 'dark.2', strokeDasharray: '4 3' }, { name: 'Dew point', color: 'dark.4' }];
const RAIN = [{ name: 'mm', type: 'bar' as const, color: 'signal.7' }, { name: 'Chance %', type: 'line' as const, color: 'signal.4', yAxisId: 'right' }];
const WIND = [{ name: 'Wind', color: 'signal.4' }, { name: 'Gusts', color: 'signal.7', strokeDasharray: '4 3' }];
const CLOUDS = [{ name: 'Total', color: 'signal.4' }, { name: 'Low', color: 'signal.7' }, { name: 'High', color: 'dark.4' }];

const METRICS: { value: string; label: string; needs: HourlyVar | 'aqi' }[] = [
  { value: 'temp', label: 'Temp', needs: 'temperature_2m' },
  { value: 'rain', label: 'Rain', needs: 'precipitation' },
  { value: 'wind', label: 'Wind', needs: 'wind_speed_10m' },
  { value: 'uv', label: 'UV', needs: 'uv_index' },
  { value: 'clouds', label: 'Clouds', needs: 'cloud_cover' },
  { value: 'pressure', label: 'Pressure', needs: 'pressure_msl' },
  { value: 'humidity', label: 'Humidity', needs: 'relative_humidity_2m' },
  { value: 'air', label: 'Air', needs: 'aqi' },
];

// One chart, switchable metric. Used on the city page (next 48 h) and the day view (24 h).
export function HourlyExplorer({ time, v, aqi, from = 0, to }: {
  time: string[]; v: Series; aqi?: Record<string, number | null>; from?: number; to?: number;
}) {
  const s = useWeatherStore(useShallow((st) => ({
    metric: st.chartMetric, setMetric: st.setChartMetric, tempUnit: st.settings.tempUnit, windUnit: st.settings.windUnit,
  })));
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
      when: `${weekday(t.slice(0, 10))} ${hourOf(t)}:00`,
      label: hourOf(t) === '00' && i !== from ? weekday(t.slice(0, 10)) : hourOf(t),
      Air: convTemp(at('temperature_2m', i), s.tempUnit),
      'Feels like': convTemp(at('apparent_temperature', i), s.tempUnit),
      'Dew point': convTemp(at('dew_point_2m', i), s.tempUnit),
      mm: at('precipitation', i),
      'Chance %': at('precipitation_probability', i),
      Wind: convWind(at('wind_speed_10m', i), s.windUnit),
      Gusts: convWind(at('wind_gusts_10m', i), s.windUnit),
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
            data-active={value === active || undefined} onClick={() => s.setMetric(value)}>{label}</button>
        ))}
      </div>
      {active === 'temp' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="°"
          yAxisProps={{ width: 36, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }}
          withLegend={false} series={tg.visible(TEMP)} data={data} />
      )}
      {active === 'temp' && tg.legend(TEMP)}
      {active === 'rain' && (hasChance ? (
        <CompositeChart {...LINE} xAxisProps={xAxisProps} withRightYAxis rightYAxisProps={{ domain: [0, 100], width: 36 }}
          withLegend={false} series={tg.visible(RAIN)} data={data} />
      ) : (
        <BarChart {...BASE} xAxisProps={xAxisProps} series={[{ name: 'mm', color: 'signal.5' }]} data={data} />
      ))}
      {active === 'wind' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit={` ${windUnitLabel(s.windUnit)}`} yAxisProps={{ width: 44 }}
          withLegend={false} series={tg.visible(WIND)} data={data} />
      )}
      {active === 'wind' && tg.legend(WIND)}
      {active === 'uv' && (
        <BarChart {...BASE} xAxisProps={xAxisProps}
          getBarColor={(val) => (val >= 8 ? 'signal.5' : val >= 6 ? 'signal.4' : val >= 3 ? 'signal.7' : 'dark.4')}
          series={[{ name: 'UV', color: 'signal.4' }]} data={data} />
      )}
      {active === 'clouds' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }}
          withLegend={false} series={tg.visible(CLOUDS)} data={data} />
      )}
      {active === 'clouds' && tg.legend(CLOUDS)}
      {active === 'rain' && hasChance && tg.legend(RAIN)}
      {active === 'pressure' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} withLegend={false} yAxisProps={{ width: 44, domain: [(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)], allowDecimals: false }}
          series={[{ name: 'hPa', color: 'signal.4' }]} data={data} />
      )}
      {active === 'humidity' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} unit="%" yAxisProps={{ width: 36, domain: [0, 100] }} withLegend={false}
          series={[{ name: 'Humidity', color: 'signal.4' }]} data={data} />
      )}
      {active === 'air' && (
        <LineChart {...LINE} xAxisProps={xAxisProps} withLegend={false}
          referenceLines={[{ y: 20, label: 'Good', color: 'dark.4' }, { y: 40, label: 'Fair', color: 'dark.4' }, { y: 60, label: 'Moderate', color: 'signal.5' }]}
          series={[{ name: 'AQI', color: 'signal.4' }]} data={data} />
      )}
    </Box>
  );
}
