import { useState } from 'react'
import type { Airport } from '../types/airport'
import {
  STAGE_ORDER,
  STAGE_META,
  PERSONA_META,
  DISPOSITION_COLOR,
  type Deal,
  type DealStage,
  type PersonaRole,
  type Contact,
  type Activity,
} from '../types/pipeline'
import { isStalled, CRM_INTEGRATION, syncDealToCrm } from '../services/pipelineService'
import { dayDate, todayIso, isOverdue, money } from '../lib/format'

interface Props {
  airport: Airport
  deal: Deal | undefined
  sample: boolean
  onUpsert: (deal: Deal) => void
  onDownload: () => void
  onCopy: () => void
}

let uid = 0
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`

/** '' -> undefined; non-numeric input never reaches state (no NaN in exports). */
const parseNum = (v: string): number | undefined => {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** The PIPELINE tab of the detail panel: stage, committee, activity log. */
export default function PipelinePanel({ airport, deal, sample, onUpsert, onDownload, onCopy }: Props) {
  const [addingContact, setAddingContact] = useState(false)
  const [cName, setCName] = useState('')
  const [cRole, setCRole] = useState<PersonaRole>('vp_ground_ops')
  const [cTitle, setCTitle] = useState('')
  const [cDispo, setCDispo] = useState<NonNullable<Contact['disposition']>>('unknown')
  const [actType, setActType] = useState<Activity['type']>('note')
  const [actSummary, setActSummary] = useState('')
  const [crmNote, setCrmNote] = useState<string | null>(null)

  const tryCrmSync = async () => {
    const res = await syncDealToCrm(deal!)
    setCrmNote(res.ok ? null : `${res.reason}. Deals persist to pipeline.json and this browser meanwhile.`)
  }

  const today = todayIso()

  if (!deal) {
    return (
      <div className="section">
        <div className="unknown-hint" style={{ marginBottom: 14 }}>
          No deal record for {airport.iata ?? airport.id} yet
        </div>
        <button
          className="btn primary"
          onClick={() =>
            onUpsert({
              airportId: airport.id,
              stage: 'identified',
              contacts: [],
              activity: [
                { id: newId('act'), date: today, type: 'note', summary: 'Deal record created in RampView.' },
              ],
              lastTouch: today,
            })
          }
        >
          Create deal record
        </button>
        <div className="form-hint" style={{ marginTop: 10 }}>
          Deals will sync to AeroVect's CRM once connected (provider TBD); until then they live in
          pipeline.json and this browser's autosave.
        </div>
      </div>
    )
  }

  const patch = (p: Partial<Deal>) => onUpsert({ ...deal, ...p })
  const touch = (p: Partial<Deal>) => onUpsert({ ...deal, ...p, lastTouch: today })

  const addContact = () => {
    if (!cName.trim()) return
    const c: Contact = {
      id: newId('c'),
      name: cName.trim(),
      role: cRole,
      title: cTitle.trim() || undefined,
      disposition: cDispo,
    }
    touch({ contacts: [...deal.contacts, c] })
    setCName('')
    setCTitle('')
    setAddingContact(false)
  }

  const addActivity = () => {
    if (!actSummary.trim()) return
    const a: Activity = { id: newId('act'), date: today, type: actType, summary: actSummary.trim() }
    touch({ activity: [...deal.activity, a] })
    setActSummary('')
  }

  const stalled = isStalled(deal, today)
  const acts = [...deal.activity].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <>
      {/* Dev note: this banner shows when the build runs on pipeline.sample.json.
          A real src/data/pipeline.json (gitignored, local-only) loads automatically instead. */}
      {sample && (
        <div className="export-note" style={{ marginTop: 14 }}>
          <b>SAMPLE DATA:</b> showing sample CRM data with placeholder contacts. The live pipeline
          stays local and private.
        </div>
      )}

      {/* ---------- Deal state ---------- */}
      <div className="section">
        <div className="section-title">
          Deal
          {stalled && <span className="stalled-badge">STALLED 30D+</span>}
        </div>
        <div className="form-two">
          <div className="form-row">
            <label>Stage</label>
            <select value={deal.stage} onChange={(e) => touch({ stage: e.target.value as DealStage })}>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Owner</label>
            <input value={deal.owner ?? ''} onChange={(e) => patch({ owner: e.target.value || undefined })} />
          </div>
        </div>
        <div className="form-two">
          <div className="form-row">
            <label>Units target</label>
            <input
              inputMode="numeric"
              value={deal.unitsTarget ?? ''}
              onChange={(e) => patch({ unitsTarget: parseNum(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>Units live</label>
            <input
              inputMode="numeric"
              value={deal.unitsLive ?? ''}
              onChange={(e) => patch({ unitsLive: parseNum(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-two">
          <div className="form-row">
            <label>Buying org</label>
            <input
              value={deal.handlerOrCarrier ?? ''}
              onChange={(e) => patch({ handlerOrCarrier: e.target.value || undefined })}
              placeholder="dnata, Delta, Fraport…"
            />
          </div>
          <div className="form-row">
            <label>
              Value (USD/yr)
              {deal.unitsTarget ? ' · DERIVED from the value model (units x RaaS fee)' : deal.value ? ` · ${money(deal.value)}` : ''}
            </label>
            {deal.unitsTarget ? (
              <div className="form-hint" style={{ marginTop: 2 }}>
                Set by units target; edit assumptions in the INTEL tab's VALUE MODEL section.
              </div>
            ) : (
              <input
                inputMode="numeric"
                value={deal.value ?? ''}
                onChange={(e) => patch({ value: parseNum(e.target.value) })}
              />
            )}
          </div>
        </div>
        <div className="form-row">
          <label>Next step</label>
          <input value={deal.nextStep ?? ''} onChange={(e) => patch({ nextStep: e.target.value || undefined })} />
        </div>
        <div className="form-row">
          <label className={isOverdue(deal.nextStepDue, today) ? 'overdue' : undefined}>
            Next step due {isOverdue(deal.nextStepDue, today) ? '· OVERDUE' : ''}
          </label>
          <input
            type="date"
            value={deal.nextStepDue ?? ''}
            onChange={(e) => patch({ nextStepDue: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* ---------- Buying committee ---------- */}
      <div className="section">
        <div className="section-title">
          Buying committee
          <span className="tier" title="BUYER economic buyer · OWNER functional owner · GATE safety veto · ENTRY entry point · COMMERCIAL procurement · FINANCE capex vs opex · LOCAL station go-live · AUTHORITY airside approval · STAKEHOLDER labor · SPONSOR exec">
            LEGEND
          </span>
        </div>
        {deal.contacts.length === 0 && <div className="unknown-hint">No contacts recorded, never fabricated</div>}
        {deal.contacts.map((c) => {
          const p = PERSONA_META[c.role]
          return (
            <div className="contact-row" key={c.id}>
              <div className="contact-top">
                <span className="contact-name">{c.name}</span>
                <span className="persona-tag" title={p.hint}>
                  {p.tag}
                </span>
                <span
                  className="dispo-dot"
                  title={`Disposition: ${c.disposition ?? 'unknown'}`}
                  style={{ background: DISPOSITION_COLOR[c.disposition ?? 'unknown'] }}
                />
              </div>
              <div className="contact-sub">
                {p.label}
                {c.title ? ` · ${c.title}` : ''}
                {c.org ? ` · ${c.org}` : ''}
              </div>
              {c.notes && <div className="contact-sub">{c.notes}</div>}
            </div>
          )
        })}
        {addingContact ? (
          <div style={{ marginTop: 10 }}>
            <div className="form-two">
              <div className="form-row">
                <label>Name</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} autoFocus />
              </div>
              <div className="form-row">
                <label>Persona</label>
                <select value={cRole} onChange={(e) => setCRole(e.target.value as PersonaRole)}>
                  {(Object.keys(PERSONA_META) as PersonaRole[]).map((r) => (
                    <option key={r} value={r}>
                      {PERSONA_META[r].label} [{PERSONA_META[r].tag}]
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-two">
              <div className="form-row">
                <label>Title</label>
                <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Disposition</label>
                <select value={cDispo} onChange={(e) => setCDispo(e.target.value as typeof cDispo)}>
                  <option value="champion">Champion</option>
                  <option value="neutral">Neutral</option>
                  <option value="blocker">Blocker</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="minibtn accent" onClick={addContact}>
                Add contact
              </button>
              <button className="minibtn" onClick={() => setAddingContact(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="minibtn" style={{ marginTop: 8 }} onClick={() => setAddingContact(true)}>
            + Add contact
          </button>
        )}
      </div>

      {/* ---------- Activity log ---------- */}
      <div className="section">
        <div className="section-title">Activity</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select
            className="select"
            style={{ borderRadius: 7 }}
            value={actType}
            onChange={(e) => setActType(e.target.value as Activity['type'])}
          >
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="milestone">Milestone</option>
          </select>
          <input
            style={{
              flex: 1,
              padding: '7px 11px',
              background: 'var(--bg-space)',
              border: '1px solid var(--line-strong)',
              borderRadius: 7,
              color: 'var(--text-hi)',
              fontSize: 12.5,
              outline: 'none',
            }}
            placeholder="Log a touch…"
            value={actSummary}
            onChange={(e) => setActSummary(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addActivity()}
          />
          <button className="minibtn accent" onClick={addActivity}>
            Log
          </button>
        </div>
        {acts.length === 0 && <div className="unknown-hint">No activity yet</div>}
        {acts.map((a) => (
          <div className="act-row" key={a.id}>
            <span className="act-date">{dayDate(a.date)}</span>
            <span className="act-type">{a.type.toUpperCase()}</span>
            <span className="act-sum">{a.summary}</span>
          </div>
        ))}
      </div>

      {/* ---------- Persistence ---------- */}
      <div className="section">
        <div className="export-note" style={{ margin: 0 }}>
          <b>How this persists:</b> edits save to this browser automatically. Download
          pipeline.json for a durable backup; it stays local and private.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="minibtn accent" onClick={onDownload}>
            Download pipeline.json
          </button>
          <button className="minibtn" onClick={onCopy}>
            Copy JSON
          </button>
          <button
            className="minibtn"
            style={{ opacity: CRM_INTEGRATION.connected ? 1 : 0.65 }}
            title="Placeholder: one-click sync to AeroVect's CRM once a provider is chosen (Salesforce, HubSpot, or other TBD)"
            onClick={tryCrmSync}
          >
            ⇄ Connect CRM
          </button>
        </div>
        {crmNote && (
          <div className="form-hint" style={{ marginTop: 8, color: 'var(--brand-amber)' }}>
            {crmNote}
          </div>
        )}
      </div>
    </>
  )
}
