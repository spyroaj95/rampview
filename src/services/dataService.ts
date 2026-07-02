/**
 * dataService — the ONLY module that knows where airport data comes from.
 *
 * Today it reads the committed src/data/airports.json. Tomorrow loadAirports()
 * can `await fetch('/api/airports')` against a hosted DB and nothing in the UI
 * changes: every component talks to these pure helpers, never to the raw file.
 */
import type { Airport, AeroVectStatus, SizeClass } from '../types/airport'
import { TIER_B_FIELDS } from '../types/airport'
import rawAirports from '../data/airports.json'

export interface FilterState {
  /** empty = all statuses */
  statuses: AeroVectStatus[]
  /** ground-handler name, or null for any */
  handler: string | null
  /** region / continent bucket, or null for any */
  region: string | null
  /** empty = all size classes */
  sizeClasses: SizeClass[]
  /** free-text search across name / iata / icao / city / country */
  query: string
}

export const EMPTY_FILTERS: FilterState = {
  statuses: [],
  handler: null,
  region: null,
  sizeClasses: [],
  query: '',
}

export interface Stats {
  total: number
  customers: number
  pilots: number
  activeTargets: number
  prospects: number
  competitorHeld: number
  enriched: number
}

/**
 * Load the full airport set. Async on purpose so a DB/fetch backend can be
 * dropped in later with an identical call signature.
 */
export async function loadAirports(): Promise<Airport[]> {
  return rawAirports as Airport[]
}

/** True when a record has any Tier B intelligence filled in beyond defaults. */
export function isEnriched(a: Airport): boolean {
  return TIER_B_FIELDS.some((f) => {
    const v = a[f]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (v === 'unknown') return false
    return true
  })
}

export function searchAirports(list: Airport[], q: string): Airport[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return list
  return list.filter((a) => matchesQuery(a, needle))
}

function matchesQuery(a: Airport, needle: string): boolean {
  return [a.name, a.iata, a.icao, a.city, a.country, a.id]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(needle))
}

/** Does an airport pass the active filters? Used both to list and to dim globe points. */
export function matchesFilters(a: Airport, f: FilterState): boolean {
  if (f.statuses.length && !f.statuses.includes(a.aerovectStatus ?? 'unknown')) return false
  if (f.sizeClasses.length && !f.sizeClasses.includes(a.sizeClass ?? 'other')) return false
  if (f.region && a.region !== f.region) return false
  if (f.handler) {
    const has = (a.groundHandlers ?? []).some((h) => h.name === f.handler)
    if (!has) return false
  }
  if (f.query.trim() && !matchesQuery(a, f.query.trim().toLowerCase())) return false
  return true
}

export function filterAirports(list: Airport[], f: FilterState): Airport[] {
  return list.filter((a) => matchesFilters(a, f))
}

export function getById(list: Airport[], id: string): Airport | undefined {
  return list.find((a) => a.id === id)
}

/** Distinct region buckets, sorted, for the region filter. */
export function getRegions(list: Airport[]): string[] {
  return unique(list.map((a) => a.region).filter(Boolean) as string[]).sort()
}

/** Distinct ground handlers across all records, sorted, for the handler filter. */
export function getHandlers(list: Airport[]): string[] {
  const names = list.flatMap((a) => (a.groundHandlers ?? []).map((h) => h.name))
  return unique(names).sort((a, b) => a.localeCompare(b))
}

export function computeStats(list: Airport[]): Stats {
  const count = (s: AeroVectStatus) => list.filter((a) => a.aerovectStatus === s).length
  return {
    total: list.length,
    customers: count('customer'),
    pilots: count('pilot'),
    activeTargets: count('active_target'),
    prospects: count('prospect'),
    competitorHeld: count('competitor_held'),
    enriched: list.filter(isEnriched).length,
  }
}

/**
 * Insert or replace a record by id, returning a NEW array (immutable update).
 * The edit UI calls this, then serializeAirports() to produce a committable file.
 */
export function upsertAirport(list: Airport[], next: Airport): Airport[] {
  const idx = list.findIndex((a) => a.id === next.id)
  if (idx === -1) return [...list, next]
  const copy = list.slice()
  copy[idx] = next
  return copy
}

/** Pretty-print the full set exactly as it should be committed to the repo. */
export function serializeAirports(list: Airport[]): string {
  const sorted = [...list].sort((a, b) => (b.passengersAnnual ?? 0) - (a.passengersAnnual ?? 0))
  return JSON.stringify(sorted, null, 2) + '\n'
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}
