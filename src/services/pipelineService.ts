/**
 * pipelineService: the ONLY module that knows where pipeline (CRM) data lives.
 *
 * Privacy model (C1):
 *  - src/data/pipeline.json is GITIGNORED. It holds the real deals/contacts and
 *    only ever exists on a local machine. When present, it is loaded.
 *  - src/data/pipeline.sample.json is committed, with clearly-dummy contacts,
 *    so public builds and fresh clones run with zero setup and zero leakage.
 *  - import.meta.glob resolves the real file at build time IF it exists; a repo
 *    without it builds cleanly to the sample. Public deploys must be built from
 *    a checkout without pipeline.json (the default for any fresh clone/CI).
 *
 * Like dataService, everything is async-shaped so a hosted DB can slot in later.
 */
import type { Deal, DealStage, PipelineFile, Bridge } from '../types/pipeline'
import { STAGE_META } from '../types/pipeline'
import sampleRaw from '../data/pipeline.sample.json'
import bridgesRaw from '../data/bridges.json'

// Resolves to {} when src/data/pipeline.json does not exist (fresh clone / CI).
const realModules = import.meta.glob('../data/pipeline.json', { eager: true }) as Record<
  string,
  { default: PipelineFile }
>

export interface PipelineLoad {
  deals: Deal[]
  /** true when the app is running on the committed sample file */
  sample: boolean
}

export async function loadPipeline(): Promise<PipelineLoad> {
  const real = Object.values(realModules)[0]?.default
  if (real && Array.isArray(real.deals)) {
    return { deals: real.deals, sample: real.sample === true }
  }
  const sample = sampleRaw as PipelineFile
  return { deals: sample.deals, sample: true }
}

export async function loadBridges(): Promise<Bridge[]> {
  return bridgesRaw as Bridge[]
}

export function getDeal(deals: Deal[], airportId: string): Deal | undefined {
  return deals.find((d) => d.airportId === airportId)
}

// ---------------------------------------------------------------------------
// CRM integration placeholder.
//
// AeroVect's CRM is not yet known (Salesforce, HubSpot, Attio, or other).
// When it is, implement push/pull here and flip `connected`; the "Connect CRM"
// button in PipelinePanel is already wired to this single surface, so the UI
// needs no further changes. Deals keep flowing through pipeline.json and the
// localStorage autosave in the meantime.
// ---------------------------------------------------------------------------
export const CRM_INTEGRATION: { connected: boolean; provider: string | null } = {
  connected: false,
  provider: null, // e.g. 'salesforce' | 'hubspot' | 'attio' once chosen
}

/** Stub: replace with the real CRM push once a provider is chosen. */
export async function syncDealToCrm(deal: Deal): Promise<{ ok: false; reason: string }> {
  void deal
  return { ok: false, reason: 'CRM integration not configured yet (provider TBD)' }
}

/** Insert or replace by airportId; returns a NEW array. */
export function upsertDeal(deals: Deal[], next: Deal): Deal[] {
  const idx = deals.findIndex((d) => d.airportId === next.airportId)
  if (idx === -1) return [...deals, next]
  const copy = deals.slice()
  copy[idx] = next
  return copy
}

export function serializePipeline(deals: Deal[], sample = false): string {
  const file: PipelineFile = sample ? { sample: true, deals } : { deals }
  return JSON.stringify(file, null, 2) + '\n'
}

export function serializeBridges(bridges: Bridge[]): string {
  return JSON.stringify(bridges, null, 2) + '\n'
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const CLOSED: DealStage[] = ['won', 'lost', 'competitor_won']
export const STALLED_DAYS = 30

/** Most recent of lastTouch and any activity date. */
export function lastActivityDate(deal: Deal): string | undefined {
  const dates = [deal.lastTouch, ...deal.activity.map((a) => a.date)].filter(Boolean) as string[]
  if (!dates.length) return undefined
  return dates.sort().at(-1)
}

/** Open deal with no touch in STALLED_DAYS+ days (or no touch at all). */
export function isStalled(deal: Deal, todayIso: string): boolean {
  if (CLOSED.includes(deal.stage)) return false
  const last = lastActivityDate(deal)
  if (!last) return true
  const ms = new Date(todayIso).getTime() - new Date(last).getTime()
  return ms >= STALLED_DAYS * 24 * 3600 * 1000
}

export interface PipelineMetrics {
  deals: number
  unitsTarget: number
  unitsLive: number
  weightedValue: number
  pilotsLive: number
  competitorWon: number
  stalled: number
  unitsByStage: Partial<Record<DealStage, number>>
}

export function computePipelineMetrics(deals: Deal[], todayIso: string): PipelineMetrics {
  const open = deals.filter((d) => !CLOSED.includes(d.stage))
  const unitsByStage: Partial<Record<DealStage, number>> = {}
  for (const d of deals) {
    unitsByStage[d.stage] = (unitsByStage[d.stage] ?? 0) + (d.unitsTarget ?? 0)
  }
  return {
    deals: deals.length,
    unitsTarget: open.reduce((s, d) => s + (d.unitsTarget ?? 0), 0),
    unitsLive: deals.reduce((s, d) => s + (d.unitsLive ?? 0), 0),
    weightedValue: deals.reduce((s, d) => s + (d.value ?? 0) * STAGE_META[d.stage].weight, 0),
    pilotsLive: deals.filter((d) => d.stage === 'pilot_live').length,
    competitorWon: deals.filter((d) => d.stage === 'competitor_won').length,
    stalled: deals.filter((d) => isStalled(d, todayIso)).length,
    unitsByStage,
  }
}
