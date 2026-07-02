import { useMemo, useState } from 'react'
import type { Airport } from '../types/airport'
import { STAGE_ORDER, STAGE_META, type Deal, type DealStage } from '../types/pipeline'
import { computePipelineMetrics, isStalled, lastActivityDate } from '../services/pipelineService'
import { money, dayDate, todayIso, isOverdue } from '../lib/format'
import type { ScoreInfo } from '../lib/scoring'
import { scoreColor } from '../lib/scoring'

interface Row {
  deal: Deal
  airport: Airport
  score: number
}

interface Props {
  deals: Deal[]
  airportsById: Map<string, Airport>
  scoreOf: (a: Airport) => ScoreInfo
  regions: string[]
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onExportCsv: (rows: { airport: Airport }[]) => void
  onDownloadPipeline: () => void
  /** globe-hovered airport (two-way linking) */
  highlightId?: string | null
}

type SortKey = 'iata' | 'stage' | 'unitsTarget' | 'unitsLive' | 'score' | 'owner' | 'nextStepDue' | 'lastTouch'

/** PIPELINE view: metrics strip + sortable, filterable deal table. */
export default function PipelineTable({
  deals,
  airportsById,
  scoreOf,
  regions,
  onSelect,
  onHover,
  onExportCsv,
  onDownloadPipeline,
  highlightId,
}: Props) {
  const today = todayIso()
  const [stageFilter, setStageFilter] = useState<DealStage | ''>('')
  const [regionFilter, setRegionFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  const owners = useMemo(
    () => Array.from(new Set(deals.map((d) => d.owner).filter(Boolean) as string[])).sort(),
    [deals],
  )
  const orgs = useMemo(
    () => Array.from(new Set(deals.map((d) => d.handlerOrCarrier).filter(Boolean) as string[])).sort(),
    [deals],
  )

  const rows: Row[] = useMemo(() => {
    let out = deals
      .map((deal) => {
        const airport = airportsById.get(deal.airportId)
        return airport ? { deal, airport, score: scoreOf(airport).score } : null
      })
      .filter(Boolean) as Row[]
    if (stageFilter) out = out.filter((r) => r.deal.stage === stageFilter)
    if (regionFilter) out = out.filter((r) => r.airport.region === regionFilter)
    if (ownerFilter) out = out.filter((r) => r.deal.owner === ownerFilter)
    if (orgFilter) out = out.filter((r) => r.deal.handlerOrCarrier === orgFilter)

    const dir = sortDir
    out.sort((x, y) => {
      const get = (r: Row): string | number => {
        switch (sortKey) {
          case 'iata':
            return r.airport.iata ?? r.airport.id
          case 'stage':
            return STAGE_ORDER.indexOf(r.deal.stage)
          case 'unitsTarget':
            return r.deal.unitsTarget ?? -1
          case 'unitsLive':
            return r.deal.unitsLive ?? -1
          case 'score':
            return r.score
          case 'owner':
            return r.deal.owner ?? ''
          case 'nextStepDue':
            return r.deal.nextStepDue ?? '9999'
          case 'lastTouch':
            return lastActivityDate(r.deal) ?? ''
        }
      }
      const a = get(x)
      const b = get(y)
      return (a < b ? -1 : a > b ? 1 : 0) * dir
    })
    return out
  }, [deals, airportsById, scoreOf, stageFilter, regionFilter, ownerFilter, orgFilter, sortKey, sortDir])

  const metrics = useMemo(() => computePipelineMetrics(deals, today), [deals, today])

  const sortBy = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(k)
      setSortDir(k === 'iata' || k === 'owner' ? 1 : -1)
    }
  }

  const Th = ({ k, children, num }: { k: SortKey; children: React.ReactNode; num?: boolean }) => (
    <th className={`${sortKey === k ? 'sorted' : ''}${num ? ' num' : ''}`} onClick={() => sortBy(k)}>
      {children}
      {sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="overlay-panel wide">
      <div className="overlay-head">
        <h3>Pipeline</h3>
        <span className="spacer" />
        <button className="minibtn" onClick={() => onExportCsv(rows)}>
          Export CSV
        </button>
        <button className="minibtn accent" onClick={onDownloadPipeline}>
          Download pipeline.json
        </button>
      </div>

      {/* metrics strip */}
      <div className="metricsbar">
        <div className="stat">
          <div className="stat-value">{metrics.unitsTarget}</div>
          <div className="stat-label">Units in pipe</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: '#2ee6a6' }}>
            {metrics.unitsLive}
          </div>
          <div className="stat-label">Units live</div>
        </div>
        <div className="stat">
          <div className="stat-value">{money(metrics.weightedValue)}</div>
          <div className="stat-label">Weighted value</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: '#22d3ee' }}>
            {metrics.pilotsLive}
          </div>
          <div className="stat-label">Pilots live</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: '#ff5468' }}>
            {metrics.competitorWon}
          </div>
          <div className="stat-label">Comp-won</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: metrics.stalled ? '#f5a623' : undefined }}>
            {metrics.stalled}
          </div>
          <div className="stat-label">Stalled 30d+</div>
        </div>
      </div>

      {/* filters */}
      <div className="tablefilters">
        <select className="select" value={stageFilter} onChange={(e) => setStageFilter(e.target.value as DealStage | '')}>
          <option value="">All stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s].label}
            </option>
          ))}
        </select>
        <select className="select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select className="select" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
          <option value="">All buying orgs</option>
          {orgs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className="select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {/* table */}
      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              <Th k="iata">Airport</Th>
              <th>Buying org</th>
              <Th k="stage">Stage</Th>
              <Th k="score" num>
                Score
              </Th>
              <Th k="unitsTarget" num>
                Target
              </Th>
              <Th k="unitsLive" num>
                Live
              </Th>
              <Th k="owner">Owner</Th>
              <th>Next step</th>
              <Th k="nextStepDue">Due</Th>
              <Th k="lastTouch">Last touch</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 26, color: 'var(--text-faint)' }}>
                  No deals match the filters
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const sm = STAGE_META[r.deal.stage]
              const stalled = isStalled(r.deal, today)
              const last = lastActivityDate(r.deal)
              return (
                <tr
                  key={r.deal.airportId}
                  className={highlightId === r.airport.id ? 'rowhl' : undefined}
                  onClick={() => onSelect(r.airport.id)}
                  onMouseEnter={() => onHover(r.airport.id)}
                  onMouseLeave={() => onHover(null)}
                >
                  <td>
                    <span className="code">{r.airport.iata ?? r.airport.id}</span> {r.airport.name}
                  </td>
                  <td>{r.deal.handlerOrCarrier ?? ''}</td>
                  <td>
                    <span className="stage-chip" style={{ background: `${sm.color}1c`, color: sm.color }}>
                      <span className="swatch" style={{ background: sm.color, width: 7, height: 7, borderRadius: '50%' }} />
                      {sm.label}
                    </span>
                    {stalled && <span className="stalled-badge">STALLED</span>}
                  </td>
                  <td className="num" style={{ color: scoreColor(r.score), fontWeight: 700 }}>
                    {r.score}
                  </td>
                  <td className="num">{r.deal.unitsTarget ?? ''}</td>
                  <td className="num">{r.deal.unitsLive ?? ''}</td>
                  <td>{r.deal.owner ?? ''}</td>
                  <td title={r.deal.nextStep}>{r.deal.nextStep ?? ''}</td>
                  <td className={isOverdue(r.deal.nextStepDue, today) ? 'overdue num' : 'num'}>
                    {r.deal.nextStepDue ? dayDate(r.deal.nextStepDue) : ''}
                  </td>
                  <td className="num">{last ? dayDate(last) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
