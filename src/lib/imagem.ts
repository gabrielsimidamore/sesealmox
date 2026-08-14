// Reduz a imagem no próprio navegador antes de subir:
// redimensiona para no máximo `maxLado` px e exporta JPEG comprimido.
// Assim a foto tirada no celular (3–5 MB) vira ~200–400 KB.
export async function comprimirImagem(
  file: File,
  maxLado = 1280,
  qualidade = 0.7,
): Promise<File> {
  // Se não for imagem ou já for pequena, não mexe.
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file

  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * escala)
    const h = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob: Blob | null = await new Promise(res =>
      canvas.toBlob(res, 'image/jpeg', qualidade),
    )
    if (!blob) return file

    const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file // se algo falhar, sobe a original
  }
}
