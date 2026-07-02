/**
 * Reporting exports (B6): CSV target lists of whatever is on screen, and a
 * printable one-page account brief per airport for meeting prep.
 * No em dashes anywhere in generated documents.
 */
import type { Airport } from '../types/airport'
import type { Deal } from '../types/pipeline'
import { STAGE_META, PERSONA_META, type Bridge } from '../types/pipeline'
import { GSE_MODEL_LABEL, LABOR_PRESSURE_LABEL, statusMeta } from './statusMeta'
import { fullNumber } from './format'
import type { ScoreInfo } from './scoring'

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function targetListCsv(
  airports: Airport[],
  scoreOf: (a: Airport) => ScoreInfo,
  dealOf: (a: Airport) => Deal | undefined,
): string {
  const header = [
    'iata',
    'name',
    'city',
    'country',
    'region',
    'passengers_annual',
    'aerovect_status',
    'opportunity_score',
    'gse_model',
    'ground_handlers',
    'labor_pressure',
    'competitors',
    'deal_stage',
    'units_target',
    'units_live',
    'owner',
    'next_step',
    'next_step_due',
    'confidence',
    'last_updated',
  ]
  const rows = airports.map((a) => {
    const d = dealOf(a)
    return [
      a.iata ?? a.id,
      a.name,
      a.city ?? '',
      a.country,
      a.region ?? '',
      a.passengersAnnual ?? '',
      a.aerovectStatus ?? 'unknown',
      scoreOf(a).score,
      a.gseModel ?? 'unknown',
      (a.groundHandlers ?? []).map((h) => h.name).join('; '),
      a.laborPressure ?? 'unknown',
      (a.competitors ?? []).map((c) => `${c.vendor}${c.status ? ` (${c.status})` : ''}`).join('; '),
      d ? d.stage : '',
      d?.unitsTarget ?? '',
      d?.unitsLive ?? '',
      d?.owner ?? '',
      d?.nextStep ?? '',
      d?.nextStepDue ?? '',
      a.confidence ?? '',
      a.lastUpdated ?? '',
    ]
  })
  return toCsv(header, rows)
}

// ---------------------------------------------------------------------------
// Account brief (printable)
// ---------------------------------------------------------------------------

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function section(title: string, body: string): string {
  return `<h2>${title}</h2>${body}`
}

function kv(label: string, value: string | undefined, muted = false): string {
  return `<div class="kv"><span class="k">${esc(label)}</span><span class="v${muted ? ' muted' : ''}">${value ?? '<span class="muted">unknown, not yet researched</span>'}</span></div>`
}

export function accountBriefHtml(a: Airport, deal: Deal | undefined, score: ScoreInfo, bridges: Bridge[]): string {
  const meta = statusMeta(a.aerovectStatus)
  const myBridges = bridges.filter((b) => b.from === a.id || b.to === a.id)

  const handlers = (a.groundHandlers ?? [])
    .map(
      (h) =>
        `<li><b>${esc(h.name)}</b>${h.role ? ` · ${esc(h.role)}` : ''}${h.notes ? `<br/><span class="muted">${esc(h.notes)}</span>` : ''}</li>`,
    )
    .join('')

  const committee = (deal?.contacts ?? [])
    .map((c) => {
      const p = PERSONA_META[c.role]
      return `<li><b>${esc(c.name)}</b> · ${esc(p.label)} [${p.tag}]${c.disposition ? ` · ${esc(c.disposition)}` : ''}${c.notes ? `<br/><span class="muted">${esc(c.notes)}</span>` : ''}</li>`
    })
    .join('')

  const comps = (a.competitors ?? [])
    .map((c) => `<li><b>${esc(c.vendor)}</b>${c.status ? ` · ${esc(c.status)}` : ''}</li>`)
    .join('')

  const tailwinds = (a.tailwinds ?? [])
    .map(
      (t) =>
        `<li>${t.date ? `<span class="muted">${esc(t.date)}</span> ` : ''}${esc(t.headline)}${t.relevance ? `<br/><span class="muted">Why it matters: ${esc(t.relevance)}</span>` : ''}</li>`,
    )
    .join('')

  const scoreRows = score.components
    .map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${c.points}/${c.max}</td><td class="muted">${esc(c.reason)}</td></tr>`)
    .join('')

  const sources = (a.sources ?? []).map((s) => `<li class="muted">${esc(s)}</li>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Account brief · ${esc(a.iata ?? a.id)} ${esc(a.name)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16202c;margin:36px auto;max-width:760px;font-size:13px;line-height:1.5}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#5a6675;margin-bottom:4px}
  .chip{display:inline-block;padding:2px 10px;border-radius:99px;font-weight:600;font-size:12px;background:${meta.color}22;color:#16202c;border:1px solid ${meta.color}}
  h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5a6675;border-bottom:1px dashed #c8cfd8;padding-bottom:4px;margin:22px 0 8px}
  .kv{display:flex;gap:12px;padding:3px 0} .k{width:170px;color:#5a6675;flex-shrink:0} .v{font-weight:500}
  ul{margin:4px 0;padding-left:18px} li{margin-bottom:4px}
  .muted{color:#8a94a3;font-weight:400}
  table{border-collapse:collapse;width:100%} td{padding:3px 8px;border-bottom:1px dashed #e2e6ec} .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .print-note{margin-top:26px;color:#8a94a3;font-size:11px}
  @media print {.noprint{display:none}}
</style></head><body>
<button class="noprint" onclick="window.print()" style="float:right;padding:6px 14px">Print</button>
<h1>${esc(a.iata ?? a.id)} · ${esc(a.name)}</h1>
<div class="sub">${esc([a.city, a.country].filter(Boolean).join(', '))}${a.region ? ` · ${esc(a.region)}` : ''}</div>
<span class="chip">${esc(meta.label)}</span>
${section(
  'Overview',
  kv('Annual passengers', a.passengersAnnual ? `${fullNumber(a.passengersAnnual)}${a.passengersYear ? ` (${a.passengersYear})` : ''}` : undefined) +
    kv('Size class', a.sizeClass ? esc(a.sizeClass.replace('_', ' ')) : undefined) +
    kv('Opportunity score', `${score.score}/100`),
)}
${section(
  'Ownership',
  kv('Owner / operator', a.owner ? esc(a.owner) : undefined) +
    kv('Ownership type', a.ownershipType && a.ownershipType !== 'unknown' ? esc(a.ownershipType) : undefined) +
    kv('Hub for', a.hubFor?.length ? esc(a.hubFor.join(', ')) : undefined),
)}
${section(
  'Ground operations',
  kv('GSE model', a.gseModel && a.gseModel !== 'unknown' ? esc(GSE_MODEL_LABEL[a.gseModel]) : undefined) +
    kv('Labor pressure', a.laborPressure && a.laborPressure !== 'unknown' ? esc(LABOR_PRESSURE_LABEL[a.laborPressure]) : undefined) +
    kv('Est. GSE fleet', a.gseFleetEstimate ? esc(a.gseFleetEstimate) : undefined) +
    (handlers ? `<ul>${handlers}</ul>` : '<p class="muted">Handlers not yet researched.</p>') +
    (a.operationsNotes ? `<p>${esc(a.operationsNotes)}</p>` : ''),
)}
${section(
  'Deal & buying committee',
  (deal
    ? kv('Stage', esc(STAGE_META[deal.stage].label)) +
      kv('Buying org', deal.handlerOrCarrier ? esc(deal.handlerOrCarrier) : undefined) +
      kv('Units target / live', `${deal.unitsTarget ?? 0} / ${deal.unitsLive ?? 0}`) +
      kv('Owner', deal.owner ? esc(deal.owner) : undefined) +
      kv('Next step', deal.nextStep ? `${esc(deal.nextStep)}${deal.nextStepDue ? ` (due ${esc(deal.nextStepDue)})` : ''}` : undefined)
    : '<p class="muted">No deal record yet.</p>') +
    (committee ? `<ul>${committee}</ul>` : '<p class="muted">No contacts recorded.</p>'),
)}
${section('Competitor status', comps ? `<ul>${comps}</ul>` : '<p class="muted">No autonomy competitor recorded.</p>')}
${section(
  'Warm bridges',
  myBridges.length
    ? `<ul>${myBridges.map((b) => `<li><b>${esc(b.label)}</b> (via ${esc(b.via)})<br/><span class="muted">${esc(b.rationale)}</span></li>`).join('')}</ul>`
    : '<p class="muted">No known warm bridge.</p>',
)}
${section('Tailwinds', tailwinds ? `<ul>${tailwinds}</ul>` : '<p class="muted">No tailwinds recorded yet.</p>')}
${section('Score breakdown (transparent weights)', `<table>${scoreRows}</table>`)}
${section('Sources', sources ? `<ul>${sources}</ul>` : '<p class="muted">No sources cited.</p>')}
<p class="print-note">RampView account brief · ${esc(a.iata ?? a.id)} · confidence: ${esc(a.confidence ?? 'not set')} · last updated: ${esc(a.lastUpdated ?? 'never')}. Contains working sales intelligence; do not distribute.</p>
</body></html>`
}

export function openAccountBrief(a: Airport, deal: Deal | undefined, score: ScoreInfo, bridges: Bridge[]): void {
  const w = window.open('', '_blank', 'width=860,height=900')
  if (!w) return
  w.document.write(accountBriefHtml(a, deal, score, bridges))
  w.document.close()
}
