interface Entry { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string; unit?: string; dataKey?: string }

const round = (v: number | string | undefined) => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : (v ?? '–'));

// Chart readout: a slim bar across the full chart width, above it. Label on the left, series values in their colours.
export function CompactTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: readonly object[] }) {
  if (!active || !payload?.length) return null;
  const rows = payload as Entry[];
  return (
    <div style={{ background: '#000', border: '1px solid var(--rule)', padding: '3px 8px', fontSize: 11, lineHeight: 1.3, display: 'flex', alignItems: 'baseline', gap: 12, width: '100%', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <b style={{ marginRight: 'auto' }}>{label}</b>
      {rows.map((e, i) => (
        <b key={e.dataKey ?? e.name ?? i} style={{ color: e.color ?? e.stroke ?? e.fill }}>
          <span style={{ fontWeight: 400, opacity: .8 }}>{e.name} </span>{round(e.value)}{e.unit ?? ''}
        </b>
      ))}
    </div>
  );
}
