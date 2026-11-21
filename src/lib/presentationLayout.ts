export interface PageLayout {
  offsets: number[]
  scale: number
}

export function computePageLayout(
  paperEl: HTMLElement,
  containerH: number
): PageLayout {
  const systems = Array.from(paperEl.querySelectorAll<HTMLElement>('g.abcjs-staff-wrapper'))
  if (systems.length === 0 || containerH <= 0) {
    return { offsets: [0], scale: 1 }
  }

  const paperRect = paperEl.getBoundingClientRect()
  const systemRects = systems.map((el) => {
    const r = el.getBoundingClientRect()
    return {
      top: r.top - paperRect.top,
      bottom: r.bottom - paperRect.top,
      height: r.height,
    }
  })

  // Agrupar sistemas en páginas sin superar el alto del contenedor (margen de seguridad 24px)
  const maxH = Math.max(200, containerH - 24)
  const groupHeights: number[] = []
  let currentGroupHeight = 0
  let firstInGroup = systemRects[0].top

  for (let i = 0; i < systemRects.length; i++) {
    const s = systemRects[i]
    const nextH = currentGroupHeight === 0 ? s.bottom - firstInGroup : s.bottom - firstInGroup
    if (currentGroupHeight > 0 && nextH > maxH) {
      groupHeights.push(currentGroupHeight)
      firstInGroup = s.top
      currentGroupHeight = s.bottom - s.top
    } else {
      currentGroupHeight = nextH
    }
  }
  if (currentGroupHeight > 0) {
    groupHeights.push(currentGroupHeight)
  }

  const maxPageH = Math.max(...groupHeights, 50)
  // Escala visual informativa (entre 0.45 y 1.35). No se aplica como transform para
  // no desajustar las coordenadas de scroll; el SVG usa width: 100% y nunca se corta horizontal.
  const scale = Math.min(Math.max(containerH / maxPageH, 0.45), 1.35)

  // Offsets en coordenadas de flujo del documento (sin transform), válidos para scrollTo
  const offsets: number[] = [0]
  let accumulated = 0
  for (let i = 0; i < groupHeights.length; i++) {
    if (i > 0) {
      accumulated += groupHeights[i - 1]
      offsets.push(accumulated)
    }
  }

  return { offsets, scale }
}
