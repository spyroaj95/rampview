/**
 * refreshNews.ts: B5: keep tailwinds current without ever touching human entries.
 *
 * Same harness pattern as scripts/enrich/enrich.ts (plan -> parallel research
 * subagents -> merge with guardrails):
 *
 *   npm run news:plan  [N]     # pick targets (top-scored / already-tracked
 *                              # airports + handler/competitor topics), write
 *                              # scripts/news/tasks.json with one research brief each.
 *   # -> run one research subagent per task, in parallel. Each writes
 *   #    scripts/news/results/<ID>.json:
 *   #    { "airportId": "DXB" | null, "topic": "Swissport" | null,
 *   #      "items": [{ "headline","date","url","relevance" }] }
 *   npm run news:merge         # merge into airports.json tailwinds + digest
 *
 * Merge guardrails (C5):
 *   - every item MUST have a url (no url -> dropped and logged)
 *   - dedupe by url against existing tailwinds; never delete human items
 *   - merged items get firstSeen = today
 *   - topic items (no airportId) go to the digest only, never into airports.json
 *   - writes src/data/newsDigest.json {ranAt, items} which powers the
 *     "What's New" popover + unread badge in the app
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Airport, NewsItem } from '../src/types/airport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data', 'airports.json')
const DIGEST = join(__dirname, '..', 'src', 'data', 'newsDigest.json')
const NEWS_DIR = join(__dirname, 'news')
const RESULTS = join(NEWS_DIR, 'results')
const TASKS = join(NEWS_DIR, 'tasks.json')

/** Standing industry topics researched every run alongside airports. */
const TOPICS = [
  { id: 'topic-tracteasy', topic: 'TractEasy / EasyMile EZTow autonomous tow tractors' },
  { id: 'topic-aurrigo', topic: 'Aurrigo Auto-DollyTug autonomous ground handling' },
  { id: 'topic-swissport', topic: 'Swissport autonomy / automation programs' },
  { id: 'topic-dnata', topic: 'dnata autonomous vehicles and ground-handling expansion' },
  { id: 'topic-labor', topic: 'airport ramp ground-handling labor shortage / strikes' },
]

function readAirports(): Airport[] {
  return JSON.parse(readFileSync(DATA, 'utf8')) as Airport[]
}

function briefFor(a: Airport): string {
  return [
    `Find RECENT news (last ~12 months) relevant to autonomous ground support equipment at ${a.name} (${a.iata ?? a.id}), ${a.country}.`,
    `Relevant: autonomous/electric GSE trials or deployments, ground-handling contract changes, ramp labor actions or shortages, airside automation mandates, competitor moves (TractEasy, Aurrigo, purpose-built autonomy vendors).`,
    `Rules: every item MUST have a real source url you retrieved. Omit anything you cannot source. 0 items is a valid result.`,
    `Return items as: { "headline", "date" (YYYY-MM-DD if known), "url", "relevance" (one line, why it matters to AeroVect) }.`,
    `Write JSON to scripts/news/results/${a.iata ?? a.id}.json as {"airportId":"${a.iata ?? a.id}","items":[...]}.`,
  ].join('\n')
}

function plan(n: number) {
  const airports = readAirports()
  // Priority: airports already in play (status not unknown), then by passengers.
  const targets = airports
    .filter((a) => (a.aerovectStatus ?? 'unknown') !== 'unknown')
    .sort((x, y) => (y.passengersAnnual ?? 0) - (x.passengersAnnual ?? 0))
    .slice(0, n)

  const tasks = [
    ...targets.map((a) => ({
      id: a.iata ?? a.id,
      kind: 'airport' as const,
      name: a.name,
      country: a.country,
      prompt: briefFor(a),
    })),
    ...TOPICS.map((t) => ({
      id: t.id,
      kind: 'topic' as const,
      name: t.topic,
      prompt: [
        `Find RECENT news (last ~12 months) about: ${t.topic}.`,
        `Focus on what matters to AeroVect (retrofit autonomous-GSE, robotics-as-a-service): deployments, contracts, funding, airport wins/losses, labor drivers.`,
        `Rules: every item MUST have a real source url you retrieved; omit anything unsourced; 0 items is valid.`,
        `Write JSON to scripts/news/results/${t.id}.json as {"airportId":null,"topic":"${t.topic}","items":[...]}.`,
      ].join('\n'),
    })),
  ]

  if (!existsSync(RESULTS)) mkdirSync(RESULTS, { recursive: true })
  writeFileSync(TASKS, JSON.stringify({ count: tasks.length, tasks }, null, 2) + '\n')
  console.log(`Planned ${tasks.length} news tasks -> ${TASKS}`)
  for (const t of tasks) console.log(`  • ${String(t.id).padEnd(16)} ${t.name}`)
  console.log(`\nNext: run one research subagent per task (parallel), then: npm run news:merge`)
}

interface NewsResult {
  airportId?: string | null
  topic?: string | null
  items: NewsItem[]
}

function merge() {
  if (!existsSync(RESULTS)) {
    console.log('No results directory. Run news:plan and add agent results first.')
    return
  }
  const files = readdirSync(RESULTS).filter((f) => f.endsWith('.json') && f !== 'example.json')
  if (!files.length) {
    console.log('No news result files to merge.')
    return
  }

  const airports = readAirports()
  const byId = new Map(airports.map((a) => [a.id, a]))
  const today = new Date().toISOString().slice(0, 10)
  const digestItems: {
    airportId?: string
    topic?: string
    headline: string
    url?: string
    date?: string
    relevance?: string
  }[] = []

  let added = 0
  let dropped = 0

  for (const file of files) {
    let res: NewsResult
    try {
      res = JSON.parse(readFileSync(join(RESULTS, file), 'utf8'))
    } catch (e) {
      console.log(`  ✗ ${file}: invalid JSON, skipped`)
      continue
    }
    const items = (res.items ?? []).filter((i) => {
      if (!i.headline) return false
      if (!i.url) {
        dropped++
        console.log(`  ✗ ${file}: dropped unsourced item "${String(i.headline).slice(0, 60)}"`)
        return false
      }
      return true
    })

    if (res.airportId) {
      const rec = byId.get(res.airportId)
      if (!rec) {
        console.log(`  ✗ ${file}: no airport ${res.airportId}, skipped`)
        continue
      }
      const existingUrls = new Set((rec.tailwinds ?? []).map((t) => t.url).filter(Boolean))
      // Add as we filter so duplicate urls WITHIN one run are also deduped.
      const fresh = items.filter((i) => {
        if (existingUrls.has(i.url)) return false
        existingUrls.add(i.url)
        return true
      })
      if (fresh.length) {
        // Append only; human/agent history is never deleted (C5).
        rec.tailwinds = [
          ...(rec.tailwinds ?? []),
          ...fresh.map((i) => ({ ...i, firstSeen: today })),
        ]
        rec.lastUpdated = today
        added += fresh.length
        for (const i of fresh) digestItems.push({ airportId: res.airportId, ...i })
      }
      console.log(`  ✓ ${res.airportId}: +${fresh.length} tailwinds (${items.length - fresh.length} already known)`)
    } else {
      // Topic-level: digest only, never written into airport records.
      for (const i of items) digestItems.push({ topic: res.topic ?? file, ...i })
      console.log(`  ✓ ${res.topic ?? file}: ${items.length} industry items (digest only)`)
    }
  }

  writeFileSync(DATA, JSON.stringify(airports, null, 2) + '\n')
  writeFileSync(
    DIGEST,
    JSON.stringify({ ranAt: new Date().toISOString(), items: digestItems }, null, 2) + '\n',
  )
  console.log(`\nMerged: +${added} airport tailwinds, ${digestItems.length} digest items, ${dropped} dropped unsourced.`)
  console.log(`Digest -> ${DIGEST} (powers the What's New badge)`)
}

const mode = process.argv[2]
if (mode === 'plan') plan(Number(process.argv[3] ?? 8))
else if (mode === 'merge') merge()
else {
  console.log('Usage: tsx scripts/refreshNews.ts <plan [N] | merge>')
  process.exit(1)
}
