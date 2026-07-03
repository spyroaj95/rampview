import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import type { Airport } from '../types/airport'
import { statusMeta } from '../lib/statusMeta'
import { compactNumber } from '../lib/format'

export interface ArcDatum {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  label: string
  color: string
}

interface Props {
  airports: Airport[]
  /** ids that pass the active filters; anything else is dimmed. */
  visibleIds: Set<string>
  selectedId: string | null
  /** hover-highlight from lists/tables (two-way linking) */
  highlightId: string | null
  onSelect: (id: string) => void
  /** globe hover back to the lists (the other half of two-way linking) */
  onHover: (id: string | null) => void
  /** active-layer color for a point (App owns the layer logic) */
  colorFor: (a: Airport) => string
  /** expansion arcs (network view / demo) */
  arcs: ArcDatum[]
  onReady: () => void
}

const MAX_PAX = 105_000_000

/** sqrt scale so a 100M-pax hub isn't 30x the area of a 3M field. */
function radiusFor(a: Airport): number {
  const p = a.passengersAnnual ?? 1_000_000
  return 0.18 + 0.62 * Math.sqrt(Math.min(p, MAX_PAX) / MAX_PAX)
}

function altitudeFor(a: Airport): number {
  const p = a.passengersAnnual ?? 1_000_000
  return 0.006 + 0.05 * (Math.min(p, MAX_PAX) / MAX_PAX)
}

export default function GlobeView({
  airports,
  visibleIds,
  selectedId,
  highlightId,
  onSelect,
  onHover,
  colorFor,
  arcs,
  onReady,
}: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const interactingRef = useRef(false)
  const resumeTimer = useRef<number | undefined>(undefined)

  // Track container size for a crisp full-viewport canvas.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // One-time controls setup: slow auto-rotate, gentle zoom limits.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const controls = g.controls() as any
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.32
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minDistance = 180
    controls.maxDistance = 640
    controls.rotateSpeed = 0.7
    g.pointOfView({ lat: 24, lng: 18, altitude: 2.5 }, 0)

    const onStart = () => {
      interactingRef.current = true
      controls.autoRotate = false
      window.clearTimeout(resumeTimer.current)
    }
    const onEnd = () => {
      interactingRef.current = false
      window.clearTimeout(resumeTimer.current)
      // Resume drifting after an idle beat, but only if nothing is selected.
      resumeTimer.current = window.setTimeout(() => {
        if (!interactingRef.current && !selectedIdRef.current) controls.autoRotate = true
      }, 5000)
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      window.clearTimeout(resumeTimer.current)
    }
  }, [])

  // Keep live refs for the controls closure above; the camera flies only when
  // the SELECTION changes, not when the airports array identity changes
  // (e.g. an edit save re-creating the list mid-view).
  const selectedIdRef = useRef<string | null>(selectedId)
  const airportsRef = useRef(airports)
  airportsRef.current = airports
  useEffect(() => {
    selectedIdRef.current = selectedId
    const g = globeRef.current
    if (!g) return
    const controls = g.controls() as any
    if (selectedId) {
      controls.autoRotate = false
      const a = airportsRef.current.find((x) => x.id === selectedId)
      if (a) g.pointOfView({ lat: a.lat, lng: a.lng, altitude: 1.7 }, 1100)
    } else if (!interactingRef.current) {
      controls.autoRotate = true
    }
  }, [selectedId])

  const byId = useMemo(() => new Map(airports.map((a) => [a.id, a])), [airports])
  const selected = selectedId ? byId.get(selectedId) ?? null : null
  const highlighted = highlightId && highlightId !== selectedId ? byId.get(highlightId) ?? null : null

  // Pulsing ring under the selected airport (its layer color) + a faster,
  // tighter ring under a hover-highlighted row (two-way linking).
  const ringsData = useMemo(() => {
    const rings: { lat: number; lng: number; color: string; maxR: number; speed: number }[] = []
    if (selected) {
      rings.push({
        lat: selected.lat,
        lng: selected.lng,
        color: colorFor(selected) ?? statusMeta(selected.aerovectStatus).color,
        maxR: 4,
        speed: 2.2,
      })
    }
    if (highlighted) {
      rings.push({ lat: highlighted.lat, lng: highlighted.lng, color: '#eef3fa', maxR: 2.4, speed: 3.4 })
    }
    return rings
  }, [selected, highlighted, colorFor])

  const pointColor = (d: object) => {
    const a = d as Airport
    if (!visibleIds.has(a.id)) return 'rgba(90,102,117,0.14)' // dimmed / filtered out
    return colorFor(a)
  }

  const pointRadius = (d: object) => {
    const a = d as Airport
    const base = radiusFor(a)
    if (a.id === highlightId) return base * 1.5
    return visibleIds.has(a.id) ? base : base * 0.55
  }

  const pointLabel = (d: object) => {
    const a = d as Airport
    const meta = statusMeta(a.aerovectStatus)
    return `
      <div class="globe-tip">
        <div class="gt-top">
          <span class="gt-code">${a.iata ?? a.icao ?? ''}</span>
          <span class="gt-name">${a.name}</span>
        </div>
        <div class="gt-meta">${[a.city, a.country].filter(Boolean).join(', ')}</div>
        <div class="gt-meta">${a.passengersAnnual ? compactNumber(a.passengersAnnual) + ' pax/yr' : 'passengers n/a'}</div>
        <div class="gt-status" style="color:${meta.color}">
          <span class="dot" style="background:${meta.color}"></span>${meta.label}
        </div>
      </div>`
  }

  return (
    <div className="globe-stage" ref={containerRef}>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundImageUrl="./textures/night-sky.jpg"
        globeImageUrl="./textures/earth-night.jpg"
        bumpImageUrl="./textures/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#3aa0ff"
        atmosphereAltitude={0.2}
        onGlobeReady={onReady}
        pointsData={airports}
        pointLat={(d: object) => (d as Airport).lat}
        pointLng={(d: object) => (d as Airport).lng}
        pointColor={pointColor}
        pointRadius={pointRadius}
        pointAltitude={(d: object) => altitudeFor(d as Airport)}
        pointResolution={6}
        pointsMerge={false}
        pointLabel={pointLabel}
        onPointClick={(d: object) => onSelect((d as Airport).id)}
        onPointHover={(d: object | null) => onHover(d ? (d as Airport).id : null)}
        ringsData={ringsData}
        ringLat={(d: object) => (d as { lat: number }).lat}
        ringLng={(d: object) => (d as { lng: number }).lng}
        ringColor={(d: object) => {
          const c = (d as { color: string }).color
          return (t: number) => `${c}${Math.round((1 - t) * 200).toString(16).padStart(2, '0')}`
        }}
        ringMaxRadius={(d: object) => (d as { maxR: number }).maxR}
        ringPropagationSpeed={(d: object) => (d as { speed: number }).speed}
        ringRepeatPeriod={900}
        arcsData={arcs}
        arcStartLat={(d: object) => (d as ArcDatum).startLat}
        arcStartLng={(d: object) => (d as ArcDatum).startLng}
        arcEndLat={(d: object) => (d as ArcDatum).endLat}
        arcEndLng={(d: object) => (d as ArcDatum).endLng}
        arcColor={(d: object) => (d as ArcDatum).color}
        arcLabel={(d: object) => `<div class="globe-tip"><div class="gt-name">${(d as ArcDatum).label}</div></div>`}
        arcAltitude={0.28}
        arcStroke={0.45}
        arcDashLength={0.45}
        arcDashGap={0.18}
        arcDashAnimateTime={2200}
      />
    </div>
  )
}
