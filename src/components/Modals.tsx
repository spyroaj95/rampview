/** Shortcuts (?) and About/credits (A3) modals. */

interface ModalProps {
  onClose: () => void
}

export function ShortcutsOverlay({ onClose }: ModalProps) {
  const rows: [string, string][] = [
    ['/', 'Focus search'],
    ['Esc', 'Close panel / modal / exit walkthrough'],
    ['i', 'Toggle the instrument panel'],
    ['← →', 'Cycle airports by opportunity score, fly to each'],
    ['g p b n w c', 'Switch view: Globe, Pipeline, Board, Network, Whitespace, Coverage'],
    ['?', 'Show this overlay'],
  ]
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        {rows.map(([k, desc]) => (
          <div className="kbd-row" key={k}>
            <span style={{ display: 'flex', gap: 4 }}>
              {k.split(' ').map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
            <span>{desc}</span>
          </div>
        ))}
        <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

export function AboutModal({ onClose }: ModalProps) {
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Data & credits</h3>
        <p>
          <b>RampView</b> is a go-to-market intelligence tool for AeroVect: autonomous driving
          software that retrofits existing airport ground-support tractors, sold as
          robotics-as-a-service.
        </p>
        <ul>
          <li>
            <b>Airport reference data:</b>{' '}
            <a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">
              OurAirports
            </a>{' '}
            (public domain): names, IATA/ICAO codes, coordinates, countries.
          </li>
          <li>
            <b>Passenger volumes:</b> recent ACI / airport-authority annual totals, curated in
            scripts/buildSeed.ts.
          </li>
          <li>
            <b>Owner, hub, and enrichment facts:</b> Wikipedia / Wikidata (CC BY-SA) and cited
            industry sources; every Tier B record lists its sources and confidence in the panel.
          </li>
          <li>
            <b>Globe textures:</b> NASA Visible Earth imagery via the three-globe example assets.
          </li>
          <li>
            <b>Engine:</b> react-globe.gl / three.js, React, Vite.
          </li>
        </ul>
        <p>
          Tier B intelligence (ground operations, competitors, deals) is researched, never
          fabricated: unknown stays visible until sourced. Pipeline and contact data is local-only
          and excluded from public builds.
        </p>
        <button className="btn" style={{ marginTop: 12, width: '100%' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
