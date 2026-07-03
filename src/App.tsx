import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Airport } from './types/airport'
import type { Deal, DealStage, Bridge } from './types/pipeline'
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
import {
  loadPipeline,
  loadBridges,
  upsertDeal,
  serializePipeline,
  serializeBridges,
  computePipelineMetrics,
} from './services/pipelineService'
import { opportunityScore, type ScoreInfo } from './lib/scoring'
import { layerColor, whitespaceCategory, type LayerKey } from './lib/layers'
import { ORG_REGISTRY, orgByKey, airportsForOrg } from './lib/orgs'
import { gateRequired } from './lib/gate'
import { targetListCsv, downloadText, openAccountBrief } from './lib/exports'
import { DEFAULT_ASSUMPTIONS, derivedDealValue, type ValueAssumptions } from './lib/valueModel'
import { saveWorkspace, loadWorkspace, clearWorkspace, parsePipelineImport } from './services/workspaceService'
import { todayIso, money } from './lib/format'
import type { DemoStep, DemoCtx } from './lib/demoScript'
import digestRaw from './data/newsDigest.json'

import GlobeView, { type ArcDatum } from './components/GlobeView'
import TopBar, { type ViewKey, type WhatsNewItem } from './components/TopBar'
import FilterBar from './components/FilterBar'
import Legend from './components/Legend'
import DetailPanel, { type PanelTab } from './components/DetailPanel'
import EditForm from './components/EditForm'
import LayerToggle from './components/LayerToggle'
import PipelineTable from './components/PipelineTable'
import BoardView from './components/BoardView'
import NetworkView from './components/NetworkView'
import WhitespacePanel from './components/WhitespacePanel'
import CoverageView from './components/CoverageView'
import DemoMode from './components/DemoMode'
import PassGate from './components/PassGate'
import { ShortcutsOverlay, AboutModal } from './components/Modals'
import WorkspaceModal from './components/WorkspaceModal'

const ARC_COLOR = '#14b8a6'
const NEWS_SEEN_KEY = 'rv_news_seen'

// ---- deep-link permalinks: ?a=DXB&layer=competitor&view=network ----
const VIEW_KEYS = ['globe', 'pipeline', 'board', 'network', 'whitespace', 'coverage'] as const
const LAYER_KEYS = ['status', 'score', 'competitor', 'confidence'] as const

function urlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}
function initialView(): ViewKey {
  const v = urlParam('view')
  return VIEW_KEYS.includes(v as ViewKey) ? (v as ViewKey) : 'globe'
}
function initialLayer(): LayerKey {
  const l = urlParam('layer')
  return LAYER_KEYS.includes(l as (typeof LAYER_KEYS)[number]) ? (l as LayerKey) : 'status'
}
// Captured once at load: the permalink writer rewrites the URL as soon as the
// app mounts, which would otherwise race the async airport load for ?a=.
const INITIAL_AIRPORT = urlParam('a')?.toUpperCase() ?? null

interface Digest {
  ranAt: string | null
  items: WhatsNewItem[]
}

/** Error boundary so a WebGL/driver failure degrades gracefully (A4). */
class GlobeBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    // Dismiss the loading overlay: onGlobeReady will never fire if the
    // renderer threw, and the fallback + data views must stay reachable.
    this.props.onError?.()
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="error-fallback">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Globe failed to render
            </div>
            <p style={{ color: 'var(--text-lo)', fontSize: 13 }}>
              This usually means WebGL is unavailable. The data views still work.
            </p>
            <button className="btn" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // ---- data ----
  const [airports, setAirports] = useState<Airport[] | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [sampleCrm, setSampleCrm] = useState(true)
  const [assumptions, setAssumptions] = useState<ValueAssumptions>(DEFAULT_ASSUMPTIONS)

  // ---- ui state (view/layer restore from the permalink) ----
  const [view, setView] = useState<ViewKey>(initialView)
  const [layer, setLayer] = useState<LayerKey>(initialLayer)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelTab, setPanelTab] = useState<PanelTab>('intel')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [demoOn, setDemoOn] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [globeReady, setGlobeReady] = useState(false)
  // C1 gate: engages only when this build carries REAL CRM data (see gate.ts).
  // Public deploys run on the committed sample, so founders are never locked out.
  const [gateDismissed, setGateDismissed] = useState(false)
  const [narrow, setNarrow] = useState(window.innerWidth < 900)

  // ---- dirty tracking (C4) ----
  const [airportsDirty, setAirportsDirty] = useState(false)
  const [pipelineDirty, setPipelineDirty] = useState(false)
  const [bridgesDirty, setBridgesDirty] = useState(false)
  const dirty = airportsDirty || pipelineDirty || bridgesDirty

  const searchRef = useRef<HTMLInputElement>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showWorkspace, setShowWorkspace] = useState(false)

  const hydratedRef = useRef(false)
  useEffect(() => {
    Promise.all([loadAirports(), loadPipeline(), loadBridges()]).then(([list, p, b]) => {
      // Autosaved workspace (P4) overlays the committed data. Airports are only
      // ever in the snapshot if the user edited them in-app.
      const w = loadWorkspace()
      const airportsFinal = w?.airports ?? list
      setAirports(airportsFinal)
      setDeals(w?.deals ?? p.deals)
      setBridges(w?.bridges ?? b)
      if (w?.assumptions) setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...w.assumptions })
      setSampleCrm(p.sample)
      if (w) {
        setSavedAt(w.savedAt)
        if (w.airports) setAirportsDirty(true)
        flash(`Workspace restored from autosave (${new Date(w.savedAt).toLocaleString()})`)
      }
      // Permalink airport (?a=DXB): apply once the dataset is in.
      if (INITIAL_AIRPORT && airportsFinal.some((x) => x.id === INITIAL_AIRPORT)) {
        setSelectedId(INITIAL_AIRPORT)
        setPanelOpen(true)
      }
      hydratedRef.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced autosave (P4): every edit lands in localStorage within a second.
  useEffect(() => {
    if (!hydratedRef.current) return
    const t = window.setTimeout(() => {
      const at = saveWorkspace({
        deals,
        bridges,
        assumptions,
        ...(airportsDirty && airports ? { airports } : {}),
      })
      if (at) setSavedAt(at)
    }, 800)
    return () => window.clearTimeout(t)
  }, [deals, bridges, assumptions, airports, airportsDirty])

  // Permalink writer: keep ?a / ?layer / ?view in the URL so a shared link
  // opens exactly where the conversation ended. replaceState = no history spam.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (view === 'globe') p.delete('view')
    else p.set('view', view)
    if (layer === 'status') p.delete('layer')
    else p.set('layer', layer)
    if (selectedId) p.set('a', selectedId)
    else p.delete('a')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [view, layer, selectedId])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Hovered rows can unmount without firing onMouseLeave (view switch, demo
  // start, board drag-drop); clear the highlight so no phantom ring lingers.
  useEffect(() => {
    setHighlightId(null)
  }, [view, demoOn])

  // Warn on navigating away with unsaved edits (C4). Reset uses the skip ref
  // so its intentional reload does not trip the warning.
  const skipUnloadRef = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      if (skipUnloadRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }, [])

  // ---- derived data ----
  const list = airports ?? []
  const byId = useMemo(() => new Map(list.map((a) => [a.id, a])), [list])
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.airportId, d])), [deals])
  const stats = useMemo(() => computeStats(list), [list])
  const regions = useMemo(() => getRegions(list), [list])
  const handlers = useMemo(() => getHandlers(list), [list])

  const scores = useMemo(() => {
    const m = new Map<string, ScoreInfo>()
    for (const a of list) m.set(a.id, opportunityScore(a, bridges))
    return m
  }, [list, bridges])
  const scoreOf = useCallback(
    (a: Airport) => scores.get(a.id) ?? { score: 0, components: [] },
    [scores],
  )
  const dealOf = useCallback((a: Airport) => dealsById.get(a.id), [dealsById])

  // Deal value DERIVES from the RaaS value model (units x fee) whenever a deal
  // has unitsTarget; stored values are only a fallback. Display/metric views
  // consume these; edits always operate on the raw deals so no derived number
  // ever gets baked into saved JSON.
  const effectiveDeals = useMemo(
    () =>
      deals.map((d) => ({
        ...d,
        value: derivedDealValue(d.unitsTarget, d.value, assumptions).value,
      })),
    [deals, assumptions],
  )

  // Whitespace view forces its own encoding; everywhere else the toggle rules.
  const effectiveLayer: LayerKey = view === 'whitespace' ? 'whitespace' : layer
  const colorFor = useCallback(
    (a: Airport) => layerColor(effectiveLayer, a, scores.get(a.id), dealsById.get(a.id)),
    [effectiveLayer, scores, dealsById],
  )

  // Visible points: filters + view-specific narrowing (org highlight, only-open).
  const visibleIds = useMemo(() => {
    let base = filterAirports(list, filters)
    if (view === 'network' && selectedOrg) {
      const org = orgByKey(selectedOrg)
      if (org) {
        const ids = new Set(airportsForOrg(list, org).map((a) => a.id))
        base = base.filter((a) => ids.has(a.id))
      }
    }
    if (view === 'whitespace' && onlyOpen) {
      base = base.filter((a) => whitespaceCategory(a, dealsById.get(a.id)) === 'open')
    }
    return new Set(base.map((a) => a.id))
  }, [list, filters, view, selectedOrg, onlyOpen, dealsById])

  // Expansion arcs: network view (all, or the selected org's) and demo network steps.
  const arcs: ArcDatum[] = useMemo(() => {
    if (view !== 'network') return []
    let show = bridges
    if (selectedOrg) {
      const org = orgByKey(selectedOrg)
      if (org) {
        const ids = new Set(airportsForOrg(list, org).map((a) => a.id))
        show = bridges.filter(
          (b) => org.pattern.test(b.via) || ids.has(b.from) || ids.has(b.to),
        )
      }
    }
    return show
      .map((b) => {
        const f = byId.get(b.from)
        const t = byId.get(b.to)
        if (!f || !t) return null
        return {
          startLat: f.lat,
          startLng: f.lng,
          endLat: t.lat,
          endLng: t.lng,
          label: `${b.label}: ${b.rationale}`,
          color: ARC_COLOR,
        }
      })
      .filter(Boolean) as ArcDatum[]
  }, [view, bridges, selectedOrg, byId, list])

  const selected = selectedId ? byId.get(selectedId) ?? null : null

  // ---- selection / navigation ----
  const select = useCallback((id: string) => {
    setSelectedId(id)
    setPanelOpen(true)
    setEditing(false)
  }, [])

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setEditing(false)
  }, [])

  /** Arrow keys: cycle the filtered set by opportunity score (A1). */
  const cycle = useCallback(
    (dir: 1 | -1) => {
      const ranked = list
        .filter((a) => visibleIds.has(a.id))
        .sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0))
      if (!ranked.length) return
      const idx = ranked.findIndex((a) => a.id === selectedId)
      const next = idx === -1 ? ranked[0] : ranked[(idx + dir + ranked.length) % ranked.length]
      select(next.id)
    },
    [list, visibleIds, scores, selectedId, select],
  )

  // ---- demo mode (A2/C3) ----
  // Live aggregates for the quantified finale (P5): open handler-led hubs,
  // units in pipe, modeled ARR from the value model, and the top open account.
  const demoCtx: DemoCtx = useMemo(() => {
    const openList = list.filter((a) => whitespaceCategory(a, dealsById.get(a.id)) === 'open')
    const openHandlerLedHubs = openList.filter((a) => a.gseModel === 'handler_led').length
    const metrics = computePipelineMetrics(effectiveDeals, todayIso())
    const unitsInPipe = metrics.unitsTarget
    const modeledArr = money(unitsInPipe * assumptions.raasFeePerUnitYear)
    const top = [...openList].sort((x, y) => (scores.get(y.id)?.score ?? 0) - (scores.get(x.id)?.score ?? 0))[0]
    const topBridge = top ? bridges.find((b) => b.from === top.id || b.to === top.id) : undefined
    return {
      openHandlerLedHubs,
      unitsInPipe,
      modeledArr,
      topAccount: top
        ? {
            iata: top.iata ?? top.id,
            why: topBridge
              ? `Score ${scores.get(top.id)?.score ?? 0}/100. ${topBridge.rationale}`
              : `Score ${scores.get(top.id)?.score ?? 0}/100 on volume, labor, and open whitespace.`,
          }
        : { iata: 'ATL', why: 'Highest-scoring open account.' },
    }
  }, [list, dealsById, effectiveDeals, assumptions, scores, bridges])

  const applyDemoStep = useCallback(
    (step: DemoStep) => {
      setEditing(false)
      setShowShortcuts(false)
      setShowAbout(false)
      setView(step.view === 'network' ? 'network' : step.view === 'whitespace' ? 'whitespace' : step.view === 'coverage' ? 'coverage' : 'globe')
      if (step.layer) setLayer(step.layer)
      setSelectedOrg(step.orgKey ?? null)
      const target = step.airportId === '$TOP' ? demoCtx.topAccount.iata : step.airportId
      setSelectedId(target ?? null)
      setPanelOpen(step.panel ?? false)
      setPanelTab('intel')
    },
    [demoCtx],
  )

  const exitDemo = useCallback(() => {
    setDemoOn(false)
    setView('globe')
    setLayer('status')
    setSelectedOrg(null)
    setSelectedId(null)
  }, [])

  // ---- keyboard shortcuts (A1) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
      if (e.key === 'Escape') {
        if (typing) {
          ;(t as HTMLInputElement).blur()
          return
        }
        if (demoOn) exitDemo()
        else if (showShortcuts) setShowShortcuts(false)
        else if (showAbout) setShowAbout(false)
        else if (editing) setEditing(false)
        else if (selectedId) closePanel()
        return
      }
      // The walkthrough owns the stage: no view/selection shortcuts mid-demo.
      if (demoOn) return
      if (typing) return
      if (e.key === '?') {
        setShowShortcuts((s) => !s)
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'i') {
        if (selectedId) setPanelOpen((p) => !p)
      } else if (e.key === 'ArrowRight') {
        cycle(1)
      } else if (e.key === 'ArrowLeft') {
        cycle(-1)
      } else if (e.key === 'g') setView('globe')
      else if (e.key === 'p') setView('pipeline')
      else if (e.key === 'b') setView('board')
      else if (e.key === 'n') setView('network')
      else if (e.key === 'w') setView('whitespace')
      else if (e.key === 'c') setView('coverage')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [demoOn, showShortcuts, showAbout, editing, selectedId, closePanel, cycle, exitDemo])

  // ---- mutations ----
  const handleSaveAirport = useCallback(
    (next: Airport) => {
      setAirports((prev) => upsertAirport(prev ?? [], next))
      setAirportsDirty(true)
      setEditing(false)
      flash(`Saved ${next.iata ?? next.name} to the map`)
    },
    [flash],
  )

  const handleExportAirports = useCallback(
    (next: Airport) => {
      const updated = upsertAirport(airports ?? [], next)
      setAirports(updated)
      downloadText('airports.json', serializeAirports(updated), 'application/json')
      setAirportsDirty(false)
      flash('Downloaded airports.json, commit it to persist')
    },
    [airports, flash],
  )

  const handleCopyAirports = useCallback(
    (next: Airport) => {
      const updated = upsertAirport(airports ?? [], next)
      setAirports(updated)
      navigator.clipboard?.writeText(serializeAirports(updated)).then(
        () => flash('Copied full airports.json to clipboard'),
        () => flash('Clipboard blocked, use Download instead'),
      )
    },
    [airports, flash],
  )

  const handleUpsertDeal = useCallback((deal: Deal) => {
    setDeals((prev) => upsertDeal(prev, deal))
    setPipelineDirty(true)
  }, [])

  const handleStageChange = useCallback(
    (airportId: string, stage: DealStage) => {
      setHighlightId(null) // the dragged card unmounts; avoid a stale hover ring
      const deal = deals.find((d) => d.airportId === airportId)
      if (!deal || deal.stage === stage) return
      handleUpsertDeal({
        ...deal,
        stage,
        lastTouch: todayIso(),
        activity: [
          ...deal.activity,
          {
            id: `act-${Date.now().toString(36)}`,
            date: todayIso(),
            type: 'milestone',
            summary: `Stage changed to ${stage.replace(/_/g, ' ')}`,
          },
        ],
      })
      flash(`${airportId} moved to ${stage.replace(/_/g, ' ')}`)
    },
    [deals, handleUpsertDeal, flash],
  )

  const downloadPipeline = useCallback(() => {
    downloadText('pipeline.json', serializePipeline(deals, sampleCrm), 'application/json')
    setPipelineDirty(false)
    flash('Downloaded pipeline.json, keep it local (gitignored)')
  }, [deals, sampleCrm, flash])

  const copyPipeline = useCallback(() => {
    navigator.clipboard?.writeText(serializePipeline(deals, sampleCrm)).then(
      () => flash('Copied pipeline.json to clipboard'),
      () => flash('Clipboard blocked, use Download instead'),
    )
  }, [deals, sampleCrm, flash])

  const handleAddBridge = useCallback(
    (b: Bridge) => {
      setBridges((prev) => [...prev, b])
      setBridgesDirty(true)
      flash(`Bridge ${b.from} → ${b.to} added`)
    },
    [flash],
  )

  const downloadBridges = useCallback(() => {
    downloadText('bridges.json', serializeBridges(bridges), 'application/json')
    setBridgesDirty(false)
    flash('Downloaded bridges.json, commit it to persist')
  }, [bridges, flash])

  // ---- workspace import / reset (P4) ----
  const handleImportPipeline = useCallback(
    (text: string): string | null => {
      const res = parsePipelineImport(text, new Set(list.map((a) => a.id)))
      if ('error' in res) return res.error
      setDeals(res.deals)
      setPipelineDirty(true)
      setSampleCrm(false) // imported data is the user's own, not the dummy sample
      setGateDismissed(true) // the importer evidently possesses the data
      flash(`Imported ${res.deals.length} deals`)
      return null
    },
    [list, flash],
  )

  const handleResetWorkspace = useCallback(() => {
    clearWorkspace()
    skipUnloadRef.current = true
    window.location.reload()
  }, [])

  const downloadAirportsNow = useCallback(() => {
    if (!airports) return
    downloadText('airports.json', serializeAirports(airports), 'application/json')
    setAirportsDirty(false)
    flash('Downloaded airports.json, commit it to persist')
  }, [airports, flash])

  // Gate engages only against real CRM data; the sample-data demo stays open.
  const gateLocked = !gateDismissed && gateRequired(!sampleCrm)

  const exportCsv = useCallback(
    (items: { airport: Airport }[] | Airport[]) => {
      const arr = (items as any[]).map((x) => (x.airport ? x.airport : x)) as Airport[]
      // C1: deal columns (owner, next step, units) stay behind the gate.
      const dealCol = gateLocked ? () => undefined : dealOf
      downloadText('rampview_targets.csv', targetListCsv(arr, scoreOf, dealCol), 'text/csv')
      flash(gateLocked ? `Exported ${arr.length} rows (deal columns locked)` : `Exported ${arr.length} rows to CSV`)
    },
    [scoreOf, dealOf, flash, gateLocked],
  )

  const openBrief = useCallback(() => {
    if (!selected) return
    // C1: the brief carries buying-committee and deal intel only when unlocked.
    openAccountBrief(selected, gateLocked ? undefined : dealOf(selected), scoreOf(selected), bridges)
  }, [selected, dealOf, scoreOf, bridges, gateLocked])

  // ---- what's new (B5) ----
  const digest = digestRaw as Digest
  const [newsSeenAt, setNewsSeenAt] = useState<string | null>(() => localStorage.getItem(NEWS_SEEN_KEY))
  const whatsNewUnread = digest.ranAt && digest.ranAt !== newsSeenAt ? digest.items.length : 0
  const markNewsSeen = useCallback(() => {
    if (digest.ranAt) {
      localStorage.setItem(NEWS_SEEN_KEY, digest.ranAt)
      setNewsSeenAt(digest.ranAt)
    }
  }, [digest.ranAt])

  // ---- render ----
  if (!airports) {
    return (
      <div className="app">
        <div className="loading-overlay">
          <div className="loading-box">
            <div className="ring" />
            INITIALIZING RAMPVIEW
          </div>
        </div>
      </div>
    )
  }

  const overlayView = view === 'pipeline' || view === 'board' || view === 'coverage'
  const showLegend = view === 'globe' || view === 'whitespace' || view === 'network'
  const gatedViewLocked = (view === 'pipeline' || view === 'board') && gateLocked

  return (
    <div className="app">
      {narrow && <div className="desktop-banner">RAMPVIEW IS BUILT FOR DESKTOP PRESENTATION</div>}

      <GlobeBoundary onError={() => setGlobeReady(true)}>
        <GlobeView
          airports={list}
          visibleIds={visibleIds}
          selectedId={selectedId}
          highlightId={highlightId}
          onSelect={select}
          onHover={setHighlightId}
          colorFor={colorFor}
          arcs={arcs}
          onReady={() => setGlobeReady(true)}
        />
      </GlobeBoundary>
      <div className="vignette" />

      <div className={`loading-overlay${globeReady ? ' done' : ''}`}>
        <div className="loading-box">
          <img src="./aerovect-logo-white.png" alt="AeroVect" style={{ height: 34, marginBottom: 22, opacity: 0.92 }} />
          <div className="ring" />
          INITIALIZING RAMPVIEW
        </div>
      </div>

      {!demoOn && (
        <TopBar
          airports={list}
          stats={stats}
          view={view}
          onView={setView}
          gateLocked={gateLocked}
          query={searchQuery}
          onQuery={setSearchQuery}
          onSelect={(id) => {
            select(id)
            setSearchQuery('')
          }}
          searchRef={searchRef}
          dirty={dirty}
          savedAt={savedAt}
          onWorkspace={() => setShowWorkspace(true)}
          onPlayDemo={() => setDemoOn(true)}
          whatsNew={digest.items}
          whatsNewUnread={whatsNewUnread}
          onWhatsNewOpen={markNewsSeen}
          sample={sampleCrm}
          onAbout={() => setShowAbout(true)}
        />
      )}

      {!demoOn && (view === 'globe' || view === 'whitespace') && (
        <FilterBar filters={filters} onChange={setFilters} regions={regions} handlers={handlers} />
      )}

      {/* empty state (A4) */}
      {view === 'globe' && visibleIds.size === 0 && (
        <div className="empty-float">
          <div className="eyebrow">No airports match</div>
          <button
            className="minibtn accent"
            onClick={() => setFilters({ ...EMPTY_FILTERS })}
          >
            Clear filters
          </button>
        </div>
      )}

      {showLegend && (
        <Legend
          airports={list}
          layer={effectiveLayer}
          scoreOf={(a) => scores.get(a.id)}
          dealOf={dealOf}
          right={view !== 'globe'}
        />
      )}

      {view === 'globe' && !demoOn && <LayerToggle layer={layer} onChange={setLayer} />}

      {/* ---------- view overlays ---------- */}
      {!demoOn && view === 'pipeline' && (
        gatedViewLocked ? (
          <div className="overlay-panel slim">
            <div className="overlay-head"><h3>Pipeline</h3></div>
            <PassGate what="The pipeline view" onUnlocked={() => setGateDismissed(true)} />
          </div>
        ) : (
          <PipelineTable
            deals={effectiveDeals}
            airportsById={byId}
            scoreOf={scoreOf}
            regions={regions}
            onSelect={select}
            onHover={setHighlightId}
            onExportCsv={exportCsv}
            onDownloadPipeline={downloadPipeline}
            highlightId={highlightId}
          />
        )
      )}

      {!demoOn && view === 'board' && (
        gatedViewLocked ? (
          <div className="overlay-panel slim">
            <div className="overlay-head"><h3>Board</h3></div>
            <PassGate what="The board view" onUnlocked={() => setGateDismissed(true)} />
          </div>
        ) : (
          <BoardView
            deals={effectiveDeals}
            airportsById={byId}
            onStageChange={handleStageChange}
            onSelect={select}
            onHover={setHighlightId}
          />
        )
      )}

      {view === 'network' && !demoOn && (
        <NetworkView
          airports={list}
          deals={effectiveDeals}
          bridges={bridges}
          selectedOrg={selectedOrg}
          onSelectOrg={setSelectedOrg}
          onSelect={select}
          onHover={setHighlightId}
          onAddBridge={handleAddBridge}
          onDownloadBridges={downloadBridges}
          highlightId={highlightId}
        />
      )}

      {view === 'whitespace' && !demoOn && (
        <WhitespacePanel
          airports={filterAirports(list, filters)}
          dealOf={dealOf}
          scoreOf={scoreOf}
          onlyOpen={onlyOpen}
          onOnlyOpen={setOnlyOpen}
          onSelect={select}
          onHover={setHighlightId}
          onExportCsv={exportCsv}
          highlightId={highlightId}
        />
      )}

      {view === 'coverage' && !demoOn && (
        <CoverageView airports={list} scoreOf={scoreOf} onSelect={select} onHover={setHighlightId} />
      )}

      {/* ---------- right instrument panel ---------- */}
      {editing && selected ? (
        <EditForm
          airport={selected}
          onSave={handleSaveAirport}
          onCancel={() => setEditing(false)}
          onExport={handleExportAirports}
          onCopy={handleCopyAirports}
        />
      ) : (
        <DetailPanel
          airport={panelOpen ? selected : null}
          deal={selected ? dealOf(selected) : undefined}
          scoreInfo={selected ? scoreOf(selected) : undefined}
          sample={sampleCrm}
          tab={panelTab}
          onTab={setPanelTab}
          pipelineLocked={gateLocked}
          onUnlocked={() => setGateDismissed(true)}
          assumptions={assumptions}
          onAssumptions={setAssumptions}
          onClose={closePanel}
          onEdit={() => setEditing(true)}
          onBrief={openBrief}
          onUpsertDeal={handleUpsertDeal}
          onDownloadPipeline={downloadPipeline}
          onCopyPipeline={copyPipeline}
        />
      )}

      {demoOn && <DemoMode applyStep={applyDemoStep} onExit={exitDemo} ctx={demoCtx} />}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showWorkspace && (
        <WorkspaceModal
          savedAt={savedAt}
          dirty={{ airports: airportsDirty, pipeline: pipelineDirty, bridges: bridgesDirty }}
          onDownloadAirports={downloadAirportsNow}
          onDownloadPipeline={downloadPipeline}
          onDownloadBridges={downloadBridges}
          onImportPipeline={handleImportPipeline}
          onReset={handleResetWorkspace}
          onClose={() => setShowWorkspace(false)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {overlayView && null}
    </div>
  )
}
