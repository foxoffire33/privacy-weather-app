import {
  ActionIcon, Badge, Button, Paper, SegmentedControl, Select, Switch, TextInput, PasswordInput,
  createTheme, type MantineColorsTuple,
} from '@mantine/core';
import { AreaChart, BarChart, CompositeChart, LineChart } from '@mantine/charts';

import { CompactTooltip } from './components/charts/CompactTooltip';
import type { Accent } from './types';

// Global theme — calm, high contrast: Archivo, white on black, zero radius.
// One accent colour (bright red by default) carries the hero and primary actions. It can be
// changed or switched off in Settings; every 'signal.*' reference follows that choice.
export const ACCENTS: Record<Accent, { label: string; tuple: MantineColorsTuple }> = {
  red: { label: 'Red', tuple: ['#fff2ef', '#ffe0d9', '#ffc4b8', '#ff9783', '#ff563c', '#ec3013', '#dd2b0f', '#ae1800', '#7c1405', '#4d170e'] },
  blue: { label: 'Blue', tuple: ['#eef4ff', '#d9e6ff', '#b6ccff', '#86a8ff', '#5a85ff', '#2f62f5', '#2350d6', '#1a3da6', '#132c75', '#0c1c4a'] },
  green: { label: 'Green', tuple: ['#ebfaf0', '#cff2dc', '#a3e5bd', '#6fd399', '#40bf77', '#178a4a', '#127a40', '#0e6334', '#0a4c28', '#063019'] },
  off: { label: 'Off', tuple: ['#ffffff', '#f2f2f2', '#e4e1e1', '#cbc7c7', '#a3a0a0', '#ffffff', '#e4e1e1', '#cbc7c7', '#a3a0a0', '#6e6b6b'] },
};

// Mantine dark scheme: [0] text, [2] dimmed, [4] borders, [6] inputs/surfaces, [7] body.
const dark: MantineColorsTuple = [
  '#ffffff', '#e4e1e1', '#cbc7c7', '#a3a0a0', '#6e6b6b',
  '#3a3737', '#1c1b1b', '#000000', '#000000', '#000000',
];

const font = 'Archivo, system-ui, sans-serif';

// Charts: quiet by default. Dotted horizontal grid only, small grey ticks, flat legend swatches,
// tooltips as square black panels. Series colours are set per chart from white/grey, red only for emphasis.
const chartStyles = {
  legend: { paddingTop: 6 },
  legendItem: { paddingInline: '0 12px', gap: 6 },
  legendItemColor: { borderRadius: 0, width: 12, height: 3, minWidth: 12, minHeight: 3, boxShadow: 'none' },
  legendItemName: { fontSize: 11, color: 'var(--mantine-color-dark-2)' },
  tooltip: { borderRadius: 0, border: '2px solid var(--rule)', background: '#000', boxShadow: '0 6px 18px rgba(0,0,0,.6)', padding: '3px 6px', fontSize: 10 },
  tooltipLabel: { fontSize: 10, marginBottom: 1, fontWeight: 800 },
  tooltipBody: { padding: 0 },
  tooltipItem: { fontSize: 10, lineHeight: 1.2, gap: 6 },
  tooltipItemColor: { width: 6, height: 6, borderRadius: 0 },
  tooltipItemName: { fontSize: 10, marginRight: 8 },
  tooltipItemData: { fontSize: 10, fontWeight: 800 },
};
const chartBase = {
  gridAxis: 'y' as const,
  strokeDasharray: '2 5',
  gridColor: 'dark.5',
  textColor: 'dark.2',
  tickLine: 'none' as const,
  withLegend: true,
  legendProps: { verticalAlign: 'bottom' as const, height: 28 },
  tooltipAnimationDuration: 100,
  tooltipProps: { content: CompactTooltip, position: { x: 0, y: -26 }, wrapperStyle: { width: '100%', pointerEvents: 'none' as const, visibility: 'visible' as const }, allowEscapeViewBox: { x: false, y: true }, isAnimationActive: false },
  yAxisProps: { width: 34 },
};
const lineBase = { ...chartBase, curveType: 'monotone' as const, withDots: false, strokeWidth: 2.5, activeDotProps: { r: 5, strokeWidth: 2 } };

export const buildTheme = (accent: Accent) => createTheme({
  primaryColor: 'signal',
  primaryShade: 5,
  autoContrast: true, // black text on white buttons when the accent is off
  colors: { signal: ACCENTS[accent].tuple, dark },
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
    // Labels sit flush left; trailing icon on the right.
    Button: Button.extend({ defaultProps: { justify: 'space-between', fw: 800 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 44, variant: 'subtle', color: 'gray' } }),
    Badge: Badge.extend({ defaultProps: { radius: 0, fw: 800 } }),
    Paper: Paper.extend({ defaultProps: { radius: 0 } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 0 } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { radius: 0 } }),
    Select: Select.extend({ defaultProps: { radius: 0 } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: 0 } }),
    Switch: Switch.extend({ defaultProps: { radius: 0, color: 'signal' } }),
    AreaChart: AreaChart.extend({ defaultProps: { ...lineBase, withGradient: true, fillOpacity: 0.35 }, styles: chartStyles }),
    LineChart: LineChart.extend({ defaultProps: lineBase, styles: chartStyles }),
    BarChart: BarChart.extend({ defaultProps: { ...chartBase, maxBarWidth: 14 }, styles: chartStyles }),
    CompositeChart: CompositeChart.extend({ defaultProps: { ...lineBase, maxBarWidth: 14 }, styles: chartStyles }),
  },
});
