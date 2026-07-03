import { useRef, useState } from 'react'

interface Props {
  savedAt: string | null
  dirty: { airports: boolean; pipeline: boolean; bridges: boolean }
  onDownloadAirports: () => void
  onDownloadPipeline: () => void
  onDownloadBridges: () => void
  onImportPipeline: (text: string) => string | null // returns error or null
  onReset: () => void
  onClose: () => void
}

/**
 * Workspace modal (P4): autosave status, download-to-commit, import a saved
 * pipeline.json (file or paste), and reset back to the committed data.
 */
export default function WorkspaceModal(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasted, setPasted] = useState('')
  const [err, setErr] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const doImport = (text: string) => {
    const e = props.onImportPipeline(text)
    if (e) setErr(e)
    else props.onClose()
  }

  return (
    <div className="modal-scrim" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Workspace</h3>
        <p>
          {props.savedAt
            ? `Autosaved to this browser at ${new Date(props.savedAt).toLocaleTimeString()}. Every edit persists locally within a second.`
            : 'Nothing autosaved yet (or storage is unavailable). Edits still work; download to keep them.'}
        </p>

        <div className="section-title" style={{ marginTop: 14 }}>
          Download to commit
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <button className={`minibtn${props.dirty.airports ? ' warn' : ''}`} onClick={props.onDownloadAirports}>
            airports.json{props.dirty.airports ? ' ●' : ''}
          </button>
          <button className={`minibtn${props.dirty.pipeline ? ' warn' : ''}`} onClick={props.onDownloadPipeline}>
            pipeline.json{props.dirty.pipeline ? ' ●' : ''}
          </button>
          <button className={`minibtn${props.dirty.bridges ? ' warn' : ''}`} onClick={props.onDownloadBridges}>
            bridges.json{props.dirty.bridges ? ' ●' : ''}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-lo)' }}>
          airports/bridges commit to the repo; pipeline.json stays local (gitignored).
        </p>

        <div className="section-title" style={{ marginTop: 14 }}>
          Import pipeline JSON
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="minibtn accent" onClick={() => fileRef.current?.click()}>
            Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              f.text().then(doImport)
              e.target.value = ''
            }}
          />
        </div>
        <div className="form-row">
          <label>Or paste JSON</label>
          <textarea
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value)
              setErr('')
            }}
            placeholder='{"deals":[...]} or a bare deals array'
            style={{ minHeight: 70 }}
          />
        </div>
        {err && <div style={{ color: '#ff8494', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        {pasted.trim() && (
          <button className="minibtn accent" onClick={() => doImport(pasted)}>
            Import pasted JSON
          </button>
        )}

        <div className="section-title" style={{ marginTop: 16 }}>
          Reset
        </div>
        {confirmReset ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="minibtn warn" onClick={props.onReset}>
              Yes, discard local edits and reload committed data
            </button>
            <button className="minibtn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="minibtn" onClick={() => setConfirmReset(true)}>
            Reset workspace…
          </button>
        )}

        <button className="btn" style={{ marginTop: 18, width: '100%' }} onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
