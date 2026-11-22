/**
 * Registro para detener el backing track del preview al abrir la presentación.
 * El reproductor es compartido; esto evita dejarlo sonando al cambiar de vista.
 */

let stopPreview: (() => void) | null = null

export function registerPreviewAudioStop(stop: (() => void) | null) {
  stopPreview = stop
}

export function stopPreviewAudio() {
  stopPreview?.()
}
