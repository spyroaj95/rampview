/**
 * workspaceService (P4): localStorage autosave for the whole working set,
 * so edits survive a refresh without any backend. Download-to-commit stays
 * the durable path; this is the daily-driver convenience layer.
 *
 * What is saved: deals, bridges, value-model assumptions, and airports ONLY
 * when the user actually edited them (so committed data updates are not
 * masked by a stale snapshot for read-only users).
 */
import type { Airport } from '../types/airport'
import type { Deal, Bridge } from '../types/pipeline'
import type { ValueAssumptions } from '../lib/valueModel'

const KEY = 'rv_workspace_v1'

export interface Workspace {
  version: 1
  savedAt: string
  deals: Deal[]
  bridges: Bridge[]
  assumptions: ValueAssumptions
  /** present only if the user edited airport intel in-app */
  airports?: Airport[]
}

export function saveWorkspace(w: Omit<Workspace, 'version' | 'savedAt'>): string | null {
  try {
    const savedAt = new Date().toISOString()
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt, ...w }))
    return savedAt
  } catch {
    return null // quota exceeded or storage disabled: downloads still work
  }
}

export function loadWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as Workspace
    if (w.version !== 1 || !Array.isArray(w.deals)) return null
    return w
  } catch {
    return null
  }
}

export function clearWorkspace(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

/**
 * Parse an imported pipeline JSON (file upload or paste): accepts the
 * {sample?, deals:[...]} file shape or a bare deals array. Validates that
 * every deal joins a known airport. Never throws; returns an error string.
 */
export function parsePipelineImport(
  text: string,
  knownAirportIds: Set<string>,
): { deals: Deal[] } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Not valid JSON' }
  }
  const deals = Array.isArray(parsed)
    ? (parsed as Deal[])
    : Array.isArray((parsed as { deals?: Deal[] }).deals)
      ? (parsed as { deals: Deal[] }).deals
      : null
  if (!deals) return { error: 'Expected {"deals":[...]} or a deals array' }
  for (const d of deals) {
    if (!d || typeof d.airportId !== 'string' || typeof d.stage !== 'string') {
      return { error: 'Each deal needs airportId and stage' }
    }
    if (!knownAirportIds.has(d.airportId)) {
      return { error: `Unknown airportId "${d.airportId}" (not in the dataset)` }
    }
    d.contacts = Array.isArray(d.contacts) ? d.contacts : []
    d.activity = Array.isArray(d.activity) ? d.activity : []
  }
  return { deals }
}
