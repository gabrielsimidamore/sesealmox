import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase, type Prateleira } from '../lib/supabase'
import type { GavetaInfo } from './PrateleiraView'

const PrateleiraView = lazy(() => import('./PrateleiraView'))

type Loc = { id: string; codigo: string; prateleira_id: string | null; linha: number | null; coluna: number | null }
type ItemGaveta = { quantidade: number; codigo_m: string; nome: string | null }

// prefixo que define a prateleira: "7B-3E1" -> "7B"
function prefixo(codigo: string) {
  return codigo.includes('-') ? codigo.split('-')[0] : codigo
}

export default function Mapa() {
  const [prateleiras, setPrateleiras] = useState<Prateleira[]>([])
  const [locs, setLocs] = useState<Loc[]>([])
  const [status, setStatus] = useState<Record<string, boolean>>({})
  const [usados, setUsados] = useState<Set<string>>(new Set())
  const [selId, setSelId] = useState<string | null>(null)
  const [selSlot, setSelSlot] = useState<{ linha: number; coluna: number } | null>(null)
  const [itensGaveta, setItensGaveta] = useState<ItemGaveta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)

  async function recarregar() {
    const [pr, lc, il] = await Promise.all([
      supabase.from('prateleiras').select('*').order('created_at'),
      supabase.from('locacoes').select('id, codigo, prateleira_id, linha, coluna'),
      supabase.from('item_locacoes').select('locacao_id, quantidade'),
    ])
    const st: Record<string, boolean> = {}
    const us = new Set<string>()
    for (const r of (il.data || []) as any[]) {
      us.add(r.locacao_id)
      if ((r.quantidade || 0) > 0) st[r.locacao_id] = true
    }
    const prs = (pr.data as Prateleira[]) || []
    const locsData = (lc.data as Loc[]) || []
    setPrateleiras(prs); setLocs(locsData); setStatus(st); setUsados(us)
    return { prs, locsData, us }
  }

  // Cria/atualiza prateleiras a partir das locações usadas nos itens
  async function sincronizar(prs: Prateleira[], locsData: Loc[], us: Set<string>) {
    setSincronizando(true)
    const usadas = locsData.filter(l => us.has(l.id))
    const grupos = new Map<string, Loc[]>()
    for (const l of usadas) {
      const k = prefixo(l.codigo)
      if (!grupos.has(k)) grupos.set(k, [])
      grupos.get(k)!.push(l)
    }
    let i = prs.length
    for (const [nome, ls] of grupos) {
      ls.sort((a, b) => a.codigo.localeCompare(b.codigo))
      const n = ls.length
      const colunas = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(n))))
      const linhas = Math.max(1, Math.ceil(n / colunas))
      let pr = prs.find(p => p.nome === nome)
      if (!pr) {
        const pos_x = 20 + (i % 4) * 210
        const pos_z = 20 + Math.floor(i / 4) * 210
        const { data } = await supabase.from('prateleiras')
          .insert({ nome, linhas, colunas, pos_x, pos_z }).select().single()
        pr = data as Prateleira; i++
      } else if (pr.linhas !== linhas || pr.colunas !== colunas) {
        await supabase.from('prateleiras').update({ linhas, colunas }).eq('id', pr.id)
      }
      for (let idx = 0; idx < ls.length; idx++) {
        const linha = Math.floor(idx / colunas), coluna = idx % colunas
        const l = ls[idx]
        if (l.prateleira_id !== pr!.id || l.linha !== linha || l.coluna !== coluna) {
          await supabase.from('locacoes').update({ prateleira_id: pr!.id, linha, coluna }).eq('id', l.id)
        }
      }
    }
    await recarregar()
    setSincronizando(false)
  }

  useEffect(() => {
    (async () => {
      const { prs, locsData, us } = await recarregar()
      const usadasSemPrat = locsData.some(l => us.has(l.id) && !l.prateleira_id)
      const gruposNovos = new Set([...us].map(id => {
        const l = locsData.find(x => x.id === id); return l ? prefixo(l.codigo) : ''
      }))
      const faltamShelves = [...gruposNovos].some(nome => nome && !prs.find(p => p.nome === nome))
      if (usadasSemPrat || faltamShelves) await sincronizar(prs, locsData, us)
      setCarregando(false)
    })()
  }, [])

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

  async function abrirSlot(linha: number, coluna: number) {
    setSelSlot({ linha, coluna })
    const loc = locs.find(l => l.prateleira_id === selId && l.linha === linha && l.coluna === coluna)
    if (!loc) { setItensGaveta([]); return }
    const { data } = await supabase
      .from('item_locacoes').select('quantidade, itens(codigo_m, nome)').eq('locacao_id', loc.id)
    setItensGaveta(((data as any[]) || []).map(r => ({ quantidade: r.quantidade, codigo_m: r.itens?.codigo_m, nome: r.itens?.nome })))
  }

  // ---------- Foco 3D numa prateleira ----------
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
          <button className="secundario" onClick={() => { setSelId(null); setSelSlot(null) }}>← Voltar ao mapa</button>
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
                <div className="muted">Clique numa gaveta para abrir e ver o conteúdo.</div>
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
                </>
              ) : (
                <div className="muted">Gaveta livre (sem locação atribuída).</div>
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
      <div className="page-head">
        <h2>Mapa do estoque</h2>
        <button className="secundario" style={{ width: 'auto' }} disabled={sincronizando}
          onClick={() => sincronizar(prateleiras, locs, usados)}>
          {sincronizando ? 'Gerando…' : '↻ Regenerar'}
        </button>
      </div>
      <div className="muted pad" style={{ paddingTop: 0 }}>
        Prateleiras geradas automaticamente das suas locações. Arraste pelo ⠿ para organizar. Clique para ver em 3D.
      </div>

      <div className="board">
        {carregando ? (
          <div className="muted pad">Carregando…</div>
        ) : prateleiras.length === 0 ? (
          <div className="muted pad">Nenhuma prateleira ainda. Cadastre itens com locação (ex: 7B-3E1) que o mapa aparece.</div>
        ) : prateleiras.map(p => {
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
    </div>
  )
}
