// "há X dias" a partir de uma data ISO (usado no status de locação vazia)
export function tempoVazia(iso?: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const dias = Math.floor(ms / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}
