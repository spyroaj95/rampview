import { useMemo } from 'react'
import type { Airport } from '../types/airport'
import { TIER_B_FIELDS } from '../types/airport'
import { isEnriched } from '../services/dataService'
import type { ScoreInfo } from '../lib/scoring'
import { scoreColor } from '../lib/scoring'

interface Props {
  airports: Airport[]
  scoreOf: (a: Airport) => ScoreInfo
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

const FIELD_LABELS: Record<string, string> = {
  gseModel: 'GSE MODEL',
  groundHandlers: 'GROUND HANDLERS',
  gseFleetEstimate: 'GSE FLEET EST.',
  laborPressure: 'LABOR PRESSURE',
  aerovectStatus: 'AEROVECT STATUS',
  aerovectNotes: 'ACCOUNT NOTES',
  competitors: 'COMPETITORS',
  tailwinds: 'TAILWINDS',
  operationsNotes: 'OPS NOTES',
}

function populated(a: Airport, field: (typeof TIER_B_FIELDS)[number]): boolean {
  const v = a[field]
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  if (v === 'unknown') return false
  return true
}

/** COVERAGE view (B7): how much of the golden Tier B is filled, and what to enrich next. */
export default function CoverageView({ airports, scoreOf, onSelect, onHover }: Props) {
  const total = airports.length

  const fieldCoverage = useMemo(
    () =>
      TIER_B_FIELDS.map((f) => ({
        field: f,
        n: airports.filter((a) => populated(a, f)).length,
      })).sort((a, b) => b.n - a.n),
    [airports],
  )

  const regionCoverage = useMemo(() => {
    const regions = Array.from(new Set(airports.map((a) => a.region).filter(Boolean))) as string[]
    return regions
      .map((r) => {
        const list = airports.filter((a) => a.region === r)
        return { region: r, total: list.length, enriched: list.filter(isEnriched).length }
      })
      .sort((a, b) => b.total - a.total)
  }, [airports])

  const enrichNext = useMemo(
    () =>
      airports
        .filter((a) => !a.confidence || a.confidence === 'low')
        .map((a) => ({ a, score: scoreOf(a).score }))
        .sort((x, y) => y.score - x.score)
        .slice(0, 15),
    [airports, scoreOf],
  )

  const enrichedTotal = airports.filter(isEnriched).length

  return (
    <div className="overlay-panel">
      <div className="overlay-head">
        <h3>Coverage</h3>
        <span className="spacer" />
        <span className="eyebrow">
          {enrichedTotal}/{total} airports carry Tier B intel
        </span>
      </div>
      <div className="overlay-body">
        <div className="section-title" style={{ padding: '14px 18px 6px' }}>
          Tier B field coverage
        </div>
        {fieldCoverage.map(({ field, n }) => (
          <div className="covrow" key={field}>
            <span className="covlabel">{FIELD_LABELS[field] ?? field}</span>
            <div className="covbar">
              <div style={{ width: `${(n / total) * 100}%` }} />
            </div>
            <span className="covpct">
              {n}/{total} · {Math.round((n / total) * 100)}%
            </span>
          </div>
        ))}

        <div className="section-title" style={{ padding: '18px 18px 6px' }}>
          Enriched by region
        </div>
        {regionCoverage.map((r) => (
          <div className="covrow" key={r.region}>
            <span className="covlabel">{r.region.toUpperCase()}</span>
            <div className="covbar">
              <div style={{ width: `${(r.enriched / r.total) * 100}%` }} />
            </div>
            <span className="covpct">
              {r.enriched}/{r.total} · {Math.round((r.enriched / r.total) * 100)}%
            </span>
          </div>
        ))}

        <div className="section-title" style={{ padding: '18px 18px 6px' }}>
          Enrich next · high opportunity, low confidence
        </div>
        <div className="export-note" style={{ margin: '4px 18px 10px' }}>
          Point the research agents at these: <b>npm run enrich:plan 12</b> then merge results, or
          use <b>npm run news:plan</b> for tailwind refreshes.
        </div>
        {enrichNext.map(({ a, score }) => (
          <div
            className="enrich-row"
            key={a.id}
            onClick={() => onSelect(a.id)}
            onMouseEnter={() => onHover(a.id)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="scorepill" style={{ background: `${scoreColor(score)}1f`, color: scoreColor(score) }}>
              {score}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ color: 'var(--text-hi)', fontWeight: 600, fontSize: 12.5 }}>
                {a.iata ?? a.id} · {a.name}
              </span>
              <div className="org-global">
                {a.confidence ? `confidence: ${a.confidence}` : 'no Tier B confidence set'} ·{' '}
                {TIER_B_FIELDS.filter((f) => !populated(a, f)).length} fields unknown
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
