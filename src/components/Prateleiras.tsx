import { useEffect, useMemo, useState } from 'react'
import { supabase, type Item } from '../lib/supabase'
import ItemDetalhe from './ItemDetalhe'

type ItemLinha = { item_id: string; codigo_m: string; nome: string; qtd: number; foto: string | null }
type Comp = { comp: string; itens: ItemLinha[]; temItem: boolean }
type Gaveta = { key: string; gaveta: string; linha: string; coluna: string; comps: Comp[]; status: 'verde' | 'amarelo' | 'vermelho'; totalItens: number }
type Shelf = { nome: string; linhas: string[]; colunas: string[]; mapa: Map<string, Gaveta> }

function partes(codigo: string) {
  const i = codigo.indexOf('-')
  const shelf = i >= 0 ? codigo.slice(0, i) : ''
  const rest = i >= 0 ? codigo.slice(i + 1) : codigo
  const m = rest.match(/^(.*[A-Za-z])(\d*)$/)
  return { shelf, gaveta: m ? m[1] : rest, comp: m ? (m[2] || '') : '' }
}
// número = linha (1A/1B/1C = mesma linha); letra = coluna (posição na linha)
function eixo(gaveta: string): { linha: string; coluna: string } {
  const m = gaveta.match(/^(\d+)([A-Za-z]+)$/)
  return m ? { linha: m[1], coluna: m[2] } : { linha: gaveta, coluna: '' }
}

export default function Prateleiras() {
  const [locs, setLocs] = useState<{ id: string; codigo: string }[]>([])
  const [ils, setIls] = useState<ItemLinha[] & { locacao_id?: string }[]>([] as any)
  const [carregando, setCarregando] = useState(true)
  const [shelfSel, setShelfSel] = useState<string>('')
  const [gavetaSel, setGavetaSel] = useState<string | null>(null)
  const [itemAberto, setItemAberto] = useState<Item | null>(null)

  useEffect(() => {
    (async () => {
      const [lc, il] = await Promise.all([
        supabase.from('locacoes').select('id, codigo'),
        supabase.from('item_locacoes').select('locacao_id, quantidade, item_id, itens(codigo_m, nome, fotos)'),
      ])
      setLocs((lc.data as any) || [])
      setIls(((il.data as any[]) || []).map(r => ({
        locacao_id: r.locacao_id, quantidade: r.quantidade, item_id: r.item_id,
        codigo_m: r.itens?.codigo_m || '—', nome: r.itens?.nome || '—',
        foto: (r.itens?.fotos && r.itens.fotos[0]) || null,
      })) as any)
      setCarregando(false)
    })()
  }, [])

  async function abrirItem(itemId: string) {
    const { data } = await supabase
      .from('itens')
      .select('*, item_locacoes(vazio, quantidade, vazio_desde, locacao_id, locacoes(codigo))')
      .eq('id', itemId).single()
    if (!data) return
    const d = data as any
    setItemAberto({
      ...d,
      locais: (d.item_locacoes || []).map((il: any) => ({
        codigo: il.locacoes?.codigo || '—', vazio: il.vazio, quantidade: il.quantidade,
        locacao_id: il.locacao_id, vazio_desde: il.vazio_desde,
      })),
    })
  }

  const shelves = useMemo(() => {
    const itensPorLoc = new Map<string, ItemLinha[]>()
    for (const r of ils as any[]) {
      if (!itensPorLoc.has(r.locacao_id)) itensPorLoc.set(r.locacao_id, [])
      itensPorLoc.get(r.locacao_id)!.push({ item_id: r.item_id, codigo_m: r.codigo_m, nome: r.nome, qtd: r.quantidade, foto: r.foto })
    }
    const mapaShelf = new Map<string, Shelf>()
    const gavetaComps = new Map<string, Map<string, Comp>>()
    const meta = new Map<string, { shelf: string; gaveta: string }>()
    for (const l of locs) {
      const { shelf, gaveta, comp } = partes(l.codigo)
      const gk = `${shelf}|${gaveta}`
      meta.set(gk, { shelf, gaveta })
      if (!gavetaComps.has(gk)) gavetaComps.set(gk, new Map())
      const itens = itensPorLoc.get(l.id) || []
      gavetaComps.get(gk)!.set(comp || '1', { comp, itens, temItem: itens.some(x => x.qtd > 0) })
    }
    for (const [gk, compMap] of gavetaComps) {
      const { shelf, gaveta } = meta.get(gk)!
      const comps = [...compMap.values()].sort((a, b) => a.comp.localeCompare(b.comp))
      const comStock = comps.filter(c => c.temItem).length
      const status: Gaveta['status'] = comStock === 0 ? 'vermelho' : comStock === comps.length ? 'verde' : 'amarelo'
      const totalItens = comps.reduce((s, c) => s + c.itens.filter(x => x.qtd > 0).length, 0)
      const { linha, coluna } = eixo(gaveta)
      if (!mapaShelf.has(shelf)) mapaShelf.set(shelf, { nome: shelf, linhas: [], colunas: [], mapa: new Map() })
      mapaShelf.get(shelf)!.mapa.set(`${linha}|${coluna}`, { key: `${linha}|${coluna}`, gaveta, linha, coluna, comps, status, totalItens })
    }
    for (const sh of mapaShelf.values()) {
      sh.linhas = [...new Set([...sh.mapa.values()].map(g => g.linha))].sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b))
      sh.colunas = [...new Set([...sh.mapa.values()].map(g => g.coluna))].sort()
    }
    return [...mapaShelf.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [locs, ils])

  const shelf = shelves.find(s => s.nome === shelfSel) || shelves[0]
  useEffect(() => { if (shelf && shelfSel !== shelf.nome) setShelfSel(shelf.nome) }, [shelf])
  const gaveta = shelf && gavetaSel ? shelf.mapa.get(gavetaSel) || null : null

  if (carregando) return <div className="muted pad">Carregando…</div>
  if (!shelf) return <div className="muted pad">Sem prateleiras. Cadastre itens com locação (ex: 1H-3E1).</div>

  return (
    <div className="rk-page">
      <div className="page-head">
        <div>
          <h2>Vista 3D — gavetas de locação</h2>
          <div className="muted" style={{ fontSize: 13 }}>Clique em uma gaveta para ver os itens</div>
        </div>
        <div className="row">
          {shelves.map(s => (
            <button key={s.nome} className={`filtro-chip${s.nome === shelf.nome ? ' on' : ''}`}
              onClick={() => { setShelfSel(s.nome); setGavetaSel(null) }}>{s.nome}</button>
          ))}
        </div>
      </div>

      {itemAberto && <ItemDetalhe item={itemAberto} onFechar={() => setItemAberto(null)} />}

      <div className="rk-wrap">
        <div className="rk-col">
          <div className="rk-scroll">
          <div className="rk">
            <div className="rk-post left" />
            <div className="rk-body">
              {shelf.linhas.map(linha => (
                <div className="rk-level" key={linha}>
                  <div className="rk-tag">{linha}</div>
                  <div className="rk-drawers" style={{ gridTemplateColumns: `repeat(${shelf.colunas.length}, minmax(0, 1fr))` }}>
                    {shelf.colunas.map(coluna => {
                      const g = shelf.mapa.get(`${linha}|${coluna}`)
                      if (!g) return <div key={coluna} className="rk-drawer ghost" />
                      const aberta = gavetaSel === g.key
                      return (
                        <button key={coluna} className={`rk-drawer st-${g.status}${aberta ? ' aberta' : ''}`}
                          onClick={() => setGavetaSel(aberta ? null : g.key)}>
                          <span className="rk-handle" />
                          <span className="rk-face">
                            <span className="rk-code">{g.gaveta}</span>
                            <span className="rk-dot" />
                          </span>
                          {g.comps.length > 1 && <span className="rk-sep">{g.comps.length}</span>}
                        </button>
                      )
                    })}
                  </div>
                  <div className="rk-board" />
                </div>
              ))}
            </div>
            <div className="rk-post right" />
          </div>
          </div>

          <div className="rk-legenda">
            <span><i className="rk-dot st-verde" /> Disponível</span>
            <span><i className="rk-dot st-amarelo" /> Parcial</span>
            <span><i className="rk-dot st-vermelho" /> Vazio</span>
            <span><i className="rk-sq" /> Selecionado</span>
          </div>
        </div>

        <aside className="rk-painel card">
          {!gaveta ? (
            <div className="muted" style={{ textAlign: 'center', padding: '30px 10px' }}>
              🖱️<br />Clique em qualquer gaveta para abrir
            </div>
          ) : (
            <>
              <div className="rk-ptopo">
                <div>
                  <div className="rk-pcod">GAVETA {shelf.nome}-{gaveta.gaveta}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{gaveta.totalItens} itens nesta gaveta</div>
                </div>
                <span className={`rk-badge st-${gaveta.status}`}>
                  {gaveta.status === 'verde' ? 'Disponível' : gaveta.status === 'amarelo' ? 'Parcial' : 'Vazia'}
                </span>
              </div>

              <div className="rk-lista">
                {gaveta.comps.map((c, i) => {
                  const comItem = c.itens.filter(x => x.qtd > 0)
                  return (
                    <div key={i}>
                      {gaveta.comps.length > 1 && <div className="rk-seprot">Separação {c.comp || i + 1}</div>}
                      {comItem.length === 0
                        ? <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>Vazia</div>
                        : comItem.map((it, j) => (
                          <button key={j} className="rk-item" onClick={() => abrirItem(it.item_id)}>
                            <span className="rk-thumb">
                              {it.foto ? <img src={it.foto} alt="" /> : <span className="rk-semfoto">📦</span>}
                            </span>
                            <span className="rk-iinfo">
                              <span className="rk-inome">{it.nome}</span>
                              <span className="rk-isku">{it.codigo_m}</span>
                            </span>
                            <span className="rk-iqtd">{it.qtd}<span>un</span></span>
                          </button>
                        ))}
                    </div>
                  )
                })}
              </div>

              <button className="secundario add" onClick={() => setGavetaSel(null)}>Fechar gaveta</button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
