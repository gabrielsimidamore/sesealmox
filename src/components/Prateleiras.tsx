import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type ItemLinha = { codigo_m: string; nome: string; qtd: number }
type Comp = { comp: string; itens: ItemLinha[]; temItem: boolean }
type Gaveta = { key: string; gaveta: string; col: number; row: string; comps: Comp[]; status: 'verde' | 'amarelo' | 'vermelho'; totalItens: number }
type Shelf = { nome: string; cols: number[]; rows: string[]; mapa: Map<string, Gaveta> }

function partes(codigo: string) {
  const i = codigo.indexOf('-')
  const shelf = i >= 0 ? codigo.slice(0, i) : ''
  const rest = i >= 0 ? codigo.slice(i + 1) : codigo
  const m = rest.match(/^(.*[A-Za-z])(\d*)$/)
  const gaveta = m ? m[1] : rest
  const comp = m ? (m[2] || '') : ''
  return { shelf, gaveta, comp }
}
function colRow(gaveta: string): { col: number; row: string } {
  const m = gaveta.match(/^(\d+)([A-Za-z]+)$/)
  return m ? { col: Number(m[1]), row: m[2] } : { col: 0, row: gaveta }
}

export default function Prateleiras() {
  const [locs, setLocs] = useState<{ id: string; codigo: string }[]>([])
  const [ils, setIls] = useState<{ locacao_id: string; quantidade: number; codigo_m: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [shelfSel, setShelfSel] = useState<string>('')
  const [gavetaSel, setGavetaSel] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const [lc, il] = await Promise.all([
        supabase.from('locacoes').select('id, codigo'),
        supabase.from('item_locacoes').select('locacao_id, quantidade, itens(codigo_m, nome)'),
      ])
      setLocs((lc.data as any) || [])
      setIls(((il.data as any[]) || []).map(r => ({ locacao_id: r.locacao_id, quantidade: r.quantidade, codigo_m: r.itens?.codigo_m || '—', nome: r.itens?.nome || '—' })))
      setCarregando(false)
    })()
  }, [])

  const shelves = useMemo(() => {
    const itensPorLoc = new Map<string, ItemLinha[]>()
    for (const r of ils) {
      if (!itensPorLoc.has(r.locacao_id)) itensPorLoc.set(r.locacao_id, [])
      itensPorLoc.get(r.locacao_id)!.push({ codigo_m: r.codigo_m, nome: r.nome, qtd: r.quantidade })
    }
    const mapaShelf = new Map<string, Shelf>()
    // agrupa loc -> shelf/gaveta/comp
    const gavetaComps = new Map<string, Map<string, Comp>>() // shelf|gaveta -> comp -> Comp
    const meta = new Map<string, { shelf: string; gaveta: string }>()
    for (const l of locs) {
      const { shelf, gaveta, comp } = partes(l.codigo)
      const gk = `${shelf}|${gaveta}`
      meta.set(gk, { shelf, gaveta })
      if (!gavetaComps.has(gk)) gavetaComps.set(gk, new Map())
      const itens = itensPorLoc.get(l.id) || []
      const temItem = itens.some(x => x.qtd > 0)
      gavetaComps.get(gk)!.set(comp || '1', { comp: comp || '', itens, temItem })
    }
    for (const [gk, compMap] of gavetaComps) {
      const { shelf, gaveta } = meta.get(gk)!
      const comps = [...compMap.values()].sort((a, b) => a.comp.localeCompare(b.comp))
      const comStock = comps.filter(c => c.temItem).length
      const status: Gaveta['status'] = comStock === 0 ? 'vermelho' : comStock === comps.length ? 'verde' : 'amarelo'
      const totalItens = comps.reduce((s, c) => s + c.itens.filter(x => x.qtd > 0).length, 0)
      const { col, row } = colRow(gaveta)
      if (!mapaShelf.has(shelf)) mapaShelf.set(shelf, { nome: shelf, cols: [], rows: [], mapa: new Map() })
      const sh = mapaShelf.get(shelf)!
      sh.mapa.set(`${col}${row}`, { key: `${col}${row}`, gaveta, col, row, comps, status, totalItens })
    }
    for (const sh of mapaShelf.values()) {
      sh.cols = [...new Set([...sh.mapa.values()].map(g => g.col))].sort((a, b) => a - b)
      sh.rows = [...new Set([...sh.mapa.values()].map(g => g.row))].sort()
    }
    return [...mapaShelf.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [locs, ils])

  const shelf = shelves.find(s => s.nome === shelfSel) || shelves[0]
  useEffect(() => { if (shelf && shelfSel !== shelf.nome) setShelfSel(shelf.nome) }, [shelf])

  const gaveta = shelf && gavetaSel ? shelf.mapa.get(gavetaSel) || null : null

  if (carregando) return <div className="muted pad">Carregando…</div>
  if (!shelf) return <div className="muted pad">Sem prateleiras. Cadastre itens com locação (ex: 1H-3E1).</div>

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Prateleiras 3D</h2>
          <div className="muted" style={{ fontSize: 13 }}>Clique numa gaveta para ver os itens</div>
        </div>
        <div className="row">
          {shelves.map(s => (
            <button key={s.nome} className={`filtro-chip${s.nome === shelf.nome ? ' on' : ''}`} onClick={() => { setShelfSel(s.nome); setGavetaSel(null) }}>{s.nome}</button>
          ))}
        </div>
      </div>

      <div className="rack-wrap">
        <div>
          <div className="rack">
            {shelf.rows.map(row => (
              <div className="rack-row" key={row}>
                <div className="row-tag">{row}</div>
                <div className="rack-drawers">
                  {shelf.cols.map(col => {
                    const g = shelf.mapa.get(`${col}${row}`)
                    if (!g) return <div key={col} className="drawer vazio-slot2" />
                    return (
                      <button key={col} className={`drawer st-${g.status}${gavetaSel === g.key ? ' sel' : ''}`} onClick={() => setGavetaSel(g.key)}>
                        <span className="drawer-label">{g.gaveta}</span>
                        <span className="dot" />
                        {g.comps.length > 1 && <span className="sep-badge">{g.comps.length}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="legenda-rack">
            <span><i className="dot st-verde" /> Disponível</span>
            <span><i className="dot st-amarelo" /> Parcial</span>
            <span><i className="dot st-vermelho" /> Vazio</span>
            {gaveta && <span><i className="sq-sel" /> Selecionado</span>}
          </div>
        </div>

        <aside className="painel-gaveta card">
          {!gaveta ? (
            <div className="muted pad" style={{ textAlign: 'center' }}>👆 Clique numa gaveta para abrir</div>
          ) : (
            <>
              <div className="pg-topo">
                <div>
                  <div className="pg-cod">GAVETA {shelf.nome}-{gaveta.gaveta}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{gaveta.totalItens} itens nesta gaveta</div>
                </div>
                <span className={`pg-badge st-${gaveta.status}`}>{gaveta.status === 'verde' ? 'Disponível' : gaveta.status === 'amarelo' ? 'Parcial' : 'Vazia'}</span>
              </div>

              <div className="pg-lista">
                {gaveta.comps.map((c, i) => (
                  <div key={i}>
                    {gaveta.comps.length > 1 && <div className="sep-rot">Separação {c.comp || i + 1}</div>}
                    {c.itens.filter(x => x.qtd > 0).length === 0 && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>Vazia</div>}
                    {c.itens.filter(x => x.qtd > 0).map((it, j) => (
                      <div key={j} className="pg-item">
                        <div><div className="pg-nome">{it.nome}</div><div className="pg-sku">{it.codigo_m}</div></div>
                        <div className="pg-qtd">{it.qtd}<span> un</span></div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <button className="secundario add" onClick={() => setGavetaSel(null)}>Fechar gaveta</button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
