/**
 * enrich.ts — the human-in-the-loop harness for the multi-agent Tier B
 * enrichment workflow. Two modes:
 *
 *   npm run enrich:plan  [N]      # pick the next N airports missing Tier B,
 *                                 # emit a research brief + tasks.json manifest.
 *   npm run enrich:merge          # merge scripts/enrich/results/*.json back into
 *                                 # airports.json, safely, with a found/unknown log.
 *
 * The middle step is the multi-agent part: hand each task in tasks.json to a
 * research subagent (one per airport, run in parallel). Each agent finds, WITH
 * SOURCES, the ground handler(s), carrier- vs handler-led GSE, any autonomous-GSE
 * competitor presence (TractEasy / Aurrigo / others), labor/turnover signals, and
 * recent relevant news. Each writes a partial Airport JSON to results/<IATA>.json
 * matching RESULT_SCHEMA below. Then run enrich:merge.
 *
 * Guardrails enforced by merge():
 *   - Never fabricate: agents omit what they can't source; unknown stays unknown.
 *   - Never overwrite an existing non-empty Tier B field (human entries win).
 *   - Never downgrade an existing confidence.
 *   - Every merged record must carry sources.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Airport } from '../../src/types/airport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', '..', 'src', 'data', 'airports.json')
const RESULTS = join(__dirname, 'results')
const TASKS = join(__dirname, 'tasks.json')

const TIER_B_KEYS = [
  'gseModel',
  'groundHandlers',
  'gseFleetEstimate',
  'laborPressure',
  'competitors',
  'tailwinds',
  'operationsNotes',
] as const

const RESULT_SCHEMA = `{
  "id": "<IATA>",                       // required, must match an existing record
  "gseModel": "carrier_led|handler_led|mixed|unknown",
  "groundHandlers": [{ "name": "", "role": "", "notes": "" }],
  "gseFleetEstimate": "e.g. ~300 tractors, or omit",
  "laborPressure": "low|medium|high|unknown",
  "aerovectStatus": "prospect|watch|competitor_held|unknown",  // conservative
  "aerovectNotes": "1-2 sentences of GTM-relevant context",
  "operationsNotes": "granular ops detail if notable",
  "competitors": [{ "vendor": "TractEasy|Aurrigo|...", "status": "trial|deployed|approved", "source": "url" }],
  "tailwinds": [{ "headline": "", "date": "YYYY-MM-DD", "url": "", "relevance": "why it matters to AeroVect" }],
  "confidence": "low|medium",           // agents never claim 'high'
  "sources": ["url", "url"],            // REQUIRED and non-empty
  "_agent": { "found": ["gseModel","groundHandlers"], "unknown": ["gseFleetEstimate"], "notes": "" }
}`

function readData(): Airport[] {
  return JSON.parse(readFileSync(DATA, 'utf8')) as Airport[]
}

function isEnriched(a: Airport): boolean {
  return TIER_B_KEYS.some((k) => {
    const v = a[k]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    return v !== 'unknown'
  })
}

function briefFor(a: Airport): string {
  return [
    `Airport: ${a.name} (${a.iata ?? a.icao}) — ${[a.city, a.country].filter(Boolean).join(', ')}.`,
    `Find, WITH a source URL for each claim:`,
    `  1) Which ground handler(s) run the ramp (Swissport, Menzies, dnata, Unifi, SATS, Celebi, or a local/carrier in-house unit).`,
    `  2) Is GSE carrier-led (airline self-handles) or handler-led? Which model dominates.`,
    `  3) Any autonomous-GSE competitor on site (TractEasy/EZTow, Aurrigo/Auto DollyTug, or others) — trial/deployed/approved.`,
    `  4) Labor / turnover / staffing-shortage signals for ramp work at this airport or in its country.`,
    `  5) Recent news (last ~18 months) relevant to autonomous ground handling here.`,
    `If a field cannot be sourced, OMIT it (do not guess). Set confidence low unless multiple sources agree (then medium).`,
    `Return ONLY JSON matching this schema, then it is saved to results/${a.iata ?? a.id}.json:`,
    RESULT_SCHEMA,
  ].join('\n')
}

function plan(n: number) {
  const data = readData()
  const candidates = data
    .filter((a) => (a.aerovectStatus ?? 'unknown') === 'unknown' && !isEnriched(a))
    .sort((x, y) => (y.passengersAnnual ?? 0) - (x.passengersAnnual ?? 0))
    .slice(0, n)

  const tasks = candidates.map((a) => ({
    id: a.iata ?? a.id,
    name: a.name,
    city: a.city,
    country: a.country,
    region: a.region,
    passengersAnnual: a.passengersAnnual,
    prompt: briefFor(a),
  }))

  writeFileSync(TASKS, JSON.stringify({ count: tasks.length, airports: tasks }, null, 2) + '\n')
  if (!existsSync(RESULTS)) mkdirSync(RESULTS, { recursive: true })

  console.log(`Planned ${tasks.length} enrichment tasks -> ${TASKS}`)
  console.log(`Next: run one research subagent per airport (in parallel). Each writes`)
  console.log(`results/<IATA>.json per the schema, then run: npm run enrich:merge\n`)
  for (const t of tasks) {
    console.log(`  • ${t.id.padEnd(4)} ${t.name} — ${t.city ?? ''}, ${t.country}`)
  }
}

// ---- sanitize agent output: agents drift on enum spelling / formatting ----
const GSE = new Set(['carrier_led', 'handler_led', 'mixed', 'unknown'])
const LP = new Set(['low', 'medium', 'high', 'unknown'])
const ST = new Set([
  'customer',
  'pilot',
  'active_target',
  'prospect',
  'watch',
  'competitor_held',
  'unknown',
])
const CF = new Set(['high', 'medium', 'low'])
const NEGATION = /\bno\b|\bnot\b|\bnone\b|no confirmed|not confirmed|no presence|absent/i

function sanitize(raw: Record<string, any>): Record<string, any> {
  if (typeof raw.gseModel === 'string') {
    const g = raw.gseModel.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
    raw.gseModel = GSE.has(g) ? g : undefined
  }
  if (typeof raw.laborPressure === 'string') {
    // Agents sometimes write a paragraph; extract the enum word (leading first,
    // else the first standalone high/medium/low anywhere). No match -> unknown.
    const t = raw.laborPressure.trim().toLowerCase()
    const lead = t.match(/^(high|medium|low|unknown)\b/)
    const any = t.match(/\b(high|medium|low)\b/)
    raw.laborPressure = lead ? lead[1] : any ? any[1] : undefined
  }
  if (typeof raw.aerovectStatus === 'string') {
    const s = raw.aerovectStatus.trim().toLowerCase()
    raw.aerovectStatus = ST.has(s) ? s : undefined
  }
  if (typeof raw.confidence === 'string') {
    const c = raw.confidence.trim().toLowerCase()
    raw.confidence = CF.has(c) ? c : undefined
  }
  // Drop "competitor" entries that actually assert ABSENCE (avoid false red flags).
  if (Array.isArray(raw.competitors)) {
    raw.competitors = raw.competitors.filter(
      (c: any) => c && c.vendor && !(c.status && NEGATION.test(c.status)),
    )
  }
  return raw
}

function mergeField<K extends keyof Airport>(rec: Airport, key: K, val: Airport[K]): boolean {
  const cur = rec[key]
  const curEmpty =
    cur == null || cur === 'unknown' || (Array.isArray(cur) && cur.length === 0)
  const valEmpty =
    val == null || val === 'unknown' || (Array.isArray(val) && (val as unknown[]).length === 0)
  if (!curEmpty || valEmpty) return false // never overwrite an existing non-empty field
  rec[key] = val
  return true
}

function merge() {
  if (!existsSync(RESULTS)) {
    console.log(`No results directory at ${RESULTS}. Run enrich:plan and add agent results first.`)
    return
  }
  const files = readdirSync(RESULTS).filter((f) => f.endsWith('.json') && f !== 'example.json')
  if (!files.length) {
    console.log('No agent result files to merge.')
    return
  }
  const data = readData()
  const byId = new Map(data.map((a) => [a.id, a]))
  const today = new Date().toISOString().slice(0, 10)

  let merged = 0
  for (const file of files) {
    let raw: Record<string, any>
    try {
      raw = sanitize(JSON.parse(readFileSync(join(RESULTS, file), 'utf8')))
    } catch (e) {
      console.log(`  ✗ ${file}: invalid JSON, skipped (${(e as Error).message})`)
      continue
    }
    const id: string = raw.id
    const rec = byId.get(id)
    if (!rec) {
      console.log(`  ✗ ${file}: no airport with id ${id}, skipped`)
      continue
    }
    if (!raw.sources || raw.sources.length === 0) {
      console.log(`  ✗ ${id}: result has no sources, skipped (guardrail)`)
      continue
    }

    const filled: string[] = []
    for (const key of TIER_B_KEYS) {
      if (raw[key] !== undefined && mergeField(rec, key, raw[key])) filled.push(key)
    }
    // status: only promote from unknown
    if (raw.aerovectStatus && (rec.aerovectStatus ?? 'unknown') === 'unknown') {
      rec.aerovectStatus = raw.aerovectStatus
      filled.push('aerovectStatus')
    }
    if (raw.aerovectNotes && !rec.aerovectNotes) {
      rec.aerovectNotes = raw.aerovectNotes
      filled.push('aerovectNotes')
    }
    // confidence: set only if none (never downgrade a human 'high')
    if (raw.confidence && !rec.confidence) rec.confidence = raw.confidence
    // sources: append + dedupe
    rec.sources = Array.from(new Set([...(rec.sources ?? []), ...raw.sources]))
    rec.lastUpdated = raw.lastUpdated ?? today

    merged++
    const unknown = TIER_B_KEYS.filter((k) => !filled.includes(k))
    console.log(`  ✓ ${id}: filled [${filled.join(', ') || 'none'}] · left unknown [${unknown.join(', ')}]`)
  }

  data.sort((a, b) => (b.passengersAnnual ?? 0) - (a.passengersAnnual ?? 0))
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')
  console.log(`\nMerged ${merged}/${files.length} result files into ${DATA}`)
}

const mode = process.argv[2]
if (mode === 'plan') plan(Number(process.argv[3] ?? 12))
else if (mode === 'merge') merge()
else {
  console.log('Usage: tsx scripts/enrich/enrich.ts <plan [N] | merge>')
  process.exit(1)
}
