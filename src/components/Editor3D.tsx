import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase, type Prateleira } from '../lib/supabase'
import type { Node3D } from './Cena3D'

const Cena3D = lazy(() => import('./Cena3D'))

const S = 0.02
const GRID = 0.25 // encaixe na grade (metros)
const snap = (mapUnits: number) => (Math.round((mapUnits * S) / GRID) * GRID) / S

type Objeto = {
  id: string; tipo: string; nome: string | null
  pos_x: number; pos_z: number; rot_y: number; larg: number; prof: number; alt: number
}

const DEFAULTS: Record<string, { larg: number; prof: number; alt: number; nome: string }> = {
  caixa: { larg: 0.6, prof: 0.6, alt: 0.6, nome: 'Caixa' },
  galao: { larg: 0.3, prof: 0.3, alt: 0.5, nome: 'Galão 25L' },
  pallet: { larg: 1.2, prof: 1.0, alt: 0.15, nome: 'Pallet' },
  porta_pallet: { larg: 1.4, prof: 1.0, alt: 2.5, nome: 'Porta-pallet' },
  parede: { larg: 3.0, prof: 0.12, alt: 2.5, nome: 'Parede' },
}
const TIPOS = [
  { t: 'prateleira', l: '🗄️ Prateleira' }, { t: 'porta_pallet', l: '🏗️ Porta-pallet' },
  { t: 'pallet', l: '🟫 Pallet' }, { t: 'caixa', l: '📦 Caixa' },
  { t: 'galao', l: '🛢️ Galão 25L' }, { t: 'parede', l: '🧱 Parede' },
]

export default function Editor3D() {
  const [prats, setPrats] = useState<Prateleira[]>([])
  const [objs, setObjs] = useState<Objeto[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [modo, setModo] = useState<'editar' | 'andar'>('editar')
  const [ferramenta, setFerramenta] = useState<'mover' | 'girar' | 'redimensionar'>('mover')
  const [colocando, setColocando] = useState<string | null>(null)

  async function carregar() {
    const [p, o] = await Promise.all([
      supabase.from('prateleiras').select('*').order('created_at'),
      supabase.from('objetos').select('*').order('created_at'),
    ])
    setPrats((p.data as Prateleira[]) || [])
    setObjs((o.data as Objeto[]) || [])
  }
  useEffect(() => { carregar() }, [])

  const nodes: Node3D[] = [
    ...prats.map(p => ({ id: p.id, kind: 'prat' as const, tipo: 'prateleira', nome: p.nome, pos_x: p.pos_x, pos_z: p.pos_z, rot_y: p.rotacao, larg: 0, prof: 0, alt: 0, linhas: p.linhas, colunas: p.colunas })),
    ...objs.map(o => ({ id: o.id, kind: 'obj' as const, tipo: o.tipo, nome: o.nome, pos_x: o.pos_x, pos_z: o.pos_z, rot_y: o.rot_y, larg: o.larg, prof: o.prof, alt: o.alt })),
  ]
  const sel = nodes.find(n => n.id === selId) || null

  async function criarEm(tipo: string, x: number, z: number) {
    const px = snap(x), pz = snap(z)
    if (tipo === 'prateleira') {
      const { data } = await supabase.from('prateleiras').insert({ nome: 'Prateleira', linhas: 3, colunas: 4, pos_x: px, pos_z: pz }).select().single()
      await carregar(); if (data) setSelId((data as any).id)
    } else {
      const d = DEFAULTS[tipo]
      const { data } = await supabase.from('objetos').insert({ tipo, nome: d.nome, larg: d.larg, prof: d.prof, alt: d.alt, pos_x: px, pos_z: pz }).select().single()
      await carregar(); if (data) setSelId((data as any).id)
    }
    setColocando(null)
  }

  async function girar90() {
    if (!sel) return
    const nr = (sel.rot_y + Math.PI / 2) % (Math.PI * 2)
    if (sel.kind === 'prat') await editarPrat(sel.id, { rotacao: nr })
    else await editarObj(sel.id, { rot_y: nr })
  }

  async function setPos(campo: 'pos_x' | 'pos_z', metros: number) {
    if (!sel) return
    const mapUnits = metros / S
    if (sel.kind === 'prat') await editarPrat(sel.id, { [campo]: mapUnits } as any)
    else await editarObj(sel.id, { [campo]: mapUnits } as any)
  }

  function onDragLive(id: string, x: number, z: number) {
    const px = snap(x), pz = snap(z)
    setPrats(prev => prev.map(p => p.id === id ? { ...p, pos_x: px, pos_z: pz } : p))
    setObjs(prev => prev.map(o => o.id === id ? { ...o, pos_x: px, pos_z: pz } : o))
  }
  async function onDragEnd(id: string) {
    const n = nodes.find(x => x.id === id); if (!n) return
    await supabase.from(n.kind === 'prat' ? 'prateleiras' : 'objetos').update({ pos_x: n.pos_x, pos_z: n.pos_z }).eq('id', id)
  }
  async function onRot(id: string, rad: number) {
    const n = nodes.find(x => x.id === id); if (!n) return
    if (n.kind === 'prat') await editarPrat(id, { rotacao: rad })
    else await editarObj(id, { rot_y: rad })
  }
  async function onResize(id: string, larg: number, alt: number, prof: number) {
    await editarObj(id, { larg, alt, prof })
  }

  async function editarObj(id: string, campos: Partial<Objeto>) {
    setObjs(prev => prev.map(o => o.id === id ? { ...o, ...campos } : o))
    await supabase.from('objetos').update(campos).eq('id', id)
  }
  async function editarPrat(id: string, campos: Partial<Prateleira>) {
    setPrats(prev => prev.map(p => p.id === id ? { ...p, ...campos } : p))
    await supabase.from('prateleiras').update(campos).eq('id', id)
  }
  async function excluir() {
    if (!sel) return
    await supabase.from(sel.kind === 'prat' ? 'prateleiras' : 'objetos').delete().eq('id', sel.id)
    setSelId(null); carregar()
  }

  return (
    <div>
      <div className="page-head">
        <h2>Armazém 3D</h2>
        <div className="row">
          <button className={`filtro-chip${modo === 'editar' ? ' on' : ''}`} onClick={() => setModo('editar')}>✏️ Editar</button>
          <button className={`filtro-chip${modo === 'andar' ? ' on' : ''}`} onClick={() => { setModo('andar'); setSelId(null) }}>🚶 Andar</button>
        </div>
      </div>

      <div className="foco">
        <div className="foco-3d">
          <Suspense fallback={<div className="muted pad">Carregando 3D…</div>}>
            <Cena3D nodes={nodes} selId={selId} modo={modo} ferramenta={ferramenta}
              colocando={colocando} onColocar={(x, z) => { if (colocando) criarEm(colocando, x, z) }}
              onSelect={setSelId} onDragLive={onDragLive} onDragEnd={onDragEnd} onRot={onRot} onResize={onResize} />
          </Suspense>
          {colocando && (
            <div className="colocar-banner">
              Clique no chão para posicionar <b>{colocando.replace('_', '-')}</b>
              <button className="secundario" onClick={() => setColocando(null)}>Cancelar</button>
            </div>
          )}
        </div>

        <aside className="foco-info">
          {modo === 'andar' ? (
            <div className="card">
              <h3>Modo andar (1ª pessoa)</h3>
              <div className="muted">Clique na cena para entrar. Use <b>W A S D</b> (ou setas) para andar e o mouse para olhar. <b>ESC</b> para sair.</div>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="secao-rot" style={{ marginTop: 0 }}>Ferramenta</div>
                <div className="row">
                  <button className={`filtro-chip${ferramenta === 'mover' ? ' on' : ''}`} onClick={() => setFerramenta('mover')}>✥ Mover</button>
                  <button className={`filtro-chip${ferramenta === 'girar' ? ' on' : ''}`} onClick={() => setFerramenta('girar')}>⟳ Girar</button>
                  <button className={`filtro-chip${ferramenta === 'redimensionar' ? ' on' : ''}`} onClick={() => setFerramenta('redimensionar')}>⤢ Tamanho</button>
                </div>
              </div>

              <div className="card">
                <div className="secao-rot" style={{ marginTop: 0 }}>Adicionar</div>
                <div className="add-grid">
                  {TIPOS.map(x => <button key={x.t} className={`secundario${colocando === x.t ? ' on' : ''}`} onClick={() => setColocando(x.t)}>{x.l}</button>)}
                </div>
              </div>

              <div className="card">
                {!sel ? (
                  <div className="muted">Clique num objeto para editar. Arraste as setas para mover; alterne para girar.</div>
                ) : (
                  <>
                    <h3 style={{ textTransform: 'capitalize' }}>{sel.tipo.replace('_', '-')}</h3>
                    {sel.kind === 'prat' ? (
                      <>
                        <input value={sel.nome || ''} onChange={e => editarPrat(sel.id, { nome: e.target.value })} placeholder="Nome" />
                        <div className="shelf-dims">
                          <label>Linhas<input type="number" min={1} max={12} value={sel.linhas} onChange={e => editarPrat(sel.id, { linhas: Math.max(1, Number(e.target.value) || 1) })} /></label>
                          <label>Colunas<input type="number" min={1} max={12} value={sel.colunas} onChange={e => editarPrat(sel.id, { colunas: Math.max(1, Number(e.target.value) || 1) })} /></label>
                        </div>
                      </>
                    ) : (
                      <>
                        <input value={sel.nome || ''} onChange={e => editarObj(sel.id, { nome: e.target.value })} placeholder="Nome" />
                        <div className="dims3">
                          <label>Larg (m)<input type="number" step="0.1" value={sel.larg} onChange={e => editarObj(sel.id, { larg: Number(e.target.value) })} /></label>
                          <label>Prof (m)<input type="number" step="0.1" value={sel.prof} onChange={e => editarObj(sel.id, { prof: Number(e.target.value) })} /></label>
                          <label>Alt (m)<input type="number" step="0.1" value={sel.alt} onChange={e => editarObj(sel.id, { alt: Number(e.target.value) })} /></label>
                        </div>
                      </>
                    )}
                    <div className="secao-rot">Posição exata</div>
                    <div className="dims3">
                      <label>X (m)<input type="number" step="0.25" value={+(sel.pos_x * S).toFixed(2)} onChange={e => setPos('pos_x', Number(e.target.value))} /></label>
                      <label>Z (m)<input type="number" step="0.25" value={+(sel.pos_z * S).toFixed(2)} onChange={e => setPos('pos_z', Number(e.target.value))} /></label>
                      <label>&nbsp;<button className="secundario" onClick={girar90}>⟳ 90°</button></label>
                    </div>
                    <button className="secundario add" onClick={excluir} style={{ color: 'var(--vazio-txt)' }}>🗑️ Excluir</button>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
