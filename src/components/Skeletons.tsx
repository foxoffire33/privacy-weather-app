import type { CSSProperties } from 'react';
import { Box, Group, Paper, Skeleton } from '@mantine/core';
import { Section } from './city/parts';
import { t } from '../i18n';

export function Sk({ w = '100%', h = 14, mt = 0, style }: { w?: number | string; h?: number; mt?: number; style?: CSSProperties }) {
  return <Skeleton width={w} height={h} mt={mt} style={style} />;
}

export function StatSk() {
  return (
    <Box py={10} className="row">
      <Sk w={64} h={10} mt={3} />
      <Sk w={72} h={22} mt={6} />
      <Sk w={96} h={12} mt={6} />
    </Box>
  );
}

export function StatGridSk({ n = 4 }: { n?: number }) {
  return <Box className="stat-grid">{Array.from({ length: n }, (_, i) => <StatSk key={i} />)}</Box>;
}

export function SectionSk({ title, n = 4 }: { title: string; n?: number }) {
  return <Section title={title}><StatGridSk n={n} /></Section>;
}

export function RowsSk({ n, h = 40 }: { n: number; h?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Group key={i} className="row" h={h} justify="space-between" wrap="nowrap">
          <Sk w="40%" h={14} />
          <Sk w={40} h={18} />
        </Group>
      ))}
    </>
  );
}

export function ChartSk({ h = 180 }: { h?: number }) {
  return (
    <Box pt={12}>
      <Sk w={260} h={26} />
      <Sk h={h} mt={10} />
    </Box>
  );
}

export function CityBodySk() {
  return (
    <>
      <Paper className="glass" mx={12} mt={-36} pos="relative">
        <Box px={12} pt={12} pb={10} className="border-bottom-soft">
          <Sk w="70%" h={18} />
          <Sk h={36} mt={8} />
          <Sk h={10} mt={6} />
        </Box>
        <Box className="hourly-strip">
          {Array.from({ length: 7 }, (_, i) => (
            <Box key={i}><Sk w={26} h={11} /><Sk w={30} h={18} mt={6} /><Sk w={22} h={10} mt={6} /><Sk w={16} h={10} mt={4} /></Box>
          ))}
        </Box>
        <Box px={12} py={10} className="border-bottom-rule"><Sk w={160} h={16} /></Box>
        <Box px={12}><RowsSk n={7} h={39} /></Box>
      </Paper>
      <Section title={t('city.next48')}><ChartSk /></Section>
      <Section title={t('city.next7')}><ChartSk h={200} /></Section>
      <SectionSk title={t('city.feels.title')} />
      <SectionSk title={t('city.sun.title')} />
    </>
  );
}
