import type { AeroVectStatus, GseModel, LaborPressure, Confidence } from '../types/airport'

export interface StatusMeta {
  key: AeroVectStatus
  label: string
  /** Point color on the globe + chip color in the UI. */
  color: string
  /** Short description used in the legend tooltip. */
  blurb: string
}

/**
 * The single source of truth for AeroVect pipeline status -> color.
 * These hexes are used for globe points, legend swatches, and status chips,
 * so the map and the UI never drift apart.
 */
export const STATUS_META: Record<AeroVectStatus, StatusMeta> = {
  customer: {
    key: 'customer',
    label: 'Customer',
    color: '#2ee6a6', // bright green
    blurb: 'Live paying deployment',
  },
  pilot: {
    key: 'pilot',
    label: 'Pilot',
    color: '#14b8a6', // teal / cyan
    blurb: 'Active pilot or trial',
  },
  active_target: {
    key: 'active_target',
    label: 'Active target',
    color: '#f5a623', // amber
    blurb: 'In active pursuit',
  },
  prospect: {
    key: 'prospect',
    label: 'Prospect',
    color: '#4f8cff', // blue
    blurb: 'Identified, not yet worked',
  },
  watch: {
    key: 'watch',
    label: 'Watch',
    color: '#c3ccd8', // light gray
    blurb: 'Interesting, monitoring',
  },
  competitor_held: {
    key: 'competitor_held',
    label: 'Competitor held',
    color: '#ff5468', // red
    blurb: 'A rival autonomy vendor is deployed',
  },
  unknown: {
    key: 'unknown',
    label: 'Unknown',
    color: '#5b6675', // dim gray
    blurb: 'Not yet classified',
  },
}

/** Legend / filter display order (most advanced in the funnel first). */
export const STATUS_ORDER: AeroVectStatus[] = [
  'customer',
  'pilot',
  'active_target',
  'prospect',
  'watch',
  'competitor_held',
  'unknown',
]

export function statusMeta(status?: AeroVectStatus): StatusMeta {
  return STATUS_META[status ?? 'unknown']
}

export const GSE_MODEL_LABEL: Record<GseModel, string> = {
  carrier_led: 'Carrier-led',
  handler_led: 'Handler-led',
  mixed: 'Mixed',
  unknown: 'Unknown',
}

export const LABOR_PRESSURE_LABEL: Record<LaborPressure, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  unknown: 'Unknown',
}

export const LABOR_PRESSURE_COLOR: Record<LaborPressure, string> = {
  low: '#2ee6a6',
  medium: '#f5a623',
  high: '#ff5468',
  unknown: '#5b6675',
}

export const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high: '#2ee6a6',
  medium: '#f5a623',
  low: '#ff5468',
}

export const SIZE_CLASS_LABEL: Record<string, string> = {
  large_hub: 'Large hub',
  medium_hub: 'Medium hub',
  small_hub: 'Small hub',
  other: 'Other',
}
