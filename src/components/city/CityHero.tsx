import { Badge, Box, Group, Text } from '@mantine/core';

import { t } from '../../i18n';
import { useNormals } from '../../stores';
import { fmtDelta, fmtTemp } from '../../utils/format';
import { conditionLabel } from '../../utils/weatherCodes';

import type { CityHeroProps, CityPageProps } from '../../types';
import type { ReactElement } from 'react';

export function CityTitle({ city, isDefault }: CityPageProps): ReactElement {
  return (
    <Group gap={8}>
      <Text fz={15} fw={800}>{city.name}</Text>
      {isDefault && <Badge variant="white" color="dark" size="sm">{t('common.default')}</Badge>}
    </Group>
  );
}

export function CityHero({ city, isDefault, entry, units }: CityHeroProps): ReactElement {
  const normals = useNormals(city.id);
  const { data, pastDays: d } = entry;
  const c = data.current.v;
  const dv = data.daily.v;
  const T = (v?: number | null) => fmtTemp(v, units.temp);
  const normal = normals?.[data.daily.time[d].slice(5)];
  const hiToday = dv.temperature_2m_max.at(d) ?? null;
  const delta = normal !== undefined && hiToday !== null ? hiToday - normal : null;
  return (
    <Box className="hero">
      <CityTitle city={city} isDefault={isDefault} />
      <Box className="hero-temp">{T(c.temperature_2m)}°</Box>
      <Text fz={20} fw={800} mt={8}>{t('city.precipChance', { cond: conditionLabel(c.weather_code), p: dv.precipitation_probability_max[d] ?? 0 })}</Text>
      <Text fz={13} fw={600}>
        {t('city.heroLine', { feels: T(c.apparent_temperature), hi: T(dv.temperature_2m_max[d]), lo: T(dv.temperature_2m_min[d]) })}
        {delta !== null && ` · ${t('city.vsAverage', { delta: fmtDelta(delta, units.temp) })}`}
      </Text>
    </Box>
  );
}
