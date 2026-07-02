/**
 * RampView airport data model.
 *
 * Every field is tagged Tier A (auto-seedable from open sources) or
 * Tier B (the "golden", non-public intelligence enriched by hand or by
 * research agents over time). Tier B fields are all optional and default
 * to unknown. We NEVER fabricate Tier B: "unknown" is a first-class value,
 * and anything enriched must carry a confidence and a source.
 */

/** Where an airport sits in the AeroVect pipeline. Drives point color on the globe. */
export type AeroVectStatus =
  | 'customer' //         live paying deployment
  | 'pilot' //            active pilot / trial
  | 'active_target' //    in pursuit
  | 'prospect' //         identified, not yet worked
  | 'watch' //            interesting, monitor
  | 'competitor_held' //  a rival autonomy vendor is deployed here
  | 'unknown'

/** Who runs the ground support equipment (GSE) on the ramp. */
export type GseModel = 'carrier_led' | 'handler_led' | 'mixed' | 'unknown'

export type OwnershipType = 'public' | 'private' | 'sovereign' | 'mixed' | 'unknown'

export type SizeClass = 'large_hub' | 'medium_hub' | 'small_hub' | 'other'

export type Confidence = 'high' | 'medium' | 'low'

export type LaborPressure = 'low' | 'medium' | 'high' | 'unknown'

export interface GroundHandler {
  name: string //   e.g., "dnata", "Menzies", "Unifi", "Fraport Ground Services"
  role?: string //  e.g., "primary ramp handler", "cargo only"
  notes?: string
}

export interface CompetitorPresence {
  vendor: string //  "TractEasy" | "Aurrigo" | other autonomy vendor
  status?: string // "trial" | "deployed" | "approved"
  source?: string
}

export interface NewsItem {
  date?: string
  headline: string
  url?: string
  relevance?: string //  why it matters to AeroVect
}

export interface Airport {
  // ---------- Tier A: auto-seedable from open sources ----------
  id: string //                IATA if present else ICAO
  iata?: string
  icao?: string
  name: string
  city?: string
  country: string //           ISO country name
  countryCode?: string //      ISO 3166-1 alpha-2
  region?: string //           continent / geo bucket
  lat: number
  lng: number
  sizeClass?: SizeClass
  passengersAnnual?: number //  most recent full-year total
  passengersYear?: number
  cargoTonnesAnnual?: number
  aircraftMovementsAnnual?: number
  owner?: string //             e.g., "Fraport AG", "City of Atlanta", "Dubai Airports"
  ownershipType?: OwnershipType
  hubFor?: string[] //          airlines that hub here

  // ---------- Tier B: golden, manually / AI enriched ----------
  gseModel?: GseModel
  groundHandlers?: GroundHandler[]
  gseFleetEstimate?: string //  e.g., "~300 tractors" or "unknown"; string to allow ranges/notes
  laborPressure?: LaborPressure
  aerovectStatus?: AeroVectStatus
  aerovectNotes?: string
  competitors?: CompetitorPresence[]
  tailwinds?: NewsItem[]
  operationsNotes?: string //   free-form granular ops detail

  // ---------- meta ----------
  confidence?: Confidence //    overall confidence on the Tier B enrichment
  sources?: string[]
  lastUpdated?: string //       ISO date
}

/** Which record keys are Tier B. Used by the UI to render "unknown, not yet researched". */
export const TIER_B_FIELDS = [
  'gseModel',
  'groundHandlers',
  'gseFleetEstimate',
  'laborPressure',
  'aerovectStatus',
  'aerovectNotes',
  'competitors',
  'tailwinds',
  'operationsNotes',
] as const satisfies readonly (keyof Airport)[]
