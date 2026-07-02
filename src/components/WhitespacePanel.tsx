import { useMemo } from 'react'
import type { Airport } from '../types/airport'
import type { Deal } from '../types/pipeline'
import { whitespaceCategory, WHITESPACE_COLORS, type WhitespaceCat } from '../lib/layers'
import type { ScoreInfo } from '../lib/scoring'
import { scoreColor } from '../lib/scoring'

interface Props {
  airports: Airport[]
  dealOf: (a: Airport) => Deal | undefined
  scoreOf: (a: Airport) => ScoreInfo
  onlyOpen: boolean
  onOnlyOpen: (v: boolean) => void
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onExportCsv: (airports: Airport[]) => void
  /** globe-hovered airport (two-way linking) */
  highlightId?: string | null
}

/** WHITESPACE view side panel: category counts + ranked open targets. */
export default function WhitespacePanel(props: Props) {
  const { airports, dealOf, scoreOf, onlyOpen } = props

  const cats = useMemo(() => {
    const m = new Map<WhitespaceCat, Airport[]>()
    for (const a of airports) {
      const c = whitespaceCategory(a, dealOf(a))
      m.set(c, [...(m.get(c) ?? []), a])
    }
    return m
  }, [airports, dealOf])

  const open = (cats.get('open') ?? []).sort((a, b) => scoreOf(b).score - scoreOf(a).score)

  return (
    <div className="overlay-panel slim below-filters">
      <div className="overlay-head">
        <h3>Whitespace</h3>
        <span className="spacer" />
        <button className={`minibtn${onlyOpen ? ' accent' : ''}`} onClick={() => props.onOnlyOpen(!onlyOpen)}>
          {onlyOpen ? '● Only open' : '○ Only open'}
        </button>
        <button className="minibtn" onClick={() => props.onExportCsv(open)}>
          Export open CSV
        </button>
      </div>
      <div className="overlay-body">
        <div className="rollup">
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {(Object.keys(WHITESPACE_COLORS) as WhitespaceCat[]).map((k) => (
              <div className="metric" key={k}>
                <div className="metric-label" style={{ color: WHITESPACE_COLORS[k].color }}>
                  {k === 'ours_contested' ? 'Both' : k}
                </div>
                <div className="metric-value">{cats.get(k)?.length ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="section-title" style={{ padding: '12px 16px 4px' }}>
          Open whitespace, ranked by opportunity
        </div>
        {open.map((a) => {
          const s = scoreOf(a).score
          return (
            <button
              key={a.id}
              className={`org-row${props.highlightId === a.id ? ' rowhl' : ''}`}
              onClick={() => props.onSelect(a.id)}
              onMouseEnter={() => props.onHover(a.id)}
              onMouseLeave={() => props.onHover(null)}
            >
              <span
                className="scorepill"
                style={{ background: `${scoreColor(s)}1f`, color: scoreColor(s) }}
              >
                {s}
              </span>
              <div>
                <span className="org-name" style={{ fontSize: 12.5 }}>
                  {a.iata ?? a.id} · {a.name}
                </span>
                <div className="org-global">
                  {[a.city, a.country].filter(Boolean).join(', ')}
                </div>
              </div>
            </button>
          )
        })}
        {open.length === 0 && (
          <div className="unknown-hint" style={{ padding: '10px 16px' }}>
            No open whitespace under the current filters
          </div>
        )}
      </div>
    </div>
  )
}
