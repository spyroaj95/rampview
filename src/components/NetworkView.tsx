import { useMemo, useState } from 'react'
import type { Airport } from '../types/airport'
import type { Deal, Bridge } from '../types/pipeline'
import { ORG_REGISTRY, airportsForOrg, orgByKey } from '../lib/orgs'
import { whitespaceCategory, WHITESPACE_COLORS } from '../lib/layers'

interface Props {
  airports: Airport[]
  deals: Deal[]
  bridges: Bridge[]
  selectedOrg: string | null
  onSelectOrg: (key: string | null) => void
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onAddBridge: (b: Bridge) => void
  onDownloadBridges: () => void
  /** globe-hovered airport (two-way linking) */
  highlightId?: string | null
}

/** NETWORK view: handler/carrier rollups + warm-bridge expansion arcs. */
export default function NetworkView(props: Props) {
  const { airports, deals, bridges, selectedOrg, onSelectOrg } = props
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.airportId, d])), [deals])
  const [adding, setAdding] = useState(false)
  const [bFrom, setBFrom] = useState('')
  const [bTo, setBTo] = useState('')
  const [bVia, setBVia] = useState('')
  const [bLabel, setBLabel] = useState('')
  const [bWhy, setBWhy] = useState('')
  const [bErr, setBErr] = useState('')

  const rollups = useMemo(
    () =>
      ORG_REGISTRY.map((org) => {
        const list = airportsForOrg(airports, org)
        let ours = 0
        let contested = 0
        let open = 0
        let unitsLive = 0
        let unitsTarget = 0
        for (const a of list) {
          const deal = dealsById.get(a.id)
          const cat = whitespaceCategory(a, deal)
          if (cat === 'ours' || cat === 'ours_contested') ours++
          else if (cat === 'contested') contested++
          else open++
          unitsLive += deal?.unitsLive ?? 0
          unitsTarget += deal?.unitsTarget ?? 0
        }
        return { org, list, ours, contested, open, unitsLive, unitsTarget }
      }).sort((a, b) => b.list.length - a.list.length),
    [airports, dealsById],
  )

  const active = selectedOrg ? rollups.find((r) => r.org.key === selectedOrg) : null
  const activeBridges = active
    ? bridges.filter(
        (b) =>
          b.via.toLowerCase().includes(active.org.name.toLowerCase().split(' ')[0].toLowerCase()) ||
          active.list.some((a) => a.id === b.from || a.id === b.to),
      )
    : bridges

  const submitBridge = () => {
    const from = bFrom.trim().toUpperCase()
    const to = bTo.trim().toUpperCase()
    if (!airports.some((a) => a.id === from) || !airports.some((a) => a.id === to)) {
      setBErr('FROM and TO must be IATA codes present in the dataset')
      return
    }
    if (!bVia.trim() || !bLabel.trim()) {
      setBErr('VIA and LABEL are required')
      return
    }
    props.onAddBridge({
      id: `${from}-${to}-${Date.now().toString(36)}`,
      from,
      to,
      via: bVia.trim(),
      label: bLabel.trim(),
      rationale: bWhy.trim() || 'Added in-app; add rationale before committing.',
    })
    setAdding(false)
    setBFrom('')
    setBTo('')
    setBVia('')
    setBLabel('')
    setBWhy('')
    setBErr('')
  }

  return (
    <div className="overlay-panel slim">
      <div className="overlay-head">
        <h3>Network</h3>
        <span className="spacer" />
        {selectedOrg && (
          <button className="minibtn" onClick={() => onSelectOrg(null)}>
            Clear
          </button>
        )}
        <button className="minibtn accent" onClick={props.onDownloadBridges}>
          Download bridges.json
        </button>
      </div>
      <div className="overlay-body">
        {/* rollup for the selected org */}
        {active && (
          <div className="rollup">
            <h4>{active.org.name}</h4>
            <div className="org-global" style={{ marginBottom: 10 }}>
              {active.org.global}
              {active.org.aligned ? ` · ${active.org.aligned}` : ''}
            </div>
            <div className="metrics">
              <div className="metric">
                <div className="metric-label">In RampView</div>
                <div className="metric-value">{active.list.length}</div>
              </div>
              <div className="metric">
                <div className="metric-label" style={{ color: WHITESPACE_COLORS.ours.color }}>
                  Ours
                </div>
                <div className="metric-value">{active.ours}</div>
              </div>
              <div className="metric">
                <div className="metric-label" style={{ color: WHITESPACE_COLORS.contested.color }}>
                  Contested
                </div>
                <div className="metric-value">{active.contested}</div>
              </div>
              <div className="metric">
                <div className="metric-label" style={{ color: WHITESPACE_COLORS.open.color }}>
                  Open
                </div>
                <div className="metric-value">{active.open}</div>
              </div>
            </div>
            <div className="org-global" style={{ marginTop: 10 }}>
              Units live / potential: <b>{active.unitsLive}</b> / <b>{active.unitsTarget}</b>
              {active.org.orgBridge ? ` · Bridge: ${active.org.orgBridge}` : ''}
            </div>
          </div>
        )}

        {/* org list */}
        {!active &&
          rollups.map((r) => (
            <button className="org-row" key={r.org.key} onClick={() => onSelectOrg(r.org.key)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="org-name">{r.org.name}</span>
                  <span className="org-kind">{r.org.kind.toUpperCase()}</span>
                </div>
                <div className="org-global">{r.org.global}</div>
              </div>
              <div className="org-counts">
                <span title="airports in RampView">
                  <b>{r.list.length}</b> apt
                </span>
                <span style={{ color: WHITESPACE_COLORS.ours.color }} title="ours">
                  {r.ours}
                </span>
                <span style={{ color: WHITESPACE_COLORS.contested.color }} title="contested">
                  {r.contested}
                </span>
                <span style={{ color: WHITESPACE_COLORS.open.color }} title="open">
                  {r.open}
                </span>
              </div>
            </button>
          ))}

        {/* airports of the selected org */}
        {active && (
          <>
            <div className="section-title" style={{ padding: '12px 16px 4px' }}>
              Stations in RampView
            </div>
            {active.list
              .sort((a, b) => (b.passengersAnnual ?? 0) - (a.passengersAnnual ?? 0))
              .map((a) => {
                const cat = whitespaceCategory(a, dealsById.get(a.id))
                const wc = WHITESPACE_COLORS[cat]
                return (
                  <button
                    key={a.id}
                    className={`org-row${props.highlightId === a.id ? ' rowhl' : ''}`}
                    onClick={() => props.onSelect(a.id)}
                    onMouseEnter={() => props.onHover(a.id)}
                    onMouseLeave={() => props.onHover(null)}
                  >
                    <span className="swatch" style={{ background: wc.color, width: 9, height: 9, borderRadius: '50%' }} />
                    <div>
                      <span className="org-name" style={{ fontSize: 12.5 }}>
                        {a.iata ?? a.id} · {a.name}
                      </span>
                      <div className="org-global">{wc.label}</div>
                    </div>
                  </button>
                )
              })}
          </>
        )}

        {/* bridges */}
        <div className="section-title" style={{ padding: '14px 16px 4px' }}>
          Warm bridges {active ? `· ${active.org.name}` : ''}
        </div>
        {activeBridges.map((b) => (
          <div
            className="bridge-row"
            key={b.id}
            onMouseEnter={() => props.onHover(b.to)}
            onMouseLeave={() => props.onHover(null)}
          >
            <div className="bridge-route">
              {b.from} → {b.to} <span style={{ color: 'var(--text-lo)' }}>via {b.via}</span>
            </div>
            <div className="bridge-label">{b.label}</div>
            <div className="bridge-rationale">{b.rationale}</div>
          </div>
        ))}
        {activeBridges.length === 0 && (
          <div className="unknown-hint" style={{ padding: '8px 16px' }}>
            No bridges recorded for this org yet
          </div>
        )}

        {/* add bridge */}
        <div style={{ padding: '12px 16px 20px' }}>
          {adding ? (
            <div>
              <div className="form-two">
                <div className="form-row">
                  <label>From (IATA)</label>
                  <input value={bFrom} onChange={(e) => setBFrom(e.target.value)} placeholder="DXB" />
                </div>
                <div className="form-row">
                  <label>To (IATA)</label>
                  <input value={bTo} onChange={(e) => setBTo(e.target.value)} placeholder="AUH" />
                </div>
              </div>
              <div className="form-two">
                <div className="form-row">
                  <label>Via (org)</label>
                  <input value={bVia} onChange={(e) => setBVia(e.target.value)} placeholder="dnata" />
                </div>
                <div className="form-row">
                  <label>Label</label>
                  <input value={bLabel} onChange={(e) => setBLabel(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <label>Rationale</label>
                <input value={bWhy} onChange={(e) => setBWhy(e.target.value)} />
              </div>
              {bErr && <div className="err" style={{ color: '#ff8494', fontSize: 12, marginBottom: 8 }}>{bErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="minibtn accent" onClick={submitBridge}>
                  Add bridge
                </button>
                <button className="minibtn" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="minibtn" onClick={() => setAdding(true)}>
              + Add warm bridge
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
