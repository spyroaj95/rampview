import { useState } from 'react'
import type {
  Airport,
  AeroVectStatus,
  GseModel,
  LaborPressure,
  Confidence,
  OwnershipType,
  GroundHandler,
  CompetitorPresence,
  NewsItem,
} from '../types/airport'
import { STATUS_ORDER, STATUS_META } from '../lib/statusMeta'

interface Props {
  airport: Airport
  onSave: (next: Airport) => void
  onCancel: () => void
  onExport: (next: Airport) => void
  onCopy: (next: Airport) => void
}

// ---- multiline <-> structured helpers (pipe-delimited, one item per line) ----
const handlersToText = (hs?: GroundHandler[]) =>
  (hs ?? []).map((h) => [h.name, h.role, h.notes].filter(Boolean).join(' | ')).join('\n')
const textToHandlers = (t: string): GroundHandler[] =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, role, notes] = l.split('|').map((s) => s.trim())
      return { name, ...(role ? { role } : {}), ...(notes ? { notes } : {}) }
    })

const compsToText = (cs?: CompetitorPresence[]) =>
  (cs ?? []).map((c) => [c.vendor, c.status, c.source].filter(Boolean).join(' | ')).join('\n')
const textToComps = (t: string): CompetitorPresence[] =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [vendor, status, source] = l.split('|').map((s) => s.trim())
      return { vendor, ...(status ? { status } : {}), ...(source ? { source } : {}) }
    })

const newsToText = (ns?: NewsItem[]) =>
  (ns ?? []).map((n) => [n.headline, n.relevance, n.url].filter(Boolean).join(' | ')).join('\n')
const textToNews = (t: string): NewsItem[] =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [headline, relevance, url] = l.split('|').map((s) => s.trim())
      return { headline, ...(relevance ? { relevance } : {}), ...(url ? { url } : {}) }
    })

const linesToArr = (t: string) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function EditForm({ airport, onSave, onCancel, onExport, onCopy }: Props) {
  const [f, setF] = useState({
    owner: airport.owner ?? '',
    ownershipType: (airport.ownershipType ?? 'unknown') as OwnershipType,
    hubFor: (airport.hubFor ?? []).join(', '),
    passengersAnnual: airport.passengersAnnual?.toString() ?? '',
    passengersYear: airport.passengersYear?.toString() ?? '',
    gseModel: (airport.gseModel ?? 'unknown') as GseModel,
    gseFleetEstimate: airport.gseFleetEstimate ?? '',
    laborPressure: (airport.laborPressure ?? 'unknown') as LaborPressure,
    aerovectStatus: (airport.aerovectStatus ?? 'unknown') as AeroVectStatus,
    aerovectNotes: airport.aerovectNotes ?? '',
    operationsNotes: airport.operationsNotes ?? '',
    handlers: handlersToText(airport.groundHandlers),
    competitors: compsToText(airport.competitors),
    tailwinds: newsToText(airport.tailwinds),
    sources: (airport.sources ?? []).join('\n'),
    confidence: (airport.confidence ?? '') as Confidence | '',
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function build(): Airport {
    const handlers = textToHandlers(f.handlers)
    const comps = textToComps(f.competitors)
    const news = textToNews(f.tailwinds)
    const sources = linesToArr(f.sources)
    return {
      ...airport,
      owner: f.owner.trim() || undefined,
      ownershipType: f.ownershipType,
      hubFor: f.hubFor.trim() ? f.hubFor.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      passengersAnnual: f.passengersAnnual ? Number(f.passengersAnnual) : undefined,
      passengersYear: f.passengersYear ? Number(f.passengersYear) : undefined,
      gseModel: f.gseModel,
      gseFleetEstimate: f.gseFleetEstimate.trim() || undefined,
      laborPressure: f.laborPressure,
      aerovectStatus: f.aerovectStatus,
      aerovectNotes: f.aerovectNotes.trim() || undefined,
      operationsNotes: f.operationsNotes.trim() || undefined,
      groundHandlers: handlers.length ? handlers : undefined,
      competitors: comps.length ? comps : undefined,
      tailwinds: news.length ? news : undefined,
      sources: sources.length ? sources : undefined,
      confidence: f.confidence || undefined,
      lastUpdated: todayIso(),
    }
  }

  return (
    <aside className="panel open">
      <div className="panel-scroll">
        <div className="panel-header">
          <button className="panel-close" onClick={onCancel} aria-label="Cancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="panel-codes">
            <span className="panel-code">{airport.iata ?? airport.icao}</span>
          </div>
          <h2 className="panel-title">Edit · {airport.name}</h2>
          <div className="panel-loc">Fill in Tier B intelligence. Unknown is fine.</div>
        </div>

        {/* AeroVect status + confidence */}
        <div className="form-section">
          <div className="section-title">Pipeline</div>
          <div className="form-two">
            <div className="form-row">
              <label>AeroVect status</label>
              <select value={f.aerovectStatus} onChange={(e) => set('aerovectStatus', e.target.value as AeroVectStatus)}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Confidence (Tier B)</label>
              <select value={f.confidence} onChange={(e) => set('confidence', e.target.value as Confidence | '')}>
                <option value="">-</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Account notes</label>
            <textarea value={f.aerovectNotes} onChange={(e) => set('aerovectNotes', e.target.value)} placeholder="Who's the buyer, warm bridges, next step…" />
          </div>
        </div>

        {/* Ground operations */}
        <div className="form-section">
          <div className="section-title">Ground Operations</div>
          <div className="form-two">
            <div className="form-row">
              <label>GSE model</label>
              <select value={f.gseModel} onChange={(e) => set('gseModel', e.target.value as GseModel)}>
                <option value="unknown">Unknown</option>
                <option value="carrier_led">Carrier-led</option>
                <option value="handler_led">Handler-led</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div className="form-row">
              <label>Labor pressure</label>
              <select value={f.laborPressure} onChange={(e) => set('laborPressure', e.target.value as LaborPressure)}>
                <option value="unknown">Unknown</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Est. GSE fleet</label>
            <input value={f.gseFleetEstimate} onChange={(e) => set('gseFleetEstimate', e.target.value)} placeholder="~300 tractors, or a note" />
          </div>
          <div className="form-row">
            <label>Ground handlers · one per line: Name | role | notes</label>
            <textarea value={f.handlers} onChange={(e) => set('handlers', e.target.value)} placeholder={'dnata | primary ramp handler | Emirates Group sister co.'} />
          </div>
          <div className="form-row">
            <label>Operations notes</label>
            <textarea value={f.operationsNotes} onChange={(e) => set('operationsNotes', e.target.value)} />
          </div>
        </div>

        {/* Competitors + tailwinds */}
        <div className="form-section">
          <div className="section-title">Competitors & Tailwinds</div>
          <div className="form-row">
            <label>Competitors · one per line: Vendor | status | source</label>
            <textarea value={f.competitors} onChange={(e) => set('competitors', e.target.value)} placeholder={'TractEasy | deployed | dnata DWC'} />
          </div>
          <div className="form-row">
            <label>Tailwinds / news · one per line: Headline | why it matters | url</label>
            <textarea value={f.tailwinds} onChange={(e) => set('tailwinds', e.target.value)} />
          </div>
        </div>

        {/* Ownership (Tier A) */}
        <div className="form-section">
          <div className="section-title">Ownership (Tier A)</div>
          <div className="form-row">
            <label>Owner / operator</label>
            <input value={f.owner} onChange={(e) => set('owner', e.target.value)} />
          </div>
          <div className="form-two">
            <div className="form-row">
              <label>Ownership type</label>
              <select value={f.ownershipType} onChange={(e) => set('ownershipType', e.target.value as OwnershipType)}>
                <option value="unknown">Unknown</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="sovereign">Sovereign</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div className="form-row">
              <label>Passengers (year)</label>
              <input value={f.passengersYear} onChange={(e) => set('passengersYear', e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div className="form-row">
            <label>Hubs for · comma separated</label>
            <input value={f.hubFor} onChange={(e) => set('hubFor', e.target.value)} placeholder="Emirates, flydubai" />
          </div>
          <div className="form-row">
            <label>Sources · one per line</label>
            <textarea value={f.sources} onChange={(e) => set('sources', e.target.value)} />
          </div>
        </div>

        <div className="export-note">
          <b>How this persists:</b> Save updates the live map in memory. To make it permanent,
          click <b>Download airports.json</b> and commit the file to the repo (it stays the source of
          truth). Every enrichment stamps today's date automatically.
        </div>
      </div>

      <div className="panel-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn ghost" onClick={onCancel} style={{ flex: '1 1 30%' }}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => onSave(build())} style={{ flex: '1 1 30%' }}>
          Save to map
        </button>
        <button className="btn" onClick={() => onExport(build())} style={{ flex: '1 1 45%' }}>
          Download airports.json
        </button>
        <button className="btn" onClick={() => onCopy(build())} style={{ flex: '1 1 45%' }}>
          Copy JSON
        </button>
      </div>
    </aside>
  )
}
