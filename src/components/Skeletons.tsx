import type { CSSProperties } from 'react';
import { Box, Group, Paper } from '@mantine/core';
import { Section } from './city/parts';

// Placeholder block. Width/height match the content it stands in for.
export function Sk({ w = '100%', h = 14, mt = 0, style }: { w?: number | string; h?: number; mt?: number; style?: CSSProperties }) {
  return <div className="sk" style={{ width: w, height: h, marginTop: mt, ...style }} />;
}

// One Stat: kicker 15 + value 30 + sub 18, padding 10.
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
  return <div className="stat-grid">{Array.from({ length: n }, (_, i) => <StatSk key={i} />)}</div>;
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

// Mirrors CityPage below the hero.
export function CityBodySk() {
  return (
    <>
      <Paper className="glass" mx={12} mt={-36} pos="relative">
        <Box px={12} pt={12} pb={10} style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <Sk w="70%" h={18} />
          <Sk h={36} mt={8} />
          <Sk h={10} mt={6} />
        </Box>
        <div className="hourly-strip">
          {Array.from({ length: 7 }, (_, i) => (
            <Box key={i}><Sk w={26} h={11} /><Sk w={30} h={18} mt={6} /><Sk w={22} h={10} mt={6} /><Sk w={16} h={10} mt={4} /></Box>
          ))}
        </div>
        <Box px={12} py={10} style={{ borderBottom: '2px solid rgba(248,244,244,.2)' }}><Sk w={160} h={16} /></Box>
        <Box px={12}><RowsSk n={7} h={39} /></Box>
      </Paper>
      <Section title="Next 48 hours"><ChartSk /></Section>
      <Section title="Next 7 days"><ChartSk h={200} /></Section>
      <SectionSk title="Feels like" />
      <SectionSk title="Sun" />
    </>
  );
}
