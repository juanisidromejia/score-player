import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-prompt" role="status">
      <span>Nueva versión disponible</span>
      <button
        type="button"
        className="update-prompt-action"
        onClick={() => updateServiceWorker(true)}
      >
        Actualizar
      </button>
      <button
        type="button"
        className="update-prompt-dismiss"
        onClick={() => setNeedRefresh(false)}
        aria-label="Cerrar aviso"
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  )
}
