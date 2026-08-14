import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tempoVazia } from '../lib/datas'

type Linha = {
  id: string
  vazio: boolean
  vazio_desde: string | null
  locacoes: { codigo: string; descricao: string | null } | null
  itens: { codigo_m: string; nome: string | null } | null
}

export default function Relatorios() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('item_locacoes')
      .select('id, vazio, vazio_desde, locacoes(codigo, descricao), itens(codigo_m, nome)')
      .eq('vazio', true)
      .order('vazio_desde', { ascending: true })
    setLinhas((data as any) || [])
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [])

  const locaisDistintos = new Set(linhas.map(l => l.locacoes?.codigo).filter(Boolean)).size

  return (
    <div>
      <div className="card resumo">
        <div className="num">{locaisDistintos}</div>
        <div className="resumo-txt">
          {locaisDistintos === 1 ? 'locação vazia' : 'locações vazias'}
          {linhas.length !== locaisDistintos && <span className="muted"> · {linhas.length} itens</span>}
        </div>
        <button className="secundario" onClick={carregar}>Atualizar</button>
      </div>

      <div className="card">
        <h3>Locações a reabastecer</h3>
        {carregando ? (
          <div className="muted pad">Carregando…</div>
        ) : linhas.length === 0 ? (
          <div className="muted pad">Nenhuma locação marcada como vazia. 🎉</div>
        ) : (
          <div className="lista">
            {linhas.map(l => (
              <div key={l.id} className="linha">
                <div className="info">
                  <div className="cod">📍 {l.locacoes?.codigo || '—'}</div>
                  <div className="nome">{l.itens?.codigo_m} — {l.itens?.nome || '—'}</div>
                </div>
                <span className="tag vazio">{l.vazio_desde ? tempoVazia(l.vazio_desde) : 'vazio'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
