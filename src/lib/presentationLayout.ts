export interface SystemRect {
  top: number
  bottom: number
}

export interface PageLayout {
  offsets: number[]
  counts: number[]
}

const PAGE_PADDING = 12
const MIN_USABLE_HEIGHT = 120

/**
 * Agrupa sistemas completos en páginas. El origen de cada página es la coordenada
 * del documento que se alinea con el borde superior del contenedor: 0 en la
 * primera y el primer sistema de cada grupo en las demás. Medir el grupo desde
 * su primer sistema daría por buena una página cuyo contenido cae por debajo
 * del contenedor, porque la cabecera inicial de OSMD no se tiene en cuenta.
 * No se aplica escala: los offsets son coordenadas de flujo para translateY.
 */
export function computePageLayout(
  systems: SystemRect[],
  containerH: number,
  paperHeight: number
): PageLayout {
  if (containerH <= 0) {
    return { offsets: [0], counts: [Math.max(systems.length, 1)] }
  }

  const usableH = Math.max(MIN_USABLE_HEIGHT, containerH - PAGE_PADDING * 2)

  if (systems.length === 0) {
    const count = Math.max(1, Math.ceil(paperHeight / usableH))
    return {
      offsets: Array.from({ length: count }, (_, i) => i * usableH),
      counts: Array.from({ length: count }, () => 1),
    }
  }

  const offsets = [0]
  const counts: number[] = []
  let pageOrigin = 0
  let count = 0

  systems.forEach((system, i) => {
    if (i > 0 && count > 0 && system.bottom - pageOrigin > usableH) {
      counts.push(count)
      pageOrigin = Math.max(0, system.top - PAGE_PADDING)
      offsets.push(pageOrigin)
      count = 0
    }
    count++
  })
  counts.push(count)

  return { offsets, counts }
}
