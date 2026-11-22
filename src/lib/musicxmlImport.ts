import JSZip from 'jszip'

function isZip(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, 4)
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2]) &&
    [0x04, 0x06, 0x08].includes(bytes[3])
  )
}

async function xmlFromZip(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const container = zip.file('META-INF/container.xml')

  if (container) {
    const containerXml = await container.async('string')
    const doc = new DOMParser().parseFromString(containerXml, 'application/xml')
    const rootPath = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
    const rootFile = rootPath ? zip.file(rootPath) : null
    if (rootFile && !rootFile.dir) return rootFile.async('string')
  }

  const files = Object.values(zip.files).filter((file) => !file.dir)
  const scoreFile =
    files.find((file) => /\.musicxml$/i.test(file.name)) ??
    files.find((file) => /\.xml$/i.test(file.name) && !file.name.startsWith('META-INF/'))

  if (!scoreFile) throw new Error('El archivo comprimido no contiene una partitura MusicXML')
  return scoreFile.async('string')
}

export async function readMusicXmlFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (isZip(buffer)) return xmlFromZip(buffer)
  return new TextDecoder().decode(buffer)
}

export function titleFromMusicXml(xml: string, filename: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const value = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent?.trim()
  const title = value('work-title') || value('movement-title') || value('part-name')

  if (title) return title

  return (
    filename
      .replace(/\.(mxl|musicxml|xml)$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Sin título'
  )
}
