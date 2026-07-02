import type { Airport } from '../types/airport'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'

interface Props {
  airports: Airport[]
}

/** Bottom-left legend: color key for AeroVect status + live per-status counts. */
export default function Legend({ airports }: Props) {
  const counts = new Map<string, number>()
  for (const a of airports) {
    const k = a.aerovectStatus ?? 'unknown'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return (
    <div className="legend">
      <h4>AeroVect Status</h4>
      {STATUS_ORDER.map((s) => {
        const meta = STATUS_META[s]
        const n = counts.get(s) ?? 0
        return (
          <div className="legend-row" key={s} title={meta.blurb} style={{ opacity: n ? 1 : 0.45 }}>
            <span className="swatch" style={{ background: meta.color, color: meta.color }} />
            <span>{meta.label}</span>
            <span className="count">{n}</span>
          </div>
        )
      })}
      <div className="legend-foot">
        Point <b>size</b> = annual passengers. <b>Color</b> = pipeline status. Tier B intelligence
        (ground ops, competitors) is enriched over time; <b>gray</b> = not yet researched.
      </div>
    </div>
  )
}
