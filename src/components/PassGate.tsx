import { useState } from 'react'
import { tryUnlock } from '../lib/gate'

interface Props {
  what: string
  onUnlocked: () => void
}

/** Client-side passphrase gate for CRM views on deployed builds (C1). */
export default function PassGate({ what, onUnlocked }: Props) {
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')

  const attempt = async () => {
    if (await tryUnlock(value)) onUnlocked()
    else {
      setErr('Wrong passphrase')
      setValue('')
    }
  }

  return (
    <div className="passgate">
      <div className="passgate-box">
        <div className="lock">🔒</div>
        <div className="eyebrow">Restricted</div>
        <p>
          {what} contains working sales intelligence and is gated on deployed builds. Airport
          reference data stays public; deal and contact intel does not.
        </p>
        <input
          type="password"
          placeholder="passphrase"
          value={value}
          autoFocus
          onChange={(e) => {
            setValue(e.target.value)
            setErr('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && attempt()}
        />
        <div className="err">{err}</div>
        <button className="btn primary" style={{ width: '100%' }} onClick={attempt}>
          Unlock
        </button>
      </div>
    </div>
  )
}
