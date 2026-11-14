import { BarChart, CompositeChart, LineChart } from '@mantine/charts';
import {
  ActionIcon, Badge, Button, Drawer, Modal, Paper, Progress, Skeleton, SegmentedControl, Select, Switch, TextInput, PasswordInput,
  createTheme 
} from '@mantine/core';


import { CompactTooltip } from './components/charts/CompactTooltip';

import type { Accent } from './stores';
import type { AccentDef, MotionPresets, Rgb, ScreenMotion } from './types';
import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core';

export const ACCENT_NAMES: readonly Exclude<Accent, 'custom'>[] = ['green', 'red', 'blue', 'off'];

export const ACCENTS: Record<Exclude<Accent, 'custom'>, AccentDef> = {
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
const barCursor = { fill: 'var(--selected-bg)', stroke: 'none' };
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

const channel = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [channel(a[0], b[0], t), channel(a[1], b[1], t), channel(a[2], b[2], t)];
const toHex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const luminance = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hexByte = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

export function customTuple(hex: string): MantineColorsTuple {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  let b: Rgb = m ? [hexByte(m[1], 0), hexByte(m[1], 2), hexByte(m[1], 4)] : [23, 138, 74];
  while (luminance(b) > 0.5) { b = mix(b, BLACK, 0.1); }
  while (luminance(b) < 0.12) { b = mix(b, WHITE, 0.1); }
  const light = (t: number) => toHex(mix(b, WHITE, t));
  const shade = (t: number) => toHex(mix(b, BLACK, t));
  return [light(0.92), light(0.82), light(0.65), light(0.45), light(0.25), toHex(b), shade(0.15), shade(0.3), shade(0.5), shade(0.7)];
}

const MOTION_EASE: [number, number, number, number] = [0.2, 0, 0, 1];
const MOTION_SHIFT = 30;
const SHEET_MS = 300;

export const MOTION: MotionPresets = {
  screen: { duration: SHEET_MS / 1000, ease: MOTION_EASE },
  quick: { duration: 0.2, ease: MOTION_EASE },
  settle: { type: 'spring', stiffness: 420, damping: 42 },
  spin: { duration: 1, ease: 'linear', repeat: Infinity },
  instant: { duration: 0 },
};

export const SCREEN_MOTION: ScreenMotion = {
  enter: {
    forward: { opacity: 0, x: MOTION_SHIFT },
    back: { opacity: 0, x: -MOTION_SHIFT },
    swipeNext: { x: '100%' },
    swipePrev: { x: '-100%' },
  },
  exit: {
    forward: { opacity: 0, x: -MOTION_SHIFT },
    back: { opacity: 0, x: MOTION_SHIFT },
    swipeNext: { x: '-100%' },
    swipePrev: { x: '100%' },
  },
};

const SHEET_TRANSITION = { duration: SHEET_MS, timingFunction: `cubic-bezier(${MOTION_EASE.join(', ')})` };

export const buildTheme = (accent: Accent, accentColor = '#178a4a'): MantineThemeOverride => createTheme({
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
  respectReducedMotion: true,
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
    Modal: Modal.extend({
      defaultProps: { radius: 0, portalProps: { target: '.device' }, closeButtonProps: { size: 44, iconSize: 20 }, overlayProps: { backgroundOpacity: 0.6 }, transitionProps: SHEET_TRANSITION },
      styles: {
        content: { paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' },
        header: { paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))', borderBottom: '2px solid var(--rule)' },
        title: { fontSize: 16, fontWeight: 800 },
        body: { padding: 0, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        radius: 0, portalProps: { target: '.device' }, position: 'bottom',
        closeButtonProps: { size: 44, iconSize: 20 }, overlayProps: { backgroundOpacity: 0.6 }, transitionProps: SHEET_TRANSITION,
      },
      styles: {
        content: { height: 'auto', background: '#000', borderTop: '2px solid var(--rule)', textTransform: 'none', letterSpacing: 0 },
        header: { background: '#000' },
        title: { fontSize: 16, fontWeight: 800 },
        body: { paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' },
      },
    }),
    Progress: Progress.extend({
      defaultProps: { radius: 0, size: 4, transitionDuration: 0 },
      styles: { root: { background: 'rgba(255, 255, 255, .12)' } },
    }),
    TextInput: TextInput.extend({ defaultProps: { radius: 0 } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { radius: 0 } }),
    Select: Select.extend({ defaultProps: { radius: 0 } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: 0 } }),
    Switch: Switch.extend({ defaultProps: { radius: 0, color: 'signal' } }),
    LineChart: LineChart.extend({ defaultProps: lineBase, styles: chartStyles }),
    BarChart: BarChart.extend({ defaultProps: { ...chartBase, tooltipProps: { ...chartBase.tooltipProps, cursor: barCursor }, maxBarWidth: 14 }, styles: chartStyles }),
    CompositeChart: CompositeChart.extend({ defaultProps: { ...lineBase, maxBarWidth: 14 }, styles: chartStyles }),
  },
});

export const CONFIRM_MODAL = {
  centered: true,
  withCloseButton: false,
  styles: {
    content: { border: '2px solid var(--rule)', background: '#000' },
    body: { padding: 16, paddingBottom: 16 },
  },
};
