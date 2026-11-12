interface Entry { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string; unit?: string; dataKey?: string }

const round = (v: number | string | undefined) => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : (v ?? '–'));

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
              <span style={{ fontWeight: 400, opacity: .8 }}>{e.name} </span>{round(e.value)}{e.unit ?? ''}
            </b>
          ))}
        </>
      ) : <span style={{ color: 'rgba(255,255,255,.3)' }}>Touch the chart for details</span>}
    </div>
  );
}
