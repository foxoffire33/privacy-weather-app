import {
  ActionIcon, Badge, Button, Paper, Skeleton, SegmentedControl, Select, Switch, TextInput, PasswordInput,
  createTheme, type MantineColorsTuple,
} from '@mantine/core';
import { BarChart, CompositeChart, LineChart } from '@mantine/charts';

import { CompactTooltip } from './components/charts/CompactTooltip';
import type { Accent } from './storesV2';

export const ACCENTS: Record<Exclude<Accent, 'custom'>, { label: string; tuple: MantineColorsTuple }> = {
  green: { label: 'Green', tuple: ['#ebfaf0', '#cff2dc', '#a3e5bd', '#6fd399', '#40bf77', '#178a4a', '#127a40', '#0e6334', '#0a4c28', '#063019'] },
  red: { label: 'Red', tuple: ['#fff2ef', '#ffe0d9', '#ffc4b8', '#ff9783', '#ff563c', '#ec3013', '#dd2b0f', '#ae1800', '#7c1405', '#4d170e'] },
  blue: { label: 'Blue', tuple: ['#eef4ff', '#d9e6ff', '#b6ccff', '#86a8ff', '#5a85ff', '#2f62f5', '#2350d6', '#1a3da6', '#132c75', '#0c1c4a'] },
  off: { label: 'Off', tuple: ['#ffffff', '#f2f2f2', '#e4e1e1', '#cbc7c7', '#a3a0a0', '#ffffff', '#e4e1e1', '#cbc7c7', '#a3a0a0', '#6e6b6b'] },
};

const dark: MantineColorsTuple = [
  '#ffffff', '#ece9e9', '#d8d4d4', '#b4b0b0', '#7d7979',
  '#3a3737', '#1c1b1b', '#000000', '#000000', '#000000',
];

const font = 'Archivo, system-ui, sans-serif';

const chartStyles = {
  legend: { paddingTop: 6 },
  legendItem: { paddingInline: '0 12px', gap: 6 },
  legendItemColor: { borderRadius: 0, width: 12, height: 3, minWidth: 12, minHeight: 3, boxShadow: 'none' },
  legendItemName: { fontSize: 12, color: 'var(--mantine-color-dark-2)' },
  tooltip: { borderRadius: 0, border: '2px solid var(--rule)', background: '#000', boxShadow: '0 6px 18px rgba(0,0,0,.6)', padding: '3px 6px', fontSize: 10 },
  tooltipLabel: { fontSize: 10, marginBottom: 1, fontWeight: 800 },
  tooltipBody: { padding: 0 },
  tooltipItem: { fontSize: 10, lineHeight: 1.2, gap: 6 },
  tooltipItemColor: { width: 6, height: 6, borderRadius: 0 },
  tooltipItemName: { fontSize: 10, marginRight: 8 },
  tooltipItemData: { fontSize: 10, fontWeight: 800 },
};

const cursorBand = { stroke: 'var(--selected-bg)', strokeWidth: 26, strokeDasharray: '0' };
const chartBase = {
  'data-noswipe': true,
  className: 'chart-surface',
  gridAxis: 'none' as const,
  strokeDasharray: '0',
  textColor: 'dark.2',
  tickLine: 'none' as const,
  withLegend: true,
  legendProps: { verticalAlign: 'bottom' as const, height: 28 },
  tooltipAnimationDuration: 100,
  tooltipProps: { content: CompactTooltip, cursor: cursorBand, position: { x: 0, y: -26 }, wrapperStyle: { width: '100%', pointerEvents: 'none' as const, visibility: 'visible' as const }, allowEscapeViewBox: { x: false, y: true }, isAnimationActive: false },
  yAxisProps: { width: 34 },
};
const lineBase = { ...chartBase, curveType: 'monotone' as const, withDots: false, strokeWidth: 2.5, activeDotProps: { r: 5, strokeWidth: 2 } };

const mix = (a: [number, number, number], b: [number, number, number], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const toHex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function customTuple(hex: string): MantineColorsTuple {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  let base = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [23, 138, 74];
  while (luminance(base) > 0.5) base = mix(base as [number, number, number], [0, 0, 0], 0.1);
  while (luminance(base) < 0.12) base = mix(base as [number, number, number], [255, 255, 255], 0.1);
  const b = base as [number, number, number];
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  return [0.92, 0.82, 0.65, 0.45, 0.25].map((t) => toHex(mix(b, white, t)))
    .concat(toHex(b), [0.15, 0.3, 0.5, 0.7].map((t) => toHex(mix(b, black, t)))) as unknown as MantineColorsTuple;
}

export const buildTheme = (accent: Accent, accentColor = '#178a4a') => createTheme({
  primaryColor: 'signal',
  primaryShade: 5,
  autoContrast: true,
  colors: { signal: accent === 'custom' ? customTuple(accentColor) : ACCENTS[accent].tuple, dark },
  white: '#ffffff',
  black: '#100f0f',
  fontFamily: font,
  headings: { fontFamily: font, fontWeight: '800' },
  defaultRadius: 0,
  radius: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
  focusRing: 'auto',
  other: {
    rule: 'rgba(248,244,244,.3)',
    ruleSoft: 'rgba(248,244,244,.14)',
    glass: 'rgba(40,38,38,.72)',
  },
  components: {
    Button: Button.extend({ defaultProps: { justify: 'space-between', fw: 800 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 44, variant: 'subtle', color: 'gray' } }),
    Badge: Badge.extend({ defaultProps: { radius: 0, fw: 800 } }),
    Paper: Paper.extend({ defaultProps: { radius: 0 } }),
    Skeleton: Skeleton.extend({ defaultProps: { radius: 0 } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 0 } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { radius: 0 } }),
    Select: Select.extend({ defaultProps: { radius: 0 } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: 0 } }),
    Switch: Switch.extend({ defaultProps: { radius: 0, color: 'signal' } }),
    LineChart: LineChart.extend({ defaultProps: lineBase, styles: chartStyles }),
    BarChart: BarChart.extend({ defaultProps: { ...chartBase, cursorFill: 'var(--selected-bg)', maxBarWidth: 14 }, styles: chartStyles }),
    CompositeChart: CompositeChart.extend({ defaultProps: { ...lineBase, maxBarWidth: 14 }, styles: chartStyles }),
  },
});
