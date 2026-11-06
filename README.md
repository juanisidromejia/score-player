# Score Player

App ligera para músicos: colección de partituras + backing tracks con **transposición unificada** (visual + audio).

## Stack

- Vite + React + TypeScript
- **abcjs** → renderizado y transposición de partituras
- **Tone.js** → pitch shift del audio en tiempo real
- **zustand** → estado + persistencia
- **IndexedDB** → audio persistente (sobrevive al recargar)

## Funcionalidades

- Lista + buscador + filtro por repertorio y tags
- Añadir partituras (ABC) o **importar combo** `.scorepack`
- Editar tags y repertorio
- **Sets / Playlists**
- Transporte unificado (± semitonos) de partitura **y** audio
- Audio persistente (IndexedDB)
- **Exportar combo** (partitura + audio) como `.scorepack`

## Uso rápido

```bash
pnpm install
pnpm dev
```

### Guardar audio
Abre una partitura → **+ Cargar audio** → eliges MP3/WAV.  
Queda guardado. Al recargar la página sigue ahí.

### Exportar combo
Botón **⬇ Exportar combo** → descarga `nombre.scorepack`  
(contiene ABC + audio en base64 + metadatos).

### Importar combo
**+ Nueva partitura** → pestaña **Importar combo** → eliges el `.scorepack`.

### Sets
Pestaña **Sets** → creas listas y añades partituras.

## Formato .scorepack

JSON con:
- metadatos (título, tags, repertorio)
- código ABC
- audio opcional en base64

Ideal para respaldar o compartir una canción completa.

## Publicación (GitHub Pages + PWA)

La app se publica automáticamente en:

**https://juanisidromejia.github.io/score-player/**

Cada push a `master` ejecuta `.github/workflows/deploy.yml`, que:
- instala dependencias con pnpm
- pasa el lint y compila
- publica `dist` en GitHub Pages
- deja además un artifact descargable `score-player-dist`

Para activar Pages por primera vez: **Settings → Pages → Source: GitHub Actions**.

### Instalar en el móvil

- **Android/Chrome:** abrir la URL → menú → **Instalar app**.
- **iOS/Safari:** abrir la URL → Compartir → **Añadir a pantalla de inicio**.

La PWA funciona offline tras la primera carga. Los datos (partituras, sets y audio) se guardan en el navegador, no en GitHub. Para pasarlos de `localhost` al móvil, exporta cada combo como `.scorepack` e impórtalo allí.

> Recomendación: exporta tus combos como `.scorepack` de vez en cuando. Los navegadores móviles pueden borrar datos locales si falta espacio.
