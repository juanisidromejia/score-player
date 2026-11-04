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
npm install
npm run dev
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
