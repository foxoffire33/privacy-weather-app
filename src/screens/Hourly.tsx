import { Box, Group, Text, Title } from '@mantine/core';
import { useShallow } from 'zustand/react/shallow';
import { useWeatherStore } from '../store';
import { conditionLabel } from '../lib/weatherCodes';
import { compass, fmtTemp, fmtWind, hhmm, longDate } from '../lib/format';
import { nowIndex } from '../lib/insights';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sk } from '../components/Skeletons';

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <Box py={8} pr={8}>
      <Text fz={12} tt="uppercase" c="dimmed" style={{ letterSpacing: '.06em' }}>{k}</Text>
      <Text fz={16} fw={800}>{v}</Text>
    </Box>
  );
}

function HourBlockSk() {
  return (
    <Box mt={10} p={14} style={{ border: '2px solid var(--rule)' }}>
      <Group justify="space-between" align="flex-start"><Box><Sk w={56} h={20} /><Sk w={120} h={14} mt={8} /></Box><Sk w={72} h={44} /></Group>
      <Sk h={96} mt={14} />
    </Box>
  );
}

// Every remaining hour of the 7-day forecast as a readable block, grouped by day.
export function Hourly({ cityId }: { cityId: string }) {
  const s = useWeatherStore(useShallow((st) => ({
    city: st.cities.find((c) => c.id === cityId),
    entry: st.forecasts[cityId],
    tempUnit: st.settings.tempUnit,
    windUnit: st.settings.windUnit,
  })));
  if (!s.city) return <div className="screen"><ScreenHeader /><Text px={20}>This city is no longer followed.</Text></div>;

  const header = (
    <>
      <ScreenHeader />
      <Text px={20} fz={13} c="dimmed">{s.city.name}</Text>
      <Title className="display display-sm">Hour<br />by hour.</Title>
    </>
  );
  if (!s.entry) {
    return <div className="screen">{header}<Box px={12} pb={24}><Sk w={180} h={12} mt={20} />{[0, 1, 2].map((i) => <HourBlockSk key={i} />)}</Box></div>;
  }

  const { data } = s.entry;
  const v = data.hourly.v;
  const h0 = nowIndex(data);
  const T = (c?: number | null) => fmtTemp(c, s.tempUnit);
  const W = (k?: number | null) => fmtWind(k, s.windUnit);
  const groups: { date: string; rows: number[] }[] = [];
  for (let i = h0; i < data.hourly.time.length; i++) {
    const date = data.hourly.time[i].slice(0, 10);
    if (!groups.length || groups[groups.length - 1].date !== date) groups.push({ date, rows: [] });
    groups[groups.length - 1].rows.push(i);
  }

  return (
    <div className="screen">
      {header}
      <Box px={12} pb={24}>
        {groups.map((g) => (
          <Box key={g.date}>
            <Box px={8}><div className="kicker">{longDate(g.date)}</div></Box>
            {g.rows.map((i) => {
              const mm = v.precipitation[i] ?? 0;
              const isNow = i === h0;
              return (
                <Box key={i} mt={10} p={14}
                  style={{ border: `${isNow ? 2 : 1}px solid ${isNow ? "#fff" : "var(--rule-soft)"}`, background: v.is_day[i] ? '#000' : '#0b0b0b' }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                      <Text fz={20} fw={800}>{isNow ? 'Now' : hhmm(data.hourly.time[i])}</Text>
                      <Text fz={14} fw={600} truncate>{conditionLabel(v.weather_code[i])}{v.is_day[i] ? '' : ' · night'}</Text>
                    </Box>
                    <Text fz={48} fw={800} lh={0.9} style={{ letterSpacing: '-.04em' }}>{T(v.temperature_2m[i])}°</Text>
                  </Group>
                  <Box mt={10} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--rule-soft)' }}>
                    <Cell k="Feels like" v={`${T(v.apparent_temperature[i])}°`} />
                    <Cell k="Rain chance" v={`${v.precipitation_probability[i] ?? 0}%`} />
                    <Cell k="Rain" v={`${mm.toFixed(1)} mm`} />
                    <Cell k={`Wind ${compass(v.wind_direction_10m[i] ?? 0)}`} v={W(v.wind_speed_10m[i])} />
                    <Cell k="Gusts" v={W(v.wind_gusts_10m[i])} />
                    <Cell k="UV" v={v.uv_index[i] == null ? '–' : String(Math.round(v.uv_index[i]!))} />
                    <Cell k="Clouds" v={`${v.cloud_cover[i] ?? '–'}%`} />
                    <Cell k="Humidity" v={`${v.relative_humidity_2m[i] ?? '–'}%`} />
                    <Cell k="Visibility" v={v.visibility[i] == null ? '–' : `${Math.round(v.visibility[i]! / 1000)} km`} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
        <Text fz={12} c="dimmed" pt={16} px={8}>Weather data by Open-Meteo.com</Text>
      </Box>
    </div>
  );
}
