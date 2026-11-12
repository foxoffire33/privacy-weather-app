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

// Chart readout: a slim bar across the full chart width, above it. Always visible: a muted outline
// while idle, then the day/time and the series values (in their colours) while the chart is touched.
export function CompactTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: readonly object[] }) {
  const rows = (active && payload ? payload : []) as Entry[];
  const title = (rows[0] as { payload?: { when?: string } } | undefined)?.payload?.when ?? label;
  return (
    <div style={{
      border: `1px solid ${rows.length ? 'var(--rule)' : 'rgba(255,255,255,.12)'}`, background: rows.length ? '#000' : 'transparent',
      padding: '3px 8px', minHeight: 24, fontSize: 12, lineHeight: '16px', display: 'flex', alignItems: 'baseline', gap: 12,
      width: '100%', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {rows.length ? (
        <>
          <b style={{ marginRight: 'auto', fontSize: 13 }}>{title}</b>
          {rows.map((e, i) => (
            <b key={e.dataKey ?? e.name ?? i} style={{ color: e.color ?? e.stroke ?? e.fill }}>
              <span style={{ fontWeight: 400, opacity: .8 }}>{e.name} </span>
              <span style={{ display: 'inline-block', minWidth: `${WIDTH}ch`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fit(e.value)}
              </span>
              {e.unit ?? ''}
            </b>
          ))}
        </>
      ) : <span style={{ color: 'rgba(255,255,255,.3)' }}>{t('common.touchChart')}</span>}
    </div>
  );
}
