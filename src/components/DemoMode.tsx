import { useEffect, useRef, useState } from 'react'
import { DEMO_STEPS, type DemoStep } from '../lib/demoScript'

interface Props {
  applyStep: (step: DemoStep) => void
  onExit: () => void
}

/**
 * Hands-free founder walkthrough (A2): auto-advances through DEMO_STEPS,
 * with pause/prev/next and a caption overlay. Esc or ✕ exits.
 */
export default function DemoMode({ applyStep, onExit }: Props) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const step = DEMO_STEPS[idx]

  // Apply the step whenever it changes.
  useEffect(() => {
    applyStep(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // Auto-advance.
  useEffect(() => {
    if (paused) return
    timer.current = window.setTimeout(() => {
      if (idx < DEMO_STEPS.length - 1) setIdx(idx + 1)
      else onExit()
    }, step.dwellMs)
    return () => window.clearTimeout(timer.current)
  }, [idx, paused, step.dwellMs, onExit])

  return (
    <>
      <div className="demo-caption">{step.caption}</div>
      <div className="demo-controls">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} title="Previous" aria-label="Previous">
          ⏮
        </button>
        <button onClick={() => setPaused(!paused)} title={paused ? 'Play' : 'Pause'} aria-label="Play/Pause">
          {paused ? '▶' : '⏸'}
        </button>
        <button
          onClick={() => (idx < DEMO_STEPS.length - 1 ? setIdx(idx + 1) : onExit())}
          title="Next"
          aria-label="Next"
        >
          ⏭
        </button>
        <div className="demo-dots">
          {DEMO_STEPS.map((s, i) => (
            <span key={s.id} className={`demo-dot${i < idx ? ' done' : i === idx ? ' now' : ''}`} />
          ))}
        </div>
        <button onClick={onExit} title="Exit walkthrough" aria-label="Exit">
          ✕
        </button>
      </div>
    </>
  )
}
