import { useAppStore } from '../store'

export function TransposeControls() {
  const transposeSemitones = useAppStore((s) => s.transposeSemitones)
  const setTranspose = useAppStore((s) => s.setTranspose)
  const currentScoreId = useAppStore((s) => s.currentScoreId)

  if (!currentScoreId) return null

  const change = (delta: number) => {
    setTranspose(transposeSemitones + delta)
  }

  const reset = () => setTranspose(0)

  const label =
    transposeSemitones === 0
      ? 'Original'
      : transposeSemitones > 0
        ? `+${transposeSemitones}`
        : `${transposeSemitones}`

  return (
    <div className="transpose-controls" title="Transporte de partitura y audio a la vez">
      <button onClick={() => change(-2)} title="-1 tono">
        −2
      </button>
      <button onClick={() => change(-1)} title="-1 semitono">
        −1
      </button>

      <span className="transpose-value" title="Semitonos (partitura + audio)">{label}</span>

      <button onClick={() => change(1)} title="+1 semitono">
        +1
      </button>
      <button onClick={() => change(2)} title="+1 tono">
        +2
      </button>

      <button className="reset" onClick={reset} disabled={transposeSemitones === 0}>
        Reset
      </button>
    </div>
  )
}
