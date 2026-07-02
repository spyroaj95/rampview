import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Airport } from './types/airport'
import {
  loadAirports,
  filterAirports,
  computeStats,
  getRegions,
  getHandlers,
  upsertAirport,
  serializeAirports,
  EMPTY_FILTERS,
  type FilterState,
} from './services/dataService'
import GlobeView from './components/GlobeView'
import TopBar from './components/TopBar'
import FilterBar from './components/FilterBar'
import Legend from './components/Legend'
import DetailPanel from './components/DetailPanel'
import EditForm from './components/EditForm'

export default function App() {
  const [airports, setAirports] = useState<Airport[] | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadAirports().then(setAirports)
  }, [])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400)
  }, [])

  // Escape closes edit, then panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (editing) setEditing(false)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, selectedId])

  const list = airports ?? []
  const stats = useMemo(() => computeStats(list), [list])
  const regions = useMemo(() => getRegions(list), [list])
  const handlers = useMemo(() => getHandlers(list), [list])
  const activeIds = useMemo(
    () => new Set(filterAirports(list, filters).map((a) => a.id)),
    [list, filters],
  )
  const selected = useMemo(
    () => list.find((a) => a.id === selectedId) ?? null,
    [list, selectedId],
  )

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setEditing(false)
  }, [])

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setEditing(false)
  }, [])

  // ---- edit / export handlers (all data access via dataService) ----
  const handleSave = useCallback(
    (next: Airport) => {
      setAirports((prev) => upsertAirport(prev ?? [], next))
      setEditing(false)
      flash(`Saved ${next.iata ?? next.name} to the map`)
    },
    [flash],
  )

  const downloadFile = (filename: string, contents: string) => {
    const blob = new Blob([contents], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = useCallback(
    (next: Airport) => {
      const updated = upsertAirport(airports ?? [], next)
      setAirports(updated)
      downloadFile('airports.json', serializeAirports(updated))
      flash('Downloaded airports.json — commit it to persist')
    },
    [airports, flash],
  )

  const handleCopy = useCallback(
    (next: Airport) => {
      const updated = upsertAirport(airports ?? [], next)
      setAirports(updated)
      navigator.clipboard?.writeText(serializeAirports(updated)).then(
        () => flash('Copied full airports.json to clipboard'),
        () => flash('Clipboard blocked — use Download instead'),
      )
    },
    [airports, flash],
  )

  if (!airports) {
    return (
      <div className="app">
        <div className="loading">Initializing RampView…</div>
      </div>
    )
  }

  return (
    <div className="app">
      <GlobeView airports={list} visibleIds={activeIds} selectedId={selectedId} onSelect={select} />
      <div className="vignette" />

      <TopBar
        airports={list}
        stats={stats}
        query={searchQuery}
        onQuery={setSearchQuery}
        onSelect={(id) => {
          select(id)
          setSearchQuery('')
        }}
      />

      <FilterBar filters={filters} onChange={setFilters} regions={regions} handlers={handlers} />

      <Legend airports={list} />

      {editing && selected ? (
        <EditForm
          airport={selected}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          onExport={handleExport}
          onCopy={handleCopy}
        />
      ) : (
        <DetailPanel airport={selected} onClose={closePanel} onEdit={() => setEditing(true)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
