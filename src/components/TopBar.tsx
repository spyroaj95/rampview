import { useEffect, useRef, useState } from 'react'
import type { Airport } from '../types/airport'
import type { Stats } from '../services/dataService'
import { searchAirports } from '../services/dataService'
import { STATUS_META } from '../lib/statusMeta'

export type ViewKey = 'globe' | 'pipeline' | 'board' | 'network' | 'whitespace' | 'coverage'

export const VIEW_ORDER: { key: ViewKey; label: string; gated?: boolean }[] = [
  { key: 'globe', label: 'GLOBE' },
  { key: 'pipeline', label: 'PIPELINE', gated: true },
  { key: 'board', label: 'BOARD', gated: true },
  { key: 'network', label: 'NETWORK' },
  { key: 'whitespace', label: 'WHITESPACE' },
  { key: 'coverage', label: 'COVERAGE' },
]

export interface WhatsNewItem {
  airportId?: string
  topic?: string
  headline: string
  url?: string
  date?: string
  relevance?: string
}

interface Props {
  airports: Airport[]
  stats: Stats
  view: ViewKey
  onView: (v: ViewKey) => void
  gateLocked: boolean
  query: string
  onQuery: (q: string) => void
  onSelect: (id: string) => void
  searchRef: React.RefObject<HTMLInputElement>
  dirty: boolean
  onDownloadAll: () => void
  onPlayDemo: () => void
  whatsNew: WhatsNewItem[]
  whatsNewUnread: number
  onWhatsNewOpen: () => void
  sample: boolean
  onAbout: () => void
}

/**
 * Top bar: brand (AeroVect logo slot), view switcher, live stats, search,
 * walkthrough, What's New, unsaved badge. Instrument styling: monochrome + cyan.
 */
export default function TopBar(props: Props) {
  const { airports, stats, view, query } = props
  const [open, setOpen] = useState(false)
  const [wnOpen, setWnOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const wnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
      if (wnRef.current && !wnRef.current.contains(e.target as Node)) setWnOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = query.trim() ? searchAirports(airports, query).slice(0, 8) : []

  const statItems: { label: string; value: number; color?: string }[] = [
    { label: 'Airports', value: stats.total },
    { label: 'Customers', value: stats.customers, color: STATUS_META.customer.color },
    { label: 'Pilots', value: stats.pilots, color: STATUS_META.pilot.color },
    { label: 'Targets', value: stats.activeTargets, color: STATUS_META.active_target.color },
    { label: 'Comp-held', value: stats.competitorHeld, color: STATUS_META.competitor_held.color },
  ]

  return (
    <div className="topbar">
      <div className="brand">
        {/* --- AeroVect logo slot: replace this block with the real mark --- */}
        <div className="brand-logo" title="AeroVect logo slot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">
            Ramp<em>View</em>
          </div>
          <div className="brand-sub">AEROVECT · GTM INTELLIGENCE</div>
        </div>
      </div>

      {/* view switcher */}
      <div className="viewbar" role="tablist" aria-label="Views">
        {VIEW_ORDER.map((v) => (
          <button
            key={v.key}
            className={`viewtab${view === v.key ? ' active' : ''}${v.gated && props.gateLocked ? ' locked' : ''}`}
            onClick={() => props.onView(v.key)}
            role="tab"
            aria-selected={view === v.key}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="stats" role="group" aria-label="Pipeline statistics">
        {statItems.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-value">
              {s.color && <span className="stat-dot" style={{ background: s.color }} />}
              {s.value}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="topbar-spacer" />

      {props.sample && (
        <span className="sample-badge" title="Pipeline is running on the committed sample file with dummy contacts. Create src/data/pipeline.json locally for real data.">
          SAMPLE CRM
        </span>
      )}

      {props.dirty && (
        <button className="minibtn warn unsaved" onClick={props.onDownloadAll} title="You have unsaved edits. Download the updated JSON files and commit them (airports/bridges) or keep them local (pipeline).">
          ● UNSAVED · DOWNLOAD
        </button>
      )}

      <div ref={wnRef} style={{ position: 'relative' }}>
        <button
          className="minibtn"
          style={{ position: 'relative' }}
          onClick={() => {
            setWnOpen(!wnOpen)
            if (!wnOpen) props.onWhatsNewOpen()
          }}
          title="Latest tailwinds found by the news-refresh agents"
        >
          WHAT'S NEW
          {props.whatsNewUnread > 0 && <span className="badge-dot">{props.whatsNewUnread}</span>}
        </button>
        {wnOpen && (
          <div className="whatsnew-pop" style={{ position: 'absolute', top: 42, right: 0 }}>
            {props.whatsNew.length === 0 && (
              <div className="wn-item" style={{ cursor: 'default' }}>
                <div className="wn-meta">No news-refresh run yet. Run: npm run news:plan, research, then npm run news:merge.</div>
              </div>
            )}
            {props.whatsNew.map((n, i) => (
              <button
                key={i}
                className="wn-item"
                onClick={() => {
                  if (n.airportId) props.onSelect(n.airportId)
                  setWnOpen(false)
                }}
              >
                <div className="wn-head">{n.headline}</div>
                <div className="wn-meta">
                  {n.airportId ?? n.topic ?? ''}
                  {n.date ? ` · ${n.date}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="minibtn accent" onClick={props.onPlayDemo} title="Hands-free walkthrough of the marquee accounts (~80s)">
        ▶ WALKTHROUGH
      </button>

      <button className="minibtn" onClick={props.onAbout} title="Data sources and attribution">
        ⓘ
      </button>

      <div className="search" ref={boxRef}>
        <span className="search-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={props.searchRef}
          value={query}
          placeholder="Search airport, IATA, city…  ( / )"
          onChange={(e) => {
            props.onQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {open && results.length > 0 && (
          <div className="search-results">
            {results.map((a) => (
              <button
                key={a.id}
                className="search-result"
                onClick={() => {
                  props.onSelect(a.id)
                  setOpen(false)
                }}
              >
                <span className="code">{a.iata ?? a.icao}</span>
                <span className="rname">{a.name}</span>
                <span className="rmeta">{a.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
