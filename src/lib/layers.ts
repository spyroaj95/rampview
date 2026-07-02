/**
 * Layer system: what the globe point COLORS encode. One layer active at a time,
 * always with a matching legend (A1 "corrected-vs-open-model" pattern applied
 * to targeting).
 */
import type { Airport, Confidence } from '../types/airport'
import type { Deal } from '../types/pipeline'
import { statusMeta, STATUS_ORDER, STATUS_META, CONFIDENCE_COLOR } from './statusMeta'
import { isEnriched } from '../services/dataService'
import { scoreColor, SCORE_BUCKETS, type ScoreInfo } from './scoring'

export type LayerKey = 'status' | 'score' | 'competitor' | 'confidence' | 'whitespace'

export interface LayerMeta {
  key: LayerKey
  label: string
  blurb: string
}

export const LAYER_ORDER: LayerKey[] = ['status', 'score', 'competitor', 'confidence']

export const LAYER_META: Record<LayerKey, LayerMeta> = {
  status: { key: 'status', label: 'STATUS', blurb: 'AeroVect pipeline status' },
  score: { key: 'score', label: 'SCORE', blurb: 'Opportunity score heat (transparent weights)' },
  competitor: { key: 'competitor', label: 'COMPETITOR', blurb: 'Autonomous-GSE competitor presence' },
  confidence: { key: 'confidence', label: 'CONFIDENCE', blurb: 'Tier B research confidence' },
  whitespace: { key: 'whitespace', label: 'WHITESPACE', blurb: 'Ours / contested / open' },
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export type CompetitorCat = 'deployed' | 'trial' | 'none_found' | 'unknown'

export function competitorCategory(a: Airport): CompetitorCat {
  const comps = a.competitors ?? []
  if (comps.some((c) => /deploy/i.test(c.status ?? ''))) return 'deployed'
  if (comps.some((c) => /trial|test|pilot|approved/i.test(c.status ?? ''))) return 'trial'
  if (comps.length > 0) return 'trial'
  if (a.aerovectStatus === 'competitor_held') return 'deployed'
  // researched (has sources) and none recorded vs not researched at all
  return a.sources && a.sources.length > 0 ? 'none_found' : 'unknown'
}

export const COMPETITOR_COLORS: Record<CompetitorCat, { color: string; label: string }> = {
  deployed: { color: '#ff5468', label: 'Deployed' },
  trial: { color: '#f5a623', label: 'Trial / approved' },
  none_found: { color: '#4f8cff', label: 'Researched, none found' },
  unknown: { color: '#39424f', label: 'Not yet researched' },
}

export type WhitespaceCat = 'ours' | 'ours_contested' | 'contested' | 'open' | 'unknown'

export function whitespaceCategory(a: Airport, deal?: Deal): WhitespaceCat {
  const ours =
    a.aerovectStatus === 'pilot' ||
    a.aerovectStatus === 'customer' ||
    deal?.stage === 'pilot_live' ||
    deal?.stage === 'expansion' ||
    deal?.stage === 'won'
  const contested =
    (a.competitors ?? []).length > 0 ||
    a.aerovectStatus === 'competitor_held' ||
    deal?.stage === 'competitor_won'
  if (ours && contested) return 'ours_contested' // dnata runs both AeroVect and TractEasy
  if (ours) return 'ours'
  if (contested) return 'contested'
  if (!isEnriched(a) && (a.aerovectStatus ?? 'unknown') === 'unknown') return 'unknown'
  return 'open'
}

export const WHITESPACE_COLORS: Record<WhitespaceCat, { color: string; label: string }> = {
  ours: { color: '#2ee6a6', label: 'Ours (pilot / customer)' },
  ours_contested: { color: '#f5a623', label: 'Ours + contested' },
  contested: { color: '#ff5468', label: 'Contested (competitor present)' },
  open: { color: '#4f8cff', label: 'Open whitespace' },
  unknown: { color: '#39424f', label: 'Unknown (not researched)' },
}

const CONF_NONE = '#39424f'

// ---------------------------------------------------------------------------
// The color function used by the globe and every list dot
// ---------------------------------------------------------------------------

export function layerColor(
  layer: LayerKey,
  a: Airport,
  scoreInfo: ScoreInfo | undefined,
  deal: Deal | undefined,
): string {
  switch (layer) {
    case 'status':
      return statusMeta(a.aerovectStatus).color
    case 'score':
      return scoreColor(scoreInfo?.score ?? 0)
    case 'competitor':
      return COMPETITOR_COLORS[competitorCategory(a)].color
    case 'confidence': {
      const c = a.confidence as Confidence | undefined
      return c ? CONFIDENCE_COLOR[c] : CONF_NONE
    }
    case 'whitespace':
      return WHITESPACE_COLORS[whitespaceCategory(a, deal)].color
  }
}

/** Legend rows for the active layer: [color, label]. Counts added by the Legend. */
export function layerLegendRows(layer: LayerKey): { key: string; color: string; label: string }[] {
  switch (layer) {
    case 'status':
      return STATUS_ORDER.map((s) => ({ key: s, color: STATUS_META[s].color, label: STATUS_META[s].label }))
    case 'score':
      return SCORE_BUCKETS.map((b) => ({ key: b.label, color: b.color, label: `Score ${b.label}` }))
    case 'competitor':
      return (Object.keys(COMPETITOR_COLORS) as CompetitorCat[]).map((k) => ({
        key: k,
        color: COMPETITOR_COLORS[k].color,
        label: COMPETITOR_COLORS[k].label,
      }))
    case 'confidence':
      return [
        { key: 'high', color: CONFIDENCE_COLOR.high, label: 'High confidence' },
        { key: 'medium', color: CONFIDENCE_COLOR.medium, label: 'Medium confidence' },
        { key: 'low', color: CONFIDENCE_COLOR.low, label: 'Low confidence' },
        { key: 'none', color: CONF_NONE, label: 'Not yet researched' },
      ]
    case 'whitespace':
      return (Object.keys(WHITESPACE_COLORS) as WhitespaceCat[]).map((k) => ({
        key: k,
        color: WHITESPACE_COLORS[k].color,
        label: WHITESPACE_COLORS[k].label,
      }))
  }
}

/** Bucket key for an airport under a layer, for legend counts. */
export function layerBucket(
  layer: LayerKey,
  a: Airport,
  scoreInfo: ScoreInfo | undefined,
  deal: Deal | undefined,
): string {
  switch (layer) {
    case 'status':
      return a.aerovectStatus ?? 'unknown'
    case 'score': {
      const s = scoreInfo?.score ?? 0
      return SCORE_BUCKETS.find((b) => s >= b.min)?.label ?? '0-24'
    }
    case 'competitor':
      return competitorCategory(a)
    case 'confidence':
      return a.confidence ?? 'none'
    case 'whitespace':
      return whitespaceCategory(a, deal)
  }
}
