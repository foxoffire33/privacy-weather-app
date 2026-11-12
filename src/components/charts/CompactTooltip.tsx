interface Entry { name?: string; value?: number | string; color?: string; stroke?: string; fill?: string; unit?: string; dataKey?: string }

const round = (v: number | string | undefined) => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : (v ?? '–'));

// Minimal chart tooltip: day/hour label and the values only, each value in its series colour
// (the legend explains the colours). Far smaller than Mantine's default panel.
export function CompactTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: readonly object[] }) {
  if (!active || !payload?.length) return null;
  const rows = payload as Entry[];
  return (
    <div style={{ background: '#000', border: '1px solid var(--rule)', padding: '2px 6px', fontSize: 10, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
      <b style={{ marginRight: 6 }}>{label}</b>
      {rows.map((e, i) => (
        <b key={e.dataKey ?? e.name ?? i} style={{ color: e.color ?? e.stroke ?? e.fill, marginLeft: i ? 6 : 0 }}>
          {round(e.value)}{e.unit ?? ''}
        </b>
      ))}
    </div>
  );
}
