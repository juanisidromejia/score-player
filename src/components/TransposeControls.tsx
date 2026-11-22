import { useAppStore } from '../store'

interface Props {
  compact?: boolean
}

export function TransposeControls({ compact = false }: Props) {
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

  if (compact) {
    return (
      <div className="transpose-controls compact" title="Transporte de partitura y audio a la vez">
        <button onClick={() => change(-1)} title="-1 semitono" aria-label="Bajar un semitono">
          −1
        </button>
        <button
          className="transpose-value"
          onClick={reset}
          disabled={transposeSemitones === 0}
          title="Volver a transporte original"
          aria-label={`Transporte actual: ${label}. Pulsa para volver a original`}
        >
          {label}
        </button>
        <button onClick={() => change(1)} title="+1 semitono" aria-label="Subir un semitono">
          +1
        </button>
        <details className="transpose-more">
          <summary title="Más transportes" aria-label="Más transportes">⋯</summary>
          <div className="transpose-more-panel">
            <button onClick={() => change(-2)}>−2</button>
            <button onClick={() => change(2)}>+2</button>
            <button onClick={reset} disabled={transposeSemitones === 0}>Original</button>
          </div>
        </details>
      </div>
    )
  }

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
