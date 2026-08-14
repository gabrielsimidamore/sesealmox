import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Cat = { nome: string; total: number }

export default function Dashboard() {
  const [carregando, setCarregando] = useState(true)
  const [totalItens, setTotalItens] = useState(0)
  const [totalLocais, setTotalLocais] = useState(0)
  const [locaisVazios, setLocaisVazios] = useState(0)
  const [ocupados, setOcupados] = useState(0)
  const [cats, setCats] = useState<Cat[]>([])

  async function carregar() {
    setCarregando(true)
    const [itensC, locaisC, vinculos, categorias] = await Promise.all([
      supabase.from('itens').select('*', { count: 'exact', head: true }),
      supabase.from('locacoes').select('*', { count: 'exact', head: true }),
      supabase.from('item_locacoes').select('locacao_id, vazio'),
      supabase.from('itens').select('categoria'),
    ])
    setTotalItens(itensC.count || 0)
    setTotalLocais(locaisC.count || 0)

    // ocupadas/vazias contam só locações que realmente têm item vinculado
    const ocupSet = new Set<string>()
    const vazSet = new Set<string>()
    for (const r of (vinculos.data || []) as any[]) {
      if (r.vazio) vazSet.add(r.locacao_id)
      else ocupSet.add(r.locacao_id)
    }
    setOcupados(ocupSet.size)
    setLocaisVazios(vazSet.size)

    const cont: Record<string, number> = {}
    for (const r of (categorias.data || []) as any[]) {
      const c = r.categoria || 'Sem categoria'
      cont[c] = (cont[c] || 0) + 1
    }
    setCats(Object.entries(cont).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total))
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [])

  const maxCat = Math.max(1, ...cats.map(c => c.total))

  return (
    <div>
      <div className="page-head">
        <h2>Dashboard</h2>
        <button className="secundario" onClick={carregar}>Atualizar</button>
      </div>

      {carregando ? (
        <div className="muted pad">Carregando…</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-num">{totalItens}</div>
              <div className="stat-rot">Itens cadastrados</div>
            </div>
            <div className="stat">
              <div className="stat-num">{totalLocais}</div>
              <div className="stat-rot">Locações cadastradas</div>
            </div>
            <div className="stat ok">
              <div className="stat-num">{ocupados}</div>
              <div className="stat-rot">Locações ocupadas</div>
            </div>
            <div className="stat alerta">
              <div className="stat-num">{locaisVazios}</div>
              <div className="stat-rot">Locações vazias</div>
            </div>
          </div>

          <div className="card">
            <h3>Itens por categoria</h3>
            {cats.length === 0 ? (
              <div className="muted pad">Nenhum item ainda.</div>
            ) : (
              <div className="barras">
                {cats.map(c => (
                  <div className="barra-linha" key={c.nome}>
                    <div className="barra-rot">{c.nome}</div>
                    <div className="barra-trilho">
                      <div className="barra-fill" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </div>
                    <div className="barra-val">{c.total}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
