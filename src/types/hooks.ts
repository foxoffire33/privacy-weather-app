import type { ToggleSeries } from './charts';

export interface SeriesLegendProps {
  scope: string;
  series: readonly ToggleSeries[];
}
