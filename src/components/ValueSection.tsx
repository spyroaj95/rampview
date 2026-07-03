import { useState } from 'react'
import type { Deal } from '../types/pipeline'
import {
  computeAccountValue,
  VALUE_INPUTS,
  type ValueAssumptions,
} from '../lib/valueModel'
import { money } from '../lib/format'

interface Props {
  deal: Deal | undefined
  assumptions: ValueAssumptions
  onAssumptions: (a: ValueAssumptions) => void
  /** while the gate is locked, deal units stay hidden; model runs on defaults */
  gateLocked: boolean
}

/**
 * VALUE section (P3): the RaaS economics for this account, derivation shown
 * line by line, every input editable and labeled sourced-or-assumption.
 */
export default function ValueSection({ deal, assumptions, onAssumptions, gateLocked }: Props) {
  const [editing, setEditing] = useState(false)
  const unitsTarget = gateLocked ? undefined : deal?.unitsTarget
  const v = computeAccountValue(unitsTarget, assumptions)

  return (
    <div className="section">
      <div className="section-title">
        Value model
        <span className="tier b">RAAS</span>
      </div>

      <div className="metrics" style={{ marginBottom: 12 }}>
        <div className="metric">
          <div className="metric-label">Units modeled</div>
          <div className="metric-value">
            {v.units}
            {v.unitsAreAssumed && <span className="metric-sub"> (assumed)</span>}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Net value / yr</div>
          <div className="metric-value" style={{ color: v.netAnnual > 0 ? '#2ee6a6' : '#ff5468' }}>
            {money(v.netAnnual)}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">AeroVect ARR</div>
          <div className="metric-value" style={{ color: '#14b8a6' }}>
            {money(v.arr)}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Payback</div>
          <div className="metric-value">
            {v.paybackMonths != null ? `${v.paybackMonths.toFixed(1)} mo` : 'n/a'}
          </div>
        </div>
      </div>

      {/* derivation, line by line */}
      {v.lines.map((l) => (
        <div className="field" key={l.label}>
          <span className="field-label" title={l.formula}>
            {l.label}
            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-faint)' }}>{l.formula}</span>
          </span>
          <span className="field-value" style={{ color: l.amount < 0 ? '#ff8494' : undefined }}>
            {l.amount < 0 ? `-${money(-l.amount)}` : money(l.amount)}
          </span>
        </div>
      ))}
      <div className="field">
        <span className="field-label">NET / YR, then payback on {money(v.onboarding)} onboarding</span>
        <span className="field-value" style={{ color: v.netAnnual > 0 ? '#2ee6a6' : '#ff5468' }}>
          {money(v.netAnnual)}
        </span>
      </div>

      <button className="minibtn" style={{ marginTop: 12 }} onClick={() => setEditing(!editing)}>
        {editing ? 'Hide assumptions' : 'Edit assumptions'}
      </button>

      {editing && (
        <div style={{ marginTop: 10 }}>
          {VALUE_INPUTS.map((inp) => (
            <div className="form-row" key={inp.key}>
              <label>
                {inp.label} ({inp.unit}){' '}
                <span style={{ color: inp.isAssumption ? 'var(--brand-amber)' : 'var(--brand-cyan)', textTransform: 'none', letterSpacing: 0 }}>
                  {inp.isAssumption ? 'assumption' : 'sourced'}
                </span>
              </label>
              <input
                type="number"
                min={inp.min}
                max={inp.max}
                step={inp.step}
                value={assumptions[inp.key]}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) onAssumptions({ ...assumptions, [inp.key]: n })
                }}
              />
              <div className="form-hint">{inp.basis}</div>
            </div>
          ))}
          <div className="export-note" style={{ margin: '8px 0 0' }}>
            Deal value and the weighted pipeline derive from this model (units x RaaS fee).
            Change an assumption and every number updates. Nothing is hidden.
          </div>
        </div>
      )}
    </div>
  )
}
