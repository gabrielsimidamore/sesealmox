import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { supabase, type Prateleira } from '../lib/supabase'
import type { GavetaInfo } from './PrateleiraView'

const PrateleiraView = lazy(() => import('./PrateleiraView'))

type Loc = { id: string; codigo: string; prateleira_id: string | null; linha: number | null; coluna: number | null }
type ItemGaveta = { item_id: string; quantidade: number; codigo_m: string; nome: string | null }

function prefixo(codigo: string) {
  return codigo.includes('-') ? codigo.split('-')[0] : codigo
}

export default function Mapa() {
  const [prateleiras, setPrateleiras] = useState<Prateleira[]>([])
  const [locs, setLocs] = useState<Loc[]>([])
  const [status, setStatus] = useState<Record<string, boolean>>({})
  const [itensLista, setItensLista] = useState<{ codigo_m: string; nome: string | null }[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [selSlot, setSelSlot] = useState<{ linha: number; coluna: number } | null>(null)
  const [itensGaveta, setItensGaveta] = useState<ItemGaveta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState({ cod: '', nome: '', qtd: 1 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef(pan)
  panRef.current = pan

  async function recarregar() {
    const [pr, lc, il, it] = await Promise.all([
      supabase.from('prateleiras').select('*').order('created_at'),
      supabase.from('locacoes').select('id, codigo, prateleira_id, linha, coluna'),
      supabase.from('item_locacoes').select('locacao_id, quantidade'),
      supabase.from('itens').select('codigo_m, nome').order('codigo_m'),
    ])
    const st: Record<string, boolean> = {}
    for (const r of (il.data || []) as any[]) if ((r.quantidade || 0) > 0) st[r.locacao_id] = true
    setPrateleiras((pr.data as Prateleira[]) || [])
    setLocs((lc.data as Loc[]) || [])
    setStatus(st)
    setItensLista((it.data as any) || [])
  }
  useEffect(() => { recarregar().then(() => setCarregando(false)) }, [])

  function iniciarDrag(e: React.PointerEvent, p: Prateleira) {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY, ox = p.pos_x, oz = p.pos_z
    const mover = (ev: PointerEvent) => {
      const nx = ox + (ev.clientX - sx), nz = oz + (ev.clientY - sy)
      setPrateleiras(prev => prev.map(s => s.id === p.id ? { ...s, pos_x: nx, pos_z: nz } : s))
    }
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar)
      supabase.from('prateleiras').update({ pos_x: ox + (ev.clientX - sx), pos_z: oz + (ev.clientY - sy) }).eq('id', p.id)
    }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }

  function iniciarPan(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('.shelf-card')) return
    const sx = e.clientX, sy = e.clientY, ox = panRef.current.x, oy = panRef.current.y
    const mover = (ev: PointerEvent) => setPan({ x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })
    const up = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', up)
  }

  async function abrirSlot(linha: number, coluna: number) {
    setSelSlot({ linha, coluna }); setNovo({ cod: '', nome: '', qtd: 1 })
    const loc = locs.find(l => l.prateleira_id === selId && l.linha === linha && l.coluna === coluna)
    if (!loc) { setItensGaveta([]); return }
    const { data } = await supabase
      .from('item_locacoes').select('quantidade, item_id, itens(codigo_m, nome)').eq('locacao_id', loc.id)
    setItensGaveta(((data as any[]) || []).map(r => ({ item_id: r.item_id, quantidade: r.quantidade, codigo_m: r.itens?.codigo_m, nome: r.itens?.nome })))
  }

  async function mudarQtd(locId: string, itemId: string, novoV: number) {
    if (novoV < 0) return
    await supabase.from('item_locacoes').update({ quantidade: novoV }).eq('item_id', itemId).eq('locacao_id', locId)
    setItensGaveta(prev => prev.map(x => x.item_id === itemId ? { ...x, quantidade: novoV } : x))
    setStatus(prev => ({ ...prev, [locId]: itensGaveta.some(x => x.item_id === itemId ? novoV > 0 : x.quantidade > 0) }))
  }

  async function adicionarItem(locId: string) {
    const cod = novo.cod.trim()
    if (!cod) return
    let itemId: string
    const { data: ex } = await supabase.from('itens').select('id').ilike('codigo_m', cod).maybeSingle()
    if (ex) itemId = ex.id
    else {
      const { data, error } = await supabase.from('itens').insert({ codigo_m: cod, nome: novo.nome || null }).select('id').single()
      if (error) { alert('Erro ao criar item: ' + error.message); return }
      itemId = data!.id
    }
    const { data: il } = await supabase.from('item_locacoes').select('id').eq('item_id', itemId).eq('locacao_id', locId).maybeSingle()
    if (il) await supabase.from('item_locacoes').update({ quantidade: novo.qtd }).eq('id', il.id)
    else await supabase.from('item_locacoes').insert({ item_id: itemId, locacao_id: locId, quantidade: novo.qtd })
    setNovo({ cod: '', nome: '', qtd: 1 })
    await recarregar()
    if (selSlot) abrirSlot(selSlot.linha, selSlot.coluna)
  }

  // ---------- Foco 3D ----------
  const shelf = prateleiras.find(p => p.id === selId) || null
  if (shelf) {
    const gavetas: GavetaInfo[] = []
    let vazias = 0, ocupadas = 0
    for (let l = 0; l < shelf.linhas; l++) for (let c = 0; c < shelf.colunas; c++) {
      const loc = locs.find(x => x.prateleira_id === shelf.id && x.linha === l && x.coluna === c)
      const temItem = loc ? !!status[loc.id] : false
      if (loc) { temItem ? ocupadas++ : vazias++ }
      gavetas.push({ linha: l, coluna: c, codigo: loc?.codigo, temItem, assigned: !!loc })
    }
    const slotLoc = selSlot ? locs.find(x => x.prateleira_id === shelf.id && x.linha === selSlot.linha && x.coluna === selSlot.coluna) : null

    return (
      <div>
        <div className="page-head">
          <button className="secundario" onClick={() => { setSelId(null); setSelSlot(null) }}>← Voltar ao mapa</button>
          <h2 style={{ marginLeft: 8, flex: 1 }}>{shelf.nome}</h2>
        </div>
        <div className="foco">
          <div className="foco-3d">
            <Suspense fallback={<div className="muted pad">Carregando 3D…</div>}>
              <PrateleiraView linhas={shelf.linhas} colunas={shelf.colunas} gavetas={gavetas}
                selKey={selSlot ? `${selSlot.linha}-${selSlot.coluna}` : null} onSelect={abrirSlot} />
            </Suspense>
          </div>
          <aside className="foco-info">
            <div className="card resumo">
              <div className="num" style={{ color: 'var(--vazio-txt)' }}>{vazias}</div>
              <div className="resumo-txt">gavetas vazias<span className="muted"> · {ocupadas} com item</span></div>
            </div>
            <div className="card">
              {!slotLoc ? (
                <div className="muted">Clique numa gaveta para abrir e ver/editar o conteúdo.</div>
              ) : (
                <>
                  <h3>📍 {slotLoc.codigo}</h3>
                  {itensGaveta.length === 0 && <div className="muted" style={{ marginBottom: 10 }}>Gaveta vazia.</div>}
                  <div className="lista">
                    {itensGaveta.map(it => (
                      <div key={it.item_id} className="linha">
                        <div className="info"><div className="cod">{it.codigo_m}</div><div className="nome">{it.nome || '—'}</div></div>
                        <div className="stepper">
                          <button disabled={it.quantidade <= 0} onClick={() => mudarQtd(slotLoc.id, it.item_id, it.quantidade - 1)}>−</button>
                          <span className="qtd">{it.quantidade}</span>
                          <button onClick={() => mudarQtd(slotLoc.id, it.item_id, it.quantidade + 1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="secao-rot">Adicionar item nesta gaveta</div>
                  <input list="itens-sugest" placeholder="Código M" value={novo.cod} onChange={e => setNovo({ ...novo, cod: e.target.value })} />
                  <datalist id="itens-sugest">{itensLista.map(i => <option key={i.codigo_m} value={i.codigo_m}>{i.nome || ''}</option>)}</datalist>
                  <input placeholder="Nome (se for novo)" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} />
                  <div className="row">
                    <input type="number" min={0} className="qtd-input" value={novo.qtd} onChange={e => setNovo({ ...novo, qtd: Number(e.target.value) })} />
                    <button className="primario" onClick={() => adicionarItem(slotLoc.id)}>Adicionar</button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ---------- Mapa de cima ----------
  return (
    <div>
      <div className="page-head"><h2>Mapa do estoque</h2></div>
      <div className="muted pad" style={{ paddingTop: 0 }}>
        Arraste o <b>fundo</b> para navegar. Arraste pelo ⠿ para mover uma prateleira. Clique em “Ver 3D”.
      </div>
      <div className="board" onPointerDown={iniciarPan}>
        {carregando ? <div className="muted pad">Carregando…</div>
          : prateleiras.length === 0 ? <div className="muted pad">Nenhuma prateleira. Cadastre itens com locação (ex: 7B-3E1).</div>
          : (
            <div className="board-inner" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
              {prateleiras.map(p => {
                const total = p.linhas * p.colunas
                const comLoc = locs.filter(l => l.prateleira_id === p.id)
                return (
                  <div key={p.id} className="shelf-card mapa" style={{ left: p.pos_x, top: p.pos_z }}>
                    <div className="shelf-top">
                      <span className="shelf-drag" onPointerDown={e => iniciarDrag(e, p)}>⠿</span>
                      <span className="shelf-nome-txt">{p.nome}</span>
                    </div>
                    <div className="shelf-mini" style={{ gridTemplateColumns: `repeat(${p.colunas}, 1fr)` }}>
                      {Array.from({ length: total }).map((_, idx) => {
                        const l = Math.floor(idx / p.colunas), c = idx % p.colunas
                        const loc = comLoc.find(x => x.linha === l && x.coluna === c)
                        const cls = !loc ? 'vazio-slot' : status[loc.id] ? 'ok-slot' : 'red-slot'
                        return <span key={idx} className={`mini ${cls}`} />
                      })}
                    </div>
                    <button className="secundario" onClick={() => { setSelId(p.id); setSelSlot(null) }}>Ver 3D</button>
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
