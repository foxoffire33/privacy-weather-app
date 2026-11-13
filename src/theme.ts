import { BarChart, CompositeChart, LineChart } from '@mantine/charts';
import {
  ActionIcon, Badge, Button, Paper, Skeleton, SegmentedControl, Select, Switch, Tabs, TextInput, PasswordInput,
  createTheme 
} from '@mantine/core';


import { CompactTooltip } from './components/charts/CompactTooltip';

import type { Accent } from './stores';
import type {MantineColorsTuple} from '@mantine/core';

// Design tokens — single source of truth for the values shared by the theme
// and the app-wide CSS below. (Mantine v9 does not turn theme.other into CSS
// variables, so the tokens are plain constants exposed through theme.other.)
const RULE = 'rgba(248, 244, 244, .6)';
const RULE_SOFT = 'rgba(248, 244, 244, .22)';
const SELECTED_BG = 'color-mix(in srgb, var(--mantine-color-signal-5) 18%, transparent)';
const SELECTED_BG_OFF = 'rgba(255, 255, 255, .1)';

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
  let base = m ? [0, 2, 4].map((i) => Number.parseInt(m[1].slice(i, i + 2), 16)) : [23, 138, 74];
  while (luminance(base) > 0.5) {base = mix(base as [number, number, number], [0, 0, 0], 0.1);}
  while (luminance(base) < 0.12) {base = mix(base as [number, number, number], [255, 255, 255], 0.1);}
  const b = base as [number, number, number];
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  return [0.92, 0.82, 0.65, 0.45, 0.25].map((t) => toHex(mix(b, white, t)))
    .concat(toHex(b), [0.15, 0.3, 0.5, 0.7].map((t) => toHex(mix(b, black, t)))) as unknown as MantineColorsTuple;
}

// App-wide layout CSS, built from the tokens above. Mantine v9 has no theme
// hook for global styles (MantineProvider dropped its styles prop and
// theme.other no longer emits CSS variables), so the rules travel inside the
// theme (theme.other.globalCss) and are injected as a <style /> tag by Root,
// right after Mantine's own styles load.
const globalCss = `
:root {
  --rule: ${RULE};
  --rule-soft: ${RULE_SOFT};
  --selected-bg: ${SELECTED_BG};
}
.device[data-accent=off] { --selected-bg: ${SELECTED_BG_OFF}; }
html, body, #root { height: 100%; margin: 0; }
body { font-variant-numeric: tabular-nums; }

.stage { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; background: #000; }
.device { width: 390px; height: 844px; max-height: calc(100dvh - 48px); position: relative; overflow: hidden; background: var(--mantine-color-body); border: 2px solid #2d2b2b; display: flex; flex-direction: column; }

.device::before, .device::after { content: ''; position: absolute; left: 0; right: 0; z-index: 3; pointer-events: none; background: var(--mantine-color-body); }
.device::before { top: 0; height: var(--sat, 0px); }
.device::after { bottom: 0; height: var(--sab, 0px); }
.device[data-top=accent]::before { background: var(--mantine-color-signal-5); }
.device[data-top=accent][data-accent=off]::before { background: #000; }
@media (max-width: 500px) {
  .stage { padding: 0; }
  .device { --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); width: 100%; height: 100dvh; max-height: none; border: 0; padding: var(--sat) 0 var(--sab); box-sizing: border-box; }
}

.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; }
.screen-cities { overflow: hidden; }
.cities-scroll[data-dragging] { overflow-y: hidden; }
.display { font-size: 56px; line-height: .95; letter-spacing: -.03em; padding: 8px 20px 12px; margin: 0; white-space: pre-line; }
.display-sm { font-size: 44px; }
.display-xl { font-size: 72px; padding-top: 56px; }
.ls-6 { letter-spacing: .06em; }
.ls-n4 { letter-spacing: -.04em; }
.card-rule { border: 2px solid var(--rule); }
.border-top-soft { border-top: 1px solid rgba(255,255,255,.12); }
.border-bottom-soft { border-bottom: 1px solid rgba(255,255,255,.1); }
.border-bottom-rule { border-bottom: 1px solid rgba(248,244,244,.2); }
.archive-grid > * { border-right: 1px solid rgba(255,255,255,.1); }
.summary-pretty { text-wrap: pretty; }
.flex-fill { flex: 1; min-width: 0; }

.grid-day { display: grid; grid-template-columns: 52px 1fr 44px 40px 32px; align-items: center; gap: 4px; }
.grid-pollutant { display: grid; grid-template-columns: 1fr 64px 84px; gap: 8px; align-items: center; }
.grid-pollen { display: grid; grid-template-columns: 1fr 56px 96px; gap: 8px; align-items: center; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--rule-soft); }
.hourly-link { display: flex; justify-content: space-between; }
.kicker { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #fff; font-weight: 800; padding: 20px 0 6px; border-bottom: 2px solid var(--rule); }
.rule-top { border-top: 2px solid var(--rule); }
.row { border-bottom: 1px solid var(--rule-soft); }

.log-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) 54px 40px 40px; align-items: baseline; gap: 6px; }
.log-row > span { justify-self: start; }

.pager { position: absolute; inset: 0; display: flex; touch-action: pan-y; user-select: none; transition: transform .35s cubic-bezier(.2,.8,.2,1); will-change: transform; transform: translateX(var(--pager-x, 0)); }
.page { touch-action: pan-y; width: 100%; height: 100%; flex: none; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
.pager-wrap { position: relative; flex: 1; overflow: hidden; }

.hero, .accent-field { background: var(--mantine-color-signal-5); color: #fff; }
.hero { padding: 72px 20px 56px; }
[data-accent=off] .hero, [data-accent=off] .accent-field { background: #000; }
.hero-temp { font-size: 168px; font-weight: 800; line-height: .85; letter-spacing: -.06em; margin-top: 8px; }

.spin { display: inline-flex; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.overlay { position: absolute; left: 0; right: 0; top: 0; padding: 8px; display: flex; justify-content: space-between; align-items: center; color: #fff; z-index: 2; background: var(--mantine-color-signal-5); }
[data-accent=off] .overlay { background: #000; border-bottom: 2px solid var(--rule); }
.dot { width: 8px; height: 8px; background: rgba(255, 255, 255, .45); transition: width .2s; border: 0; padding: 0; cursor: pointer; }
.dot[data-active] { width: 22px; background: #fff; }
.hours { display: grid; grid-template-columns: repeat(8, 1fr); border-bottom: 1px solid rgba(248, 244, 244, .2); }
.metric-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid var(--rule); }
.hourly-strip { display: flex; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid rgba(248, 244, 244, .2); touch-action: pan-x pan-y; cursor: grab; user-select: none; overscroll-behavior-x: contain; }
.hourly-strip > * { flex: none; width: 52px; padding: 10px 0 10px 10px; }
.hourly-strip > .day-divider { width: 18px; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; font-weight: 800; line-height: 1; color: var(--mantine-color-signal-3); }
.day-divider i { flex: 1; width: 2px; background: var(--rule); }
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
.bar { height: 4px; background: rgba(255, 255, 255, .12); position: relative; }
.bar > div { position: absolute; inset: 0 auto 0 0; }
.bar-tall { height: 6px; }
.bar-fill { width: var(--bar-w, 0%); background: var(--bar-c, var(--mantine-color-signal-5)); }
.nowcast { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; align-items: end; height: 36px; }
.nowcast-bar { height: var(--nowcast-h, 6%); background: rgba(255, 255, 255, .12); }
.nowcast-bar[data-on] { background: var(--mantine-color-signal-4); }
.wind-compass { display: inline-flex; transform: rotate(var(--wind-deg, 0deg)); }
.hour-cell { border: 1px solid var(--rule-soft); background: #0b0b0b; }
.hour-cell[data-day] { background: #000; }
.hour-cell[data-now] { border: 2px solid #fff; }
.hourly-strip > [data-past] { opacity: .82; }
.archive-grid { display: grid; grid-template-columns: repeat(4, 1fr); }

.chart-surface { touch-action: pan-y; }

.recharts-cartesian-axis-tick-value { font-size: 11px; font-variant-numeric: tabular-nums; }
.recharts-reference-line-label { font-size: 11px; fill: var(--mantine-color-dark-2); }
.recharts-active-dot circle { stroke: #000; stroke-width: 2; }

.metric-tabs, .tab-row { display: flex; flex-wrap: wrap; gap: 4px; }
.metric-tabs { margin-bottom: 26px; }
.tab-row { margin-bottom: 8px; }
.metric-tabs button, .tab-row button, .tab-button {
  flex: 1 1 76px; min-width: 76px; height: 40px; padding: 0 10px;
  font: inherit; font-size: 13px; font-weight: 800; text-transform: none; letter-spacing: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--mantine-color-dark-2); background: transparent;
  border: 2px solid var(--rule-soft); border-radius: 0; cursor: pointer;
}
.metric-tabs button[data-active], .tab-row button[data-active], .tab-button[data-active] {
  color: #fff; background: var(--mantine-color-signal-5); border-color: var(--mantine-color-signal-5);
}
[data-accent=off] .metric-tabs button[data-active], [data-accent=off] .tab-row button[data-active],
[data-accent=off] .tab-button[data-active] { color: #000; background: #fff; border-color: #fff; }

.tab-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }

.toggle-legend { display: flex; flex-wrap: wrap; gap: 4px 4px; padding-top: 2px; }
.toggle-legend button { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 8px 0 4px; font: inherit; font-size: 12px; color: var(--mantine-color-dark-2); background: transparent; border: 0; cursor: pointer; }
.toggle-legend button i { width: 10px; height: 3px; background: var(--swatch-c, transparent); }
.toggle-legend button[aria-pressed=false] { opacity: .4; text-decoration: line-through; }

.hourly-strip > [data-on] { background: color-mix(in srgb, var(--mantine-color-signal-5) 28%, transparent); }
.hourly-strip > .day-divider[data-on] { color: #fff; }
.row[data-on] { background: var(--selected-bg); box-shadow: inset 3px 0 0 var(--mantine-color-signal-5); }
[data-accent=off] .hourly-strip > [data-on] { background: rgba(255, 255, 255, .1); }

.recharts-wrapper, .recharts-responsive-container { overflow: visible !important; }

.hourly-strip > .pull-past { width: 0; padding: 10px 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--mantine-color-dark-2); overflow: hidden; writing-mode: horizontal-tb; white-space: nowrap; will-change: width; transition: width .2s ease; }
.hourly-strip > .pull-past[data-armed] { color: var(--mantine-color-signal-4); }

.cities-scroll { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.city-row { border-bottom: 1px solid rgba(248, 244, 244, .18); background: var(--mantine-color-body); position: relative; transform: translateY(var(--city-y, 0)); transition: transform .18s ease; }
.city-row[data-dragging] { z-index: 2; background: #1c1b1b; box-shadow: 0 8px 24px rgba(0, 0, 0, .6); transition: none; }
.drag-handle { flex: none; width: 52px; display: flex; align-items: center; justify-content: center; color: var(--mantine-color-dark-3); cursor: grab; touch-action: none; user-select: none; }
.city-row[data-dragging] .drag-handle { cursor: grabbing; color: #fff; }

.gesture-hint { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 4; padding: 10px 12px; font: inherit; font-size: 12px; line-height: 1.35; text-align: left; color: #fff; background: #1c1b1b; border: 1px solid var(--rule); cursor: pointer; }

.swipe-row { position: relative; overflow: hidden; touch-action: pan-y; }
.swipe-action { position: absolute; top: 0; bottom: 0; right: 0; width: var(--swipe-w, 0px); border: 0; background: #ff3b30; color: #fff; font: inherit; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: flex-end; padding-right: 18px; cursor: pointer; transition: width .22s ease; }
.swipe-content { position: relative; background: var(--mantine-color-body); transform: translateX(var(--swipe-x, 0px)); transition: transform .22s ease; }
.swipe-row[data-dragging] .swipe-action, .swipe-row[data-dragging] .swipe-content { transition: none; }

.onboard-rules { border-top: 2px solid #fff; flex: 1; }
.onboard-step { border-bottom: 2px solid rgba(255, 255, 255, .5); }
.onboard-step:last-child { border-bottom: 0; }

.accent-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; min-height: 44px; border: 2px solid var(--rule-soft); }
.accent-row[aria-pressed=true] { border-color: #fff; }
.swatch { flex: none; width: 16px; height: 16px; border: 1px solid var(--rule); }
.swatch-green { background: var(--mantine-color-green-5); }
.swatch-red { background: var(--mantine-color-red-5); }
.swatch-blue { background: var(--mantine-color-blue-5); }
.swatch-off { background: #000; }
.swatch-custom { background: var(--mantine-color-signal-5); }

.tt { display: flex; flex-direction: column; justify-content: center; gap: 2px; width: 100%; box-sizing: border-box; overflow: hidden; white-space: nowrap; padding: 3px 8px; min-height: 24px; font-size: 12px; line-height: 16px; border: 1px solid var(--rule); background: #000; }
.tt[data-empty] { border-color: rgba(255, 255, 255, .12); background: transparent; }
.tt-title { display: flex; align-items: baseline; gap: 12px; }
.tt-name { margin-right: auto; font-size: 13px; }
.tt-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px 12px; }
.tt-row { color: var(--tt-c); display: flex; align-items: baseline; gap: 4px; flex: 1 1 auto; min-width: 0; }
.tt-row-name { font-weight: 400; opacity: .8; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.tt-row-val { margin-left: auto; flex: none; min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }
.tt-hint { color: rgba(255, 255, 255, .3); }
`;

export const buildTheme = (accent: Accent, accentColor = '#178a4a') => createTheme({
  primaryColor: 'signal',
  primaryShade: 5,
  autoContrast: true,
  colors: { signal: accent === 'custom' ? customTuple(accentColor) : ACCENTS[accent].tuple, green: ACCENTS.green.tuple, red: ACCENTS.red.tuple, blue: ACCENTS.blue.tuple, dark },
  white: '#ffffff',
  black: '#100f0f',
  fontFamily: font,
  headings: { fontFamily: font, fontWeight: '800' },
  defaultRadius: 0,
  radius: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
  focusRing: 'auto',
  components: {
    Button: Button.extend({ defaultProps: { justify: 'space-between', fw: 800 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 44, variant: 'subtle', color: 'gray' } }),
    Badge: Badge.extend({ defaultProps: { radius: 0, fw: 800 } }),
    Paper: Paper.extend({ defaultProps: { radius: 0, bg: '#000' }, styles: { root: { border: '2px solid var(--rule)' } } }),
    Skeleton: Skeleton.extend({ defaultProps: { radius: 0 }, styles: { root: { '&::after': { backgroundColor: 'rgba(255, 255, 255, .08)' } } } }),
    TextInput: TextInput.extend({ defaultProps: { radius: 0 } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { radius: 0 } }),
    Select: Select.extend({ defaultProps: { radius: 0 } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: 0 } }),
    Switch: Switch.extend({ defaultProps: { radius: 0, color: 'signal' } }),
    Tabs: Tabs.extend({ styles: { tab: { '&::before': { content: 'none' } } } }),
    LineChart: LineChart.extend({ defaultProps: lineBase, styles: chartStyles }),
    BarChart: BarChart.extend({ defaultProps: { ...chartBase, cursorFill: 'var(--selected-bg)', maxBarWidth: 14 }, styles: chartStyles }),
    CompositeChart: CompositeChart.extend({ defaultProps: { ...lineBase, maxBarWidth: 14 }, styles: chartStyles }),
  },
  other: {
    rule: RULE,
    ruleSoft: RULE_SOFT,
    selectedBg: SELECTED_BG,
    selectedBgOff: SELECTED_BG_OFF,
    globalCss,
  },
});
