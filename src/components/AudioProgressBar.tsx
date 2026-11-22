interface Props {
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
  label?: string
}

export function AudioProgressBar({ currentTime, duration, onSeek, label = 'Posición del audio' }: Props) {
  const safeDuration = Math.max(duration, 0.1)
  const progress = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))

  return (
    <input
      className="audio-progress"
      type="range"
      min={0}
      max={safeDuration}
      step={0.1}
      value={Math.min(currentTime, safeDuration)}
      onChange={(e) => onSeek(Number(e.target.value))}
      aria-label={label}
      style={{ '--progress': `${progress}%` } as React.CSSProperties}
    />
  )
}
