import { useEffect, useRef, useState } from 'react'
import type { Airport } from '../types/airport'
import type { Stats } from '../services/dataService'
import { searchAirports } from '../services/dataService'
import { STATUS_META } from '../lib/statusMeta'
import { compactNumber } from '../lib/format'

interface Props {
  airports: Airport[]
  stats: Stats
  query: string
  onQuery: (q: string) => void
  onSelect: (id: string) => void
}

/**
 * Top bar: brand (with a clearly marked logo slot to drop in AeroVect's mark),
 * the live stats strip, and search that flies the globe to a match.
 */
export default function TopBar({ airports, stats, query, onQuery, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
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

      <div className="stats" role="group" aria-label="Pipeline statistics">
        {statItems.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-value">
              {s.color && <span className="stat-dot" style={{ background: s.color }} />}
              {compactNumber(s.value) === '—' ? 0 : s.value}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="topbar-spacer" />

      <div className="search" ref={boxRef}>
        <span className="search-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={query}
          placeholder="Search airport, IATA, city, country…"
          onChange={(e) => {
            onQuery(e.target.value)
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
                  onSelect(a.id)
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
