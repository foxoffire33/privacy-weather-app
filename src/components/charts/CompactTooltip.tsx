import { t } from '../../i18n';

interface Entry { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string; unit?: string; dataKey?: string }

const WIDTH = 4; // characters every value slot reserves, so nothing shifts as digits change

const one = (v: number) => String(Math.round(v * 10) / 10);

/**
 * A number in at most four characters, so the readout never reflows: one decimal while it
 * fits ("8.4", "12.4"), then whole numbers ("-12", "1013"), then k/M ("10k", "1.2M").
 */
function fit(value: number | string | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return typeof value === 'string' ? value : '–';
  const abs = Math.abs(value);
  const tries = [one(value), String(Math.round(value))];
  if (abs >= 1000) tries.push(`${one(value / 1e3)}k`, `${Math.round(value / 1e3)}k`);
  if (abs >= 1e6) tries.push(`${one(value / 1e6)}M`, `${Math.round(value / 1e6)}M`);
  return tries.find((s) => s.length <= WIDTH) ?? tries[tries.length - 1];
}

// Chart readout: a bar across the full chart width, above it. Always visible: a muted outline
// while idle, then the day/time and the series values (in their colours) while the chart is
// touched. Up to three values sit beside the title; beyond that they wrap into rows of three.
const PER_ROW = 3;

export function CompactTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: readonly object[] }) {
  const rows = (active && payload ? payload : []) as Entry[];
  const title = (rows[0] as { payload?: { when?: string } } | undefined)?.payload?.when ?? label;
  const grid = rows.length > PER_ROW;

  // The name gives way before the number does: it truncates, the value keeps its slot.
  const cell = (e: Entry, i: number) => (
    <b key={e.dataKey ?? e.name ?? i}
      style={{ color: e.color ?? e.stroke ?? e.fill, display: 'flex', alignItems: 'baseline', gap: 4, flex: '1 1 auto', minWidth: 0 }}>
      <span style={{ fontWeight: 400, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{e.name}</span>
      <span style={{ marginLeft: 'auto', flex: 'none', minWidth: `${WIDTH}ch`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fit(e.value)}{e.unit ?? ''}
      </span>
    </b>
  );

  return (
    <div style={{
      border: `1px solid ${rows.length ? 'var(--rule)' : 'rgba(255,255,255,.12)'}`, background: rows.length ? '#000' : 'transparent',
      padding: '3px 8px', minHeight: 24, fontSize: 12, lineHeight: '16px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
      width: '100%', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {rows.length ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <b style={{ marginRight: 'auto', fontSize: 13 }}>{title}</b>
            {!grid && rows.map(cell)}
          </div>
          {grid && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PER_ROW}, minmax(0, 1fr))`, gap: '2px 12px' }}>
              {rows.map(cell)}
            </div>
          )}
        </>
      ) : <span style={{ color: 'rgba(255,255,255,.3)' }}>{t('common.touchChart')}</span>}
    </div>
  );
}
