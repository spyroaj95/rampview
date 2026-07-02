import type { FilterState } from '../services/dataService'
import type { AeroVectStatus, SizeClass } from '../types/airport'
import { STATUS_ORDER, STATUS_META, SIZE_CLASS_LABEL } from '../lib/statusMeta'

interface Props {
  filters: FilterState
  onChange: (next: FilterState) => void
  regions: string[]
  handlers: string[]
}

const SIZE_ORDER: SizeClass[] = ['large_hub', 'medium_hub', 'small_hub']

export default function FilterBar({ filters, onChange, regions, handlers }: Props) {
  const toggleStatus = (s: AeroVectStatus) => {
    const has = filters.statuses.includes(s)
    onChange({
      ...filters,
      statuses: has ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s],
    })
  }

  const active =
    filters.statuses.length > 0 ||
    filters.sizeClasses.length > 0 ||
    filters.region != null ||
    filters.handler != null

  return (
    <div className="filterbar">
      <div className="filter-group">
        <span className="eyebrow">Status</span>
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s]
          const on = filters.statuses.includes(s)
          return (
            <button
              key={s}
              className={`chip${on ? ' active' : ''}`}
              style={on ? { background: `${meta.color}22`, boxShadow: `inset 0 0 0 1px ${meta.color}` } : undefined}
              onClick={() => toggleStatus(s)}
              title={meta.blurb}
            >
              <span className="swatch" style={{ background: meta.color }} />
              {meta.label}
            </button>
          )
        })}
      </div>

      <select
        className="select"
        value={filters.region ?? ''}
        onChange={(e) => onChange({ ...filters, region: e.target.value || null })}
      >
        <option value="">All regions</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <select
        className="select"
        value={filters.handler ?? ''}
        onChange={(e) => onChange({ ...filters, handler: e.target.value || null })}
      >
        <option value="">All handlers</option>
        {handlers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <select
        className="select"
        value={filters.sizeClasses[0] ?? ''}
        onChange={(e) =>
          onChange({ ...filters, sizeClasses: e.target.value ? [e.target.value as SizeClass] : [] })
        }
      >
        <option value="">All sizes</option>
        {SIZE_ORDER.map((s) => (
          <option key={s} value={s}>
            {SIZE_CLASS_LABEL[s]}
          </option>
        ))}
      </select>

      {active && (
        <button
          className="filter-clear"
          onClick={() =>
            onChange({ ...filters, statuses: [], sizeClasses: [], region: null, handler: null })
          }
        >
          Clear ✕
        </button>
      )}
    </div>
  )
}
