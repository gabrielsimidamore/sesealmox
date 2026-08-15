import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Grupo = { id: string; urls: string[]; quando: string; salvo: boolean }
type FormG = { codigo_m: string; nome: string; categoria: string; endereco: string; qtd: number }

const vazio: FormG = { codigo_m: '', nome: '', categoria: '', endereco: '', qtd: 1 }

export default function Recuperar() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [forms, setForms] = useState<Record<string, FormG>>({})
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.storage.from('fotos').list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } })
    if (error) { setMsg('Erro ao listar fotos: ' + error.message); setCarregando(false); return }
    const arquivos = (data || []).filter(f => f.name && !f.name.startsWith('.'))

    // agrupa fotos subidas com poucos segundos de diferença (mesmo item)
    const comTs = arquivos.map(f => ({ nome: f.name, ts: Number((f.name.match(/^(\d+)/) || [])[1] || 0) })).sort((a, b) => a.ts - b.ts)
    const gs: Grupo[] = []
    let atual: { nomes: string[]; ts: number } | null = null
    for (const f of comTs) {
      if (atual && f.ts - atual.ts < 120000) atual.nomes.push(f.nome)
      else { if (atual) gs.push(monta(atual)); atual = { nomes: [f.nome], ts: f.ts } }
    }
    if (atual) gs.push(monta(atual))
    setGrupos(gs.reverse())
    setCarregando(false)
  }

  function monta(a: { nomes: string[]; ts: number }): Grupo {
    return {
      id: a.nomes[0],
      urls: a.nomes.map(n => supabase.storage.from('fotos').getPublicUrl(n).data.publicUrl),
      quando: a.ts ? new Date(a.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
      salvo: false,
    }
  }

  function setF(id: string, campos: Partial<FormG>) {
    setForms(prev => ({ ...prev, [id]: { ...vazio, ...prev[id], ...campos } }))
  }

  async function salvar(g: Grupo) {
    const f = forms[g.id] || vazio
    if (!f.codigo_m.trim()) { setMsg('Informe o código M para ' + g.quando); return }
    setSalvandoId(g.id); setMsg('')
    try {
      const { data: item, error } = await supabase.from('itens').insert({
        codigo_m: f.codigo_m.trim(),
        nome: f.nome || null,
        categoria: f.categoria || null,
        fotos: g.urls,
        foto_url: g.urls[0] || null,
      }).select('id').single()
      if (error) throw error

      const end = f.endereco.trim()
      if (end) {
        let locId: string
        const { data: ex } = await supabase.from('locacoes').select('id').eq('codigo', end).maybeSingle()
        if (ex) locId = ex.id
        else {
          const { data: nova, error: e2 } = await supabase.from('locacoes').insert({ codigo: end }).select('id').single()
          if (e2) throw e2
          locId = nova!.id
        }
        const { error: e3 } = await supabase.from('item_locacoes')
          .insert({ item_id: item!.id, locacao_id: locId, quantidade: Math.max(0, Number(f.qtd) || 0) })
        if (e3) throw e3
      }
      setGrupos(prev => prev.map(x => x.id === g.id ? { ...x, salvo: true } : x))
      setMsg(`✓ ${f.codigo_m} cadastrado`)
    } catch (e: any) {
      const dup = e?.code === '23505' || /duplicate|unique/i.test(e?.message || '')
      setMsg(dup ? `Erro: já existe item com código "${f.codigo_m}".` : 'Erro: ' + (e.message || e))
    }
    setSalvandoId(null)
  }

  async function exportarBackup() {
    const [itens, locacoes, vinculos] = await Promise.all([
      supabase.from('itens').select('*'),
      supabase.from('locacoes').select('*'),
      supabase.from('item_locacoes').select('*'),
    ])
    const dump = { exportado_em: new Date().toISOString(), itens: itens.data, locacoes: locacoes.data, item_locacoes: vinculos.data }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `backup-estoque-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pendentes = grupos.filter(g => !g.salvo).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Recadastro pelas fotos</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {carregando ? 'Carregando…' : `${grupos.length} grupos de fotos · ${pendentes} pendentes`}
          </div>
        </div>
        <button className="secundario" onClick={exportarBackup}>⬇️ Exportar backup</button>
      </div>

      {msg && <div className={msg.startsWith('Erro') ? 'erro pad' : 'ok pad'}>{msg}</div>}

      {!carregando && grupos.length === 0 && <div className="card muted">Nenhuma foto encontrada no Storage.</div>}

      <div className="rec-grid">
        {grupos.map(g => {
          const f = forms[g.id] || vazio
          return (
            <div key={g.id} className={`card rec-card${g.salvo ? ' salvo' : ''}`}>
              <div className="rec-fotos">
                {g.urls.map((u, i) => <img key={i} src={u} alt="" onClick={() => window.open(u, '_blank')} />)}
              </div>
              <div className="rec-quando">📅 {g.quando}</div>
              {g.salvo ? (
                <div className="ok" style={{ textAlign: 'center', padding: '8px 0' }}>✓ Cadastrado</div>
              ) : (
                <>
                  <input placeholder="Código M *" value={f.codigo_m} onChange={e => setF(g.id, { codigo_m: e.target.value })} />
                  <input placeholder="Nome" value={f.nome} onChange={e => setF(g.id, { nome: e.target.value })} />
                  <input placeholder="Categoria" value={f.categoria} onChange={e => setF(g.id, { categoria: e.target.value })} />
                  <div className="row">
                    <input placeholder="Endereço (ex: 1H-3E1)" value={f.endereco} onChange={e => setF(g.id, { endereco: e.target.value })} />
                    <input className="qtd-input" type="number" min={0} value={f.qtd} onChange={e => setF(g.id, { qtd: Number(e.target.value) })} />
                  </div>
                  <button className="primario" disabled={salvandoId === g.id} onClick={() => salvar(g)}>
                    {salvandoId === g.id ? 'Salvando…' : 'Cadastrar item'}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
