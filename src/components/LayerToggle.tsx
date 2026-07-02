import { LAYER_ORDER, LAYER_META, type LayerKey } from '../lib/layers'

interface Props {
  layer: LayerKey
  onChange: (l: LayerKey) => void
  /** whitespace view forces its own layer; disable switching there */
  disabled?: boolean
}

/** Globe-corner control: what the point colors encode. One layer at a time. */
export default function LayerToggle({ layer, onChange, disabled }: Props) {
  return (
    <div className="layer-toggle" style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
      <div className="eyebrow">Color by</div>
      {LAYER_ORDER.map((k) => (
        <button
          key={k}
          className={`layerbtn${layer === k ? ' active' : ''}`}
          onClick={() => onChange(k)}
          title={LAYER_META[k].blurb}
        >
          {LAYER_META[k].label}
        </button>
      ))}
    </div>
  )
}
