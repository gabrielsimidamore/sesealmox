import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase, type Prateleira } from '../lib/supabase'
import type { GavetaInfo } from './PrateleiraView'

const PrateleiraView = lazy(() => import('./PrateleiraView'))

type Loc = { id: string; codigo: string; prateleira_id: string | null; linha: number | null; coluna: number | null }
type ItemGaveta = { quantidade: number; codigo_m: string; nome: string | null }

export default function Mapa() {
  const [prateleiras, setPrateleiras] = useState<Prateleira[]>([])
  const [locs, setLocs] = useState<Loc[]>([])
  const [status, setStatus] = useState<Record<string, boolean>>({})
  const [selId, setSelId] = useState<string | null>(null)
  const [selSlot, setSelSlot] = useState<{ linha: number; coluna: number } | null>(null)
  const [itensGaveta, setItensGaveta] = useState<ItemGaveta[]>([])
  const [novoCod, setNovoCod] = useState('')

  async function carregar() {
    const [pr, lc, il] = await Promise.all([
      supabase.from('prateleiras').select('*').order('created_at'),
      supabase.from('locacoes').select('id, codigo, prateleira_id, linha, coluna'),
      supabase.from('item_locacoes').select('locacao_id, quantidade'),
    ])
    setPrateleiras((pr.data as Prateleira[]) || [])
    setLocs((lc.data as Loc[]) || [])
    const st: Record<string, boolean> = {}
    for (const r of (il.data || []) as any[]) {
      if ((r.quantidade || 0) > 0) st[r.locacao_id] = true
    }
    setStatus(st)
  }
  useEffect(() => { carregar() }, [])

  async function novaPrateleira() {
    const n = prateleiras.length + 1
    await supabase.from('prateleiras').insert({ nome: `Prateleira ${n}`, pos_x: 40 + n * 20, pos_z: 40 })
    carregar()
  }

  function iniciarDrag(e: React.PointerEvent, p: Prateleira) {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY, ox = p.pos_x, oz = p.pos_z
    const mover = (ev: PointerEvent) => {
      const nx = Math.max(0, ox + (ev.clientX - startX)), nz = Math.max(0, oz + (ev.clientY - startY))
      setPrateleiras(prev => prev.map(s => s.id === p.id ? { ...s, pos_x: nx, pos_z: nz } : s))
    }
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      const nx = Math.max(0, ox + (ev.clientX - startX)), nz = Math.max(0, oz + (ev.clientY - startY))
      supabase.from('prateleiras').update({ pos_x: nx, pos_z: nz }).eq('id', p.id)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  async function atualizar(id: string, campos: Partial<Prateleira>) {
    setPrateleiras(prev => prev.map(s => s.id === id ? { ...s, ...campos } : s))
    await supabase.from('prateleiras').update(campos).eq('id', id)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta prateleira? As gavetas voltam a ficar sem posição.')) return
    await supabase.from('prateleiras').delete().eq('id', id)
    if (selId === id) setSelId(null)
    carregar()
  }

  async function abrirSlot(linha: number, coluna: number) {
    setSelSlot({ linha, coluna }); setNovoCod('')
    const loc = locs.find(l => l.prateleira_id === selId && l.linha === linha && l.coluna === coluna)
    if (!loc) { setItensGaveta([]); return }
    const { data } = await supabase
      .from('item_locacoes').select('quantidade, itens(codigo_m, nome)').eq('locacao_id', loc.id)
    setItensGaveta(((data as any[]) || []).map(r => ({ quantidade: r.quantidade, codigo_m: r.itens?.codigo_m, nome: r.itens?.nome })))
  }

  async function atribuir(linha: number, coluna: number) {
    const cod = novoCod.trim()
    if (!cod || !selId) return
    const existente = locs.find(l => l.codigo.toLowerCase() === cod.toLowerCase())
    if (existente) {
      await supabase.from('locacoes').update({ prateleira_id: selId, linha, coluna }).eq('id', existente.id)
    } else {
      await supabase.from('locacoes').insert({ codigo: cod, prateleira_id: selId, linha, coluna })
    }
    await carregar(); setNovoCod('')
  }

  async function removerDaGaveta(locId: string) {
    await supabase.from('locacoes').update({ prateleira_id: null, linha: null, coluna: null }).eq('id', locId)
    setSelSlot(null); carregar()
  }

  // ---- Foco numa prateleira ----
  const shelf = prateleiras.find(p => p.id === selId) || null
  if (shelf) {
    const gavetas: GavetaInfo[] = []
    let vazias = 0, ocupadas = 0
    for (let l = 0; l < shelf.linhas; l++) {
      for (let c = 0; c < shelf.colunas; c++) {
        const loc = locs.find(x => x.prateleira_id === shelf.id && x.linha === l && x.coluna === c)
        const temItem = loc ? !!status[loc.id] : false
        if (loc) { temItem ? ocupadas++ : vazias++ }
        gavetas.push({ linha: l, coluna: c, codigo: loc?.codigo, temItem, assigned: !!loc })
      }
    }
    const slotLoc = selSlot ? locs.find(x => x.prateleira_id === shelf.id && x.linha === selSlot.linha && x.coluna === selSlot.coluna) : null

    return (
      <div>
        <div className="page-head">
          <button className="secundario" onClick={() => { setSelId(null); setSelSlot(null) }}>← Voltar à planta</button>
          <h2 style={{ marginLeft: 8, flex: 1 }}>{shelf.nome}</h2>
        </div>

        <div className="foco">
          <div className="foco-3d">
            <Suspense fallback={<div className="muted pad">Carregando 3D…</div>}>
              <PrateleiraView
                linhas={shelf.linhas} colunas={shelf.colunas} gavetas={gavetas}
                selKey={selSlot ? `${selSlot.linha}-${selSlot.coluna}` : null}
                onSelect={abrirSlot}
              />
            </Suspense>
          </div>

          <aside className="foco-info">
            <div className="card resumo">
              <div className="num" style={{ color: 'var(--vazio-txt)' }}>{vazias}</div>
              <div className="resumo-txt">gavetas vazias<span className="muted"> · {ocupadas} com item</span></div>
            </div>

            <div className="card">
              {!selSlot ? (
                <div className="muted">Clique numa gaveta para ver o conteúdo.</div>
              ) : slotLoc ? (
                <>
                  <h3>📍 {slotLoc.codigo}</h3>
                  {itensGaveta.length === 0
                    ? <div className="muted">Gaveta vazia (sem itens).</div>
                    : <div className="lista">
                        {itensGaveta.map((it, i) => (
                          <div key={i} className="linha">
                            <div className="info"><div className="cod">{it.codigo_m}</div><div className="nome">{it.nome || '—'}</div></div>
                            <span className="tag loc">{it.quantidade}</span>
                          </div>
                        ))}
                      </div>}
                  <button className="secundario add" onClick={() => removerDaGaveta(slotLoc.id)}>Tirar locação desta gaveta</button>
                </>
              ) : (
                <>
                  <h3>Gaveta livre</h3>
                  <div className="muted" style={{ marginBottom: 8 }}>Linha {selSlot.linha + 1}, coluna {selSlot.coluna + 1}. Dê um código de locação:</div>
                  <input list="loc-sugest" placeholder="Código (ex: 7B-3E1)" value={novoCod} onChange={e => setNovoCod(e.target.value)} />
                  <datalist id="loc-sugest">{locs.map(l => <option key={l.id} value={l.codigo} />)}</datalist>
                  <button className="primario" onClick={() => atribuir(selSlot.linha, selSlot.coluna)}>Salvar na gaveta</button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // ---- Planta de cima ----
  return (
    <div>
      <div className="page-head">
        <h2>Mapa do estoque</h2>
        <button className="primario" style={{ width: 'auto' }} onClick={novaPrateleira}>+ Nova prateleira</button>
      </div>
      <div className="muted pad" style={{ paddingTop: 0 }}>Arraste pelo ⠿ para posicionar. Clique em “Ver 3D” para entrar na prateleira.</div>

      <div className="board">
        {prateleiras.length === 0 && <div className="muted pad">Nenhuma prateleira ainda. Crie a primeira.</div>}
        {prateleiras.map(p => {
          const total = p.linhas * p.colunas
          const comLoc = locs.filter(l => l.prateleira_id === p.id)
          return (
            <div key={p.id} className="shelf-card" style={{ left: p.pos_x, top: p.pos_z }}>
              <div className="shelf-top">
                <span className="shelf-drag" onPointerDown={e => iniciarDrag(e, p)}>⠿</span>
                <input className="shelf-nome" value={p.nome} onChange={e => atualizar(p.id, { nome: e.target.value })} />
                <button className="rm" onClick={() => excluir(p.id)}>✕</button>
              </div>
              <div className="shelf-dims">
                <label>Linhas<input type="number" min={1} max={12} value={p.linhas} onChange={e => atualizar(p.id, { linhas: Math.max(1, Number(e.target.value) || 1) })} /></label>
                <label>Colunas<input type="number" min={1} max={12} value={p.colunas} onChange={e => atualizar(p.id, { colunas: Math.max(1, Number(e.target.value) || 1) })} /></label>
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
    </div>
  )
}
