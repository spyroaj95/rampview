import { useState } from 'react'
import type { Airport } from '../types/airport'
import { STAGE_ORDER, STAGE_META, type Deal, type DealStage } from '../types/pipeline'
import { isStalled } from '../services/pipelineService'
import { todayIso, isOverdue, dayDate } from '../lib/format'

interface Props {
  deals: Deal[]
  airportsById: Map<string, Airport>
  onStageChange: (airportId: string, stage: DealStage) => void
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

/** BOARD view: kanban by DealStage; drag cards between columns. */
export default function BoardView({ deals, airportsById, onStageChange, onSelect, onHover }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<DealStage | null>(null)
  const today = todayIso()

  return (
    <div className="overlay-panel wide">
      <div className="overlay-head">
        <h3>Board</h3>
        <span className="spacer" />
        <span className="eyebrow">Drag a card to change stage</span>
      </div>
      <div className="board">
        {STAGE_ORDER.map((stage) => {
          const sm = STAGE_META[stage]
          const cards = deals.filter((d) => d.stage === stage)
          return (
            <div
              key={stage}
              className={`bcol${overCol === stage ? ' dragover' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(stage)
              }}
              onDragLeave={() => setOverCol((c) => (c === stage ? null : c))}
              onDrop={(e) => {
                e.preventDefault()
                setOverCol(null)
                if (dragId) onStageChange(dragId, stage)
                setDragId(null)
              }}
            >
              <div className="bcol-head">
                <span className="swatch" style={{ background: sm.color }} />
                {sm.label}
                <span className="count">{cards.length}</span>
              </div>
              {cards.map((d) => {
                const a = airportsById.get(d.airportId)
                if (!a) return null
                const stalled = isStalled(d, today)
                return (
                  <div
                    key={d.airportId}
                    className="bcard"
                    draggable
                    onDragStart={() => setDragId(d.airportId)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onSelect(a.id)}
                    onMouseEnter={() => onHover(a.id)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <span className="code">{a.iata ?? a.id}</span>
                    {stalled && <span className="stalled-badge">STALLED</span>}
                    <div className="bname">{a.name}</div>
                    <div className="bmeta">
                      {d.handlerOrCarrier && <div>{d.handlerOrCarrier}</div>}
                      {(d.unitsTarget || d.unitsLive) && (
                        <div>
                          {d.unitsLive ?? 0}/{d.unitsTarget ?? 0} units live
                        </div>
                      )}
                      {d.owner && <div>{d.owner}</div>}
                      {d.nextStepDue && (
                        <div className={isOverdue(d.nextStepDue, today) ? 'overdue' : undefined}>
                          Due {dayDate(d.nextStepDue)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
