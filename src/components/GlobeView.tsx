import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import type { Airport } from '../types/airport'
import { statusMeta } from '../lib/statusMeta'
import { compactNumber } from '../lib/format'

interface Props {
  airports: Airport[]
  /** ids that pass the active filters; anything else is dimmed. */
  visibleIds: Set<string>
  selectedId: string | null
  onSelect: (id: string) => void
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

export default function GlobeView({ airports, visibleIds, selectedId, onSelect }: Props) {
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
      // Resume drifting after a idle beat, but only if nothing is selected.
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

  // Keep a live ref of selection for the controls closure above.
  const selectedIdRef = useRef<string | null>(selectedId)
  useEffect(() => {
    selectedIdRef.current = selectedId
    const g = globeRef.current
    if (!g) return
    const controls = g.controls() as any
    if (selectedId) {
      controls.autoRotate = false
      const a = airports.find((x) => x.id === selectedId)
      if (a) g.pointOfView({ lat: a.lat, lng: a.lng, altitude: 1.7 }, 1100)
    } else if (!interactingRef.current) {
      controls.autoRotate = true
    }
  }, [selectedId, airports])

  const selected = useMemo(
    () => airports.find((a) => a.id === selectedId) ?? null,
    [airports, selectedId],
  )

  // Pulsing ring under the selected airport, in its status color.
  const ringsData = useMemo(
    () => (selected ? [{ lat: selected.lat, lng: selected.lng, color: statusMeta(selected.aerovectStatus).color }] : []),
    [selected],
  )

  const pointColor = (d: object) => {
    const a = d as Airport
    const meta = statusMeta(a.aerovectStatus)
    if (visibleIds.has(a.id)) return meta.color
    return 'rgba(90,102,117,0.14)' // dimmed / filtered out
  }

  const pointRadius = (d: object) => {
    const a = d as Airport
    const base = radiusFor(a)
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
        backgroundImageUrl="./textures/night-sky.png"
        globeImageUrl="./textures/earth-night.jpg"
        bumpImageUrl="./textures/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#3aa0ff"
        atmosphereAltitude={0.2}
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
        ringsData={ringsData}
        ringLat={(d: object) => (d as { lat: number }).lat}
        ringLng={(d: object) => (d as { lng: number }).lng}
        ringColor={(d: object) => {
          const c = (d as { color: string }).color
          return (t: number) => `${c}${Math.round((1 - t) * 200).toString(16).padStart(2, '0')}`
        }}
        ringMaxRadius={4}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={900}
      />
    </div>
  )
}
