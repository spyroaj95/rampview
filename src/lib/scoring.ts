/**
 * Opportunity scoring: transparent, no hidden weights.
 *
 * Six components sum to a 0-100 score. Every component returns its points, its
 * max, and a one-line reason, and the UI renders the full breakdown, so the
 * number is always explainable in a founder meeting.
 *
 *   VOLUME      0-25  sqrt-scaled annual passengers (proxy for GSE fleet size)
 *   LABOR       0-15  labor pressure: high 15, medium 8, low 3, unknown 0
 *   GSE MODEL   0-15  handler_led 15 (network unlock), mixed 10, carrier_led 6
 *   BRIDGE      0-15  airport is an endpoint of a known warm-bridge arc
 *   WHITESPACE  0-20  open 20, competitor trialing 8, competitor deployed or
 *                     competitor_held 0
 *   MARKET      0-10  autonomy-forward market (public airside-autonomy activity)
 *
 * Unknown Tier B contributes 0 with an explicit "not yet researched" reason;
 * a low score can mean "low intel", which is exactly what Coverage surfaces.
 */
import type { Airport } from '../types/airport'
import type { Bridge } from '../types/pipeline'

export interface ScoreComponent {
  label: string
  points: number
  max: number
  reason: string
}

export interface ScoreInfo {
  score: number
  components: ScoreComponent[]
}

const MAX_PAX = 105_000_000

/** Markets with public airside-autonomy activity (trials, mandates, programs). */
export const AUTONOMY_FORWARD_MARKETS: Record<string, string> = {
  AE: 'UAE: dnata autonomous-vehicle program',
  SG: 'Singapore: Changi autonomy trials',
  QA: 'Qatar: capital-rich, autonomy-curious',
  SA: 'Saudi Arabia: airport expansion programs',
  KR: 'South Korea: Incheon smart-airport pilots',
  JP: 'Japan: Level 4 airside tractors live',
  NL: 'Netherlands: Schiphol baggage-automation program',
  DE: 'Germany: Fraport autonomous apron trial',
  CH: 'Switzerland: Swissport autonomy pilot market',
  US: 'US: GAT partnership + severe ramp labor gap',
}

function hasDeployedCompetitor(a: Airport): boolean {
  return (a.competitors ?? []).some((c) => /deploy/i.test(c.status ?? ''))
}

function hasTrialingCompetitor(a: Airport): boolean {
  return (a.competitors ?? []).some((c) => /trial|test|pilot|approved/i.test(c.status ?? ''))
}

export function opportunityScore(a: Airport, bridges: Bridge[]): ScoreInfo {
  const components: ScoreComponent[] = []

  // VOLUME 0-25
  const pax = a.passengersAnnual ?? 0
  const volumePts = Math.round(Math.sqrt(Math.min(pax, MAX_PAX) / MAX_PAX) * 25)
  components.push({
    label: 'VOLUME',
    points: volumePts,
    max: 25,
    reason: pax
      ? `${(pax / 1_000_000).toFixed(1)}M pax/yr, sqrt-scaled`
      : 'Passenger volume unknown',
  })

  // LABOR 0-15
  const laborMap = { high: 15, medium: 8, low: 3 } as const
  const lp = a.laborPressure
  const laborPts = lp && lp !== 'unknown' ? laborMap[lp] : 0
  components.push({
    label: 'LABOR',
    points: laborPts,
    max: 15,
    reason:
      lp && lp !== 'unknown' ? `Labor pressure ${lp}` : 'Labor pressure not yet researched',
  })

  // GSE MODEL 0-15
  const gseMap = { handler_led: 15, mixed: 10, carrier_led: 6 } as const
  const gm = a.gseModel
  const gsePts = gm && gm !== 'unknown' ? gseMap[gm] : 0
  const gseReason =
    gm === 'handler_led'
      ? 'Handler-led: one win travels across the handler network'
      : gm === 'mixed'
        ? 'Mixed ramp: multiple buyers available'
        : gm === 'carrier_led'
          ? 'Carrier-led: single decision-maker, network via the airline'
          : 'GSE model not yet researched'
  components.push({ label: 'GSE MODEL', points: gsePts, max: 15, reason: gseReason })

  // BRIDGE 0-15
  const bridge = bridges.find((b) => b.from === a.id || b.to === a.id)
  components.push({
    label: 'BRIDGE',
    points: bridge ? 15 : 0,
    max: 15,
    reason: bridge ? `Warm bridge: ${bridge.label}` : 'No known warm bridge',
  })

  // WHITESPACE 0-20. ANY recorded competitor makes the account contested,
  // even with no status string (mirrors layers.ts competitorCategory).
  let wsPts = 20
  let wsReason = 'No autonomy competitor recorded here'
  if (a.aerovectStatus === 'competitor_held' || hasDeployedCompetitor(a)) {
    wsPts = 0
    wsReason = 'Competitor deployed or account competitor-held'
  } else if (hasTrialingCompetitor(a) || (a.competitors ?? []).length > 0) {
    wsPts = 8
    wsReason = 'Competitor recorded: contested but not settled'
  }
  components.push({ label: 'WHITESPACE', points: wsPts, max: 20, reason: wsReason })

  // MARKET 0-10
  const market = a.countryCode ? AUTONOMY_FORWARD_MARKETS[a.countryCode] : undefined
  components.push({
    label: 'MARKET',
    points: market ? 10 : 0,
    max: 10,
    reason: market ?? 'No known market-level autonomy tailwind',
  })

  const score = components.reduce((s, c) => s + c.points, 0)
  return { score, components }
}

/** Score color ramp: dim slate, blue, cyan, green as opportunity rises. */
export function scoreColor(score: number): string {
  if (score >= 70) return '#2ee6a6'
  if (score >= 55) return '#22d3ee'
  if (score >= 40) return '#4f8cff'
  if (score >= 25) return '#7d8a9c'
  return '#404a58'
}

export const SCORE_BUCKETS: { label: string; min: number; color: string }[] = [
  { label: '70+', min: 70, color: '#2ee6a6' },
  { label: '55-69', min: 55, color: '#22d3ee' },
  { label: '40-54', min: 40, color: '#4f8cff' },
  { label: '25-39', min: 25, color: '#7d8a9c' },
  { label: '0-24', min: 0, color: '#404a58' },
]
