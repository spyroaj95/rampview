import type { Airport } from '../types/airport'
import type { Deal } from '../types/pipeline'
import type { ScoreInfo } from '../lib/scoring'
import { LAYER_META, layerLegendRows, layerBucket, type LayerKey } from '../lib/layers'

interface Props {
  airports: Airport[]
  layer: LayerKey
  scoreOf: (a: Airport) => ScoreInfo | undefined
  dealOf: (a: Airport) => Deal | undefined
  /** dock right when a left overlay panel is open */
  right?: boolean
}

/** Bottom-left legend: color key for the ACTIVE LAYER + live counts per bucket. */
export default function Legend({ airports, layer, scoreOf, dealOf, right }: Props) {
  const rows = layerLegendRows(layer)
  const counts = new Map<string, number>()
  for (const a of airports) {
    const k = layerBucket(layer, a, scoreOf(a), dealOf(a))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return (
    <div className={`legend${right ? ' right' : ''}`}>
      <h4>{LAYER_META[layer].label} LAYER</h4>
      {rows.map((r) => {
        const n = counts.get(r.key) ?? 0
        return (
          <div className="legend-row" key={r.key} style={{ opacity: n ? 1 : 0.45 }}>
            <span className="swatch" style={{ background: r.color, color: r.color }} />
            <span>{r.label}</span>
            <span className="count">{n}</span>
          </div>
        )
      })}
      <div className="legend-foot">
        Point <b>size</b> = annual passengers. <b>Color</b> = {LAYER_META[layer].blurb.toLowerCase()}.
        Tier B intelligence is enriched over time; unknown stays visible until researched.
      </div>
    </div>
  )
}
