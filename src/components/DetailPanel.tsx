import { useState } from 'react'
import type { Airport, Confidence } from '../types/airport'
import type { Deal } from '../types/pipeline'
import {
  statusMeta,
  GSE_MODEL_LABEL,
  LABOR_PRESSURE_LABEL,
  LABOR_PRESSURE_COLOR,
  CONFIDENCE_COLOR,
  SIZE_CLASS_LABEL,
} from '../lib/statusMeta'
import { compactNumber, fullNumber, humanize, shortDate, todayIso } from '../lib/format'
import type { ScoreInfo } from '../lib/scoring'
import { scoreColor } from '../lib/scoring'
import PipelinePanel from './PipelinePanel'
import PassGate from './PassGate'
import ValueSection from './ValueSection'
import type { ValueAssumptions } from '../lib/valueModel'

export type PanelTab = 'intel' | 'pipeline'

interface Props {
  airport: Airport | null
  deal: Deal | undefined
  scoreInfo: ScoreInfo | undefined
  sample: boolean
  tab: PanelTab
  onTab: (t: PanelTab) => void
  pipelineLocked: boolean
  onUnlocked: () => void
  assumptions: ValueAssumptions
  onAssumptions: (a: ValueAssumptions) => void
  onClose: () => void
  onEdit: () => void
  onBrief: () => void
  onUpsertDeal: (d: Deal) => void
  onDownloadPipeline: () => void
  onCopyPipeline: () => void
}

/** ISO 3166-1 alpha-2 -> regional-indicator flag emoji. */
function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '🏳️'
  const A = 0x1f1e6
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => A + c.charCodeAt(0) - 65),
  )
}

function SectionTitle({ label, tierB, meta }: { label: string; tierB?: boolean; meta?: boolean }) {
  return (
    <div className="section-title">
      {label}
      {!meta && <span className={`tier${tierB ? ' b' : ''}`}>{tierB ? 'TIER B' : 'TIER A'}</span>}
    </div>
  )
}

function ConfidenceBadge({ value }: { value?: Confidence }) {
  if (!value) return null
  const color = CONFIDENCE_COLOR[value]
  return (
    <span className="conf" style={{ background: `${color}18`, color }}>
      <span className="dot" style={{ background: color }} />
      {value} confidence
    </span>
  )
}

function UnknownHint({ text = 'Unknown, not yet researched' }: { text?: string }) {
  return <div className="unknown-hint">{text}</div>
}

/** Render a source string with any embedded http(s) URL as a clickable link. */
function SourceText({ text }: { text: string }) {
  const m = text.match(/https?:\/\/[^\s)"]+/)
  if (!m || m.index == null) return <>{text}</>
  const url = m[0]
  const before = text.slice(0, m.index)
  const after = text.slice(m.index + url.length)
  const label = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <>
      {before}
      <a href={url} target="_blank" rel="noreferrer" className="src-link">
        {label.length > 56 ? `${label.slice(0, 56)}…` : label} ↗
      </a>
      {after}
    </>
  )
}

/** Days between two ISO dates. */
function daysSince(iso: string | undefined, today: string): number | null {
  if (!iso) return null
  const ms = new Date(today).getTime() - new Date(iso).getTime()
  return Number.isNaN(ms) ? null : Math.floor(ms / 86400000)
}
const STALE_DAYS = 90

export default function DetailPanel(props: Props) {
  const { airport: a, deal, scoreInfo, tab, onTab } = props
  const meta = statusMeta(a?.aerovectStatus)
  const [showScoreTip, setShowScoreTip] = useState(false)

  return (
    <aside className={`panel${a ? ' open' : ''}`} aria-hidden={!a}>
      {a && (
        <>
          <div className="panel-scroll">
            {/* ---------- Header: the airport selector row ---------- */}
            <div className="panel-header">
              <button className="panel-close" onClick={props.onClose} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="panel-codes">
                {a.iata && <span className="panel-code">{a.iata}</span>}
                {a.icao && <span className="panel-code icao">{a.icao}</span>}
                {scoreInfo && (
                  <span
                    className="panel-code icao"
                    style={{ color: scoreColor(scoreInfo.score), cursor: 'help', position: 'relative' }}
                    onMouseEnter={() => setShowScoreTip(true)}
                    onMouseLeave={() => setShowScoreTip(false)}
                    title=""
                  >
                    SCORE {scoreInfo.score}
                  </span>
                )}
              </div>
              <h2 className="panel-title">{a.name}</h2>
              <div className="panel-loc">
                <span className="flag">{flagEmoji(a.countryCode)}</span>
                {[a.city, a.country].filter(Boolean).join(', ')}
                {a.region ? ` · ${a.region}` : ''}
              </div>
              <span className="status-chip" style={{ background: `${meta.color}1c`, color: meta.color }}>
                <span className="dot live-dot" style={{ background: meta.color }} />
                {meta.label.toUpperCase()}
              </span>
              {showScoreTip && scoreInfo && (
                <div className="score-tip" style={{ top: 120, right: 24 }}>
                  <h5>Opportunity score · transparent weights</h5>
                  {scoreInfo.components.map((c) => (
                    <div className="srow" key={c.label}>
                      <span className="sl">{c.label}</span>
                      <span className="sp">
                        {c.points}/{c.max}
                      </span>
                      <span className="sr">{c.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- Tabs ---------- */}
            <div className="tabrow">
              <button className={`tabbtn${tab === 'intel' ? ' active' : ''}`} onClick={() => onTab('intel')}>
                INTEL
              </button>
              <button className={`tabbtn${tab === 'pipeline' ? ' active' : ''}`} onClick={() => onTab('pipeline')}>
                PIPELINE
              </button>
            </div>

            {tab === 'pipeline' ? (
              props.pipelineLocked ? (
                <PassGate what="The pipeline tab" onUnlocked={props.onUnlocked} />
              ) : (
                <PipelinePanel
                  key={a.id} // remount on airport change: drafts must never cross deals
                  airport={a}
                  deal={deal}
                  sample={props.sample}
                  onUpsert={props.onUpsertDeal}
                  onDownload={props.onDownloadPipeline}
                  onCopy={props.onCopyPipeline}
                />
              )
            ) : (
              <>
                {/* ---------- Overview (Tier A) ---------- */}
                <div className="section">
                  <SectionTitle label="Overview" />
                  <div className="metrics">
                    <div className="metric">
                      <div className="metric-label">Size class</div>
                      <div className="metric-value">{SIZE_CLASS_LABEL[a.sizeClass ?? 'other']}</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Annual passengers</div>
                      {a.passengersAnnual ? (
                        <>
                          <div className="metric-value">{compactNumber(a.passengersAnnual)}</div>
                          <div className="metric-sub">
                            {fullNumber(a.passengersAnnual)}
                            {a.passengersYear ? ` · ${a.passengersYear}` : ''}
                          </div>
                        </>
                      ) : (
                        <div className="metric-value muted">n/a</div>
                      )}
                    </div>
                    <div className="metric">
                      <div className="metric-label">Aircraft movements</div>
                      <div className={`metric-value${a.aircraftMovementsAnnual ? '' : ' muted'}`}>
                        {a.aircraftMovementsAnnual ? fullNumber(a.aircraftMovementsAnnual) : 'n/a'}
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Cargo (tonnes/yr)</div>
                      <div className={`metric-value${a.cargoTonnesAnnual ? '' : ' muted'}`}>
                        {a.cargoTonnesAnnual ? fullNumber(a.cargoTonnesAnnual) : 'n/a'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------- Ownership (Tier A) ---------- */}
                <div className="section">
                  <SectionTitle label="Ownership" />
                  <div className="field">
                    <span className="field-label">Owner / operator</span>
                    <span className={`field-value${a.owner ? '' : ' muted'}`}>{a.owner ?? 'unknown'}</span>
                  </div>
                  <div className="field">
                    <span className="field-label">Ownership type</span>
                    <span className={`field-value${a.ownershipType && a.ownershipType !== 'unknown' ? '' : ' muted'}`}>
                      {humanize(a.ownershipType) === 'n/a' ? 'unknown' : humanize(a.ownershipType)}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="metric-label" style={{ marginBottom: 7 }}>
                      Hubs for
                    </div>
                    {a.hubFor && a.hubFor.length > 0 ? (
                      <div className="tags">
                        {a.hubFor.map((h) => (
                          <span className="tag" key={h}>
                            {h}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <UnknownHint text="No hub carriers recorded" />
                    )}
                  </div>
                </div>

                {/* ---------- Ground Operations (Tier B) ---------- */}
                <div className="section">
                  <SectionTitle label="Ground Operations" tierB />
                  <div className="field">
                    <span className="field-label">GSE model</span>
                    <span className={`field-value${a.gseModel && a.gseModel !== 'unknown' ? '' : ' muted'}`}>
                      {a.gseModel && a.gseModel !== 'unknown' ? GSE_MODEL_LABEL[a.gseModel] : 'unknown'}
                    </span>
                  </div>
                  <div className="field">
                    <span className="field-label">Est. GSE fleet</span>
                    <span className={`field-value${a.gseFleetEstimate ? '' : ' muted'}`}>
                      {a.gseFleetEstimate ?? 'unknown'}
                    </span>
                  </div>
                  <div className="field">
                    <span className="field-label">Labor pressure</span>
                    {a.laborPressure && a.laborPressure !== 'unknown' ? (
                      <span className="field-value" style={{ color: LABOR_PRESSURE_COLOR[a.laborPressure] }}>
                        {LABOR_PRESSURE_LABEL[a.laborPressure]}
                      </span>
                    ) : (
                      <span className="field-value muted">unknown</span>
                    )}
                  </div>

                  <div style={{ marginTop: 13 }}>
                    <div className="metric-label" style={{ marginBottom: 8 }}>
                      Ground handlers
                    </div>
                    {a.groundHandlers && a.groundHandlers.length > 0 ? (
                      a.groundHandlers.map((h, i) => (
                        <div className="handler" key={i}>
                          <div className="handler-name">{h.name}</div>
                          {h.role && <div className="handler-role">{h.role}</div>}
                          {h.notes && <div className="handler-notes">{h.notes}</div>}
                        </div>
                      ))
                    ) : (
                      <UnknownHint text="No handlers researched yet" />
                    )}
                  </div>

                  {a.operationsNotes && (
                    <div style={{ marginTop: 13 }}>
                      <div className="metric-label" style={{ marginBottom: 7 }}>
                        Operations notes
                      </div>
                      <div className="notes-block">{a.operationsNotes}</div>
                    </div>
                  )}
                </div>

                {/* ---------- AeroVect (Tier B) ---------- */}
                <div className="section">
                  <SectionTitle label="AeroVect" tierB />
                  <div className="field">
                    <span className="field-label">Pipeline status</span>
                    <span className="field-value" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  {a.aerovectNotes ? (
                    <div style={{ marginTop: 11 }}>
                      <div className="notes-block">{a.aerovectNotes}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 11 }}>
                      <UnknownHint text="No account notes yet" />
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    <div className="metric-label" style={{ marginBottom: 8 }}>
                      Competitor presence
                    </div>
                    {a.competitors && a.competitors.length > 0 ? (
                      a.competitors.map((c, i) => {
                        const srcUrl = c.source?.match(/https?:\/\/[^\s)"]+/)?.[0]
                        return (
                          <div className="compet" key={i} title={c.source}>
                            <span className="compet-vendor">{c.vendor}</span>
                            <span className="compet-status">
                              {c.status ?? ''}
                              {srcUrl && (
                                <>
                                  {' '}
                                  <a href={srcUrl} target="_blank" rel="noreferrer" className="src-link">
                                    src ↗
                                  </a>
                                </>
                              )}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <UnknownHint text="None recorded" />
                    )}
                  </div>
                </div>

                {/* ---------- Value model (P3) ---------- */}
                <ValueSection
                  deal={deal}
                  assumptions={props.assumptions}
                  onAssumptions={props.onAssumptions}
                  gateLocked={props.pipelineLocked}
                />

                {/* ---------- Tailwinds / News (Tier B) ---------- */}
                <div className="section">
                  <SectionTitle label="Tailwinds & News" tierB />
                  {a.tailwinds && a.tailwinds.length > 0 ? (
                    a.tailwinds.map((n, i) => (
                      <div className="news" key={i}>
                        {(n.date || n.firstSeen) && (
                          <div className="news-date">
                            {n.date ? shortDate(n.date) : ''}
                            {n.firstSeen ? ` · seen ${shortDate(n.firstSeen)}` : ''}
                          </div>
                        )}
                        <div className="news-head">
                          {n.url ? (
                            <a href={n.url} target="_blank" rel="noreferrer">
                              {n.headline}
                            </a>
                          ) : (
                            n.headline
                          )}
                        </div>
                        {n.relevance && <div className="news-rel">{n.relevance}</div>}
                      </div>
                    ))
                  ) : (
                    <UnknownHint text="No tailwinds recorded yet" />
                  )}
                </div>

                {/* ---------- Sources / meta ---------- */}
                <div className="section">
                  <SectionTitle label="Sources & Confidence" meta />
                  {a.sources && a.sources.length > 0 ? (
                    <ul className="sources" style={{ margin: 0, paddingLeft: 16 }}>
                      {a.sources.map((s, i) => (
                        <li key={i}>
                          <SourceText text={s} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <UnknownHint text="No sources cited" />
                  )}
                  <div className="meta-foot">
                    <ConfidenceBadge value={a.confidence} />
                    <span>
                      Sources as of {a.lastUpdated ? shortDate(a.lastUpdated) : 'never'}
                    </span>
                    {(() => {
                      const d = daysSince(a.lastUpdated, todayIso())
                      return d != null && d > STALE_DAYS ? (
                        <span className="stalled-badge">STALE {d}D</span>
                      ) : null
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ---------- Actions ---------- */}
          <div className="panel-actions">
            <button className="btn primary" onClick={props.onEdit}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              Edit intel
            </button>
            <button className="btn" onClick={props.onBrief}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              Account brief
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
