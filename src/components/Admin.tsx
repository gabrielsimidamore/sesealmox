import { useEffect, useState } from 'react'
import { supabase, type Item, type LocalRef } from '../lib/supabase'

const vazio = { codigo_m: '', nome: '', descricao: '', categoria: '' }
const locVazia: LocalRef = { codigo: '', vazio: false }

export default function Admin() {
  const [itens, setItens] = useState<Item[]>([])
  const [form, setForm] = useState<any>(vazio)
  const [locs, setLocs] = useState<LocalRef[]>([{ ...locVazia }])
  const [fotosAtuais, setFotosAtuais] = useState<string[]>([])
  const [fotosNovas, setFotosNovas] = useState<File[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  async function carregar() {
    const { data: its } = await supabase
      .from('itens')
      .select('*, item_locacoes(vazio, locacoes(codigo))')
      .order('created_at', { ascending: false })
    setItens((its || []).map((i: any) => ({
      ...i,
      locais: (i.item_locacoes || []).map((il: any) => ({ codigo: il.locacoes?.codigo || '', vazio: il.vazio })),
    })))
  }
  useEffect(() => { carregar() }, [])

  function limpar() {
    setForm(vazio); setLocs([{ ...locVazia }]); setFotosAtuais([]); setFotosNovas([])
    setEditId(null); setMsg('')
  }

  function editar(i: Item) {
    setForm({ codigo_m: i.codigo_m, nome: i.nome || '', descricao: i.descricao || '', categoria: i.categoria || '' })
    setLocs(i.locais && i.locais.length > 0 ? i.locais.map(l => ({ ...l })) : [{ ...locVazia }])
    setFotosAtuais(i.fotos && i.fotos.length > 0 ? [...i.fotos] : (i.foto_url ? [i.foto_url] : []))
    setFotosNovas([])
    setEditId(i.id); setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Texto do endereço -> locacao_id: reaproveita se já existir igual, senão cria.
  async function resolverLocacao(codigo: string): Promise<string> {
    const { data: achada } = await supabase.from('locacoes').select('id').eq('codigo', codigo).maybeSingle()
    if (achada) return achada.id
    const { data: nova, error } = await supabase.from('locacoes').insert({ codigo }).select('id').single()
    if (error) throw error
    return nova!.id
  }

  async function salvar() {
    if (!form.codigo_m.trim()) { setMsg('Informe o código M.'); return }
    setSalvando(true); setMsg('')
    try {
      // 1) upload das fotos novas
      const urls: string[] = []
      for (const f of fotosNovas) {
        const nome = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${f.name.replace(/[^\w.\-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('fotos').upload(nome, f, { upsert: true })
        if (upErr) throw upErr
        urls.push(supabase.storage.from('fotos').getPublicUrl(nome).data.publicUrl)
      }
      const fotos = [...fotosAtuais, ...urls]

      // 2) resolver locações (dedup por código, ignora vazias)
      const vistos = new Set<string>()
      const locRows: { locacao_id: string; vazio: boolean }[] = []
      for (const l of locs) {
        const cod = l.codigo.trim()
        if (!cod || vistos.has(cod.toLowerCase())) continue
        vistos.add(cod.toLowerCase())
        locRows.push({ locacao_id: await resolverLocacao(cod), vazio: l.vazio })
      }

      // 3) salvar o item
      const payload = {
        codigo_m: form.codigo_m.trim(),
        nome: form.nome || null,
        descricao: form.descricao || null,
        categoria: form.categoria || null,
        fotos,
        foto_url: fotos[0] ?? null,               // compat
        locacao_id: locRows[0]?.locacao_id ?? null, // compat
        updated_at: new Date().toISOString(),
      }
      let itemId = editId
      if (editId) {
        const { error } = await supabase.from('itens').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('itens').insert(payload).select('id').single()
        if (error) throw error
        itemId = data!.id
      }

      // 4) regravar as locações do item
      await supabase.from('item_locacoes').delete().eq('item_id', itemId)
      if (locRows.length > 0) {
        const { error } = await supabase.from('item_locacoes')
          .insert(locRows.map(r => ({ item_id: itemId, locacao_id: r.locacao_id, vazio: r.vazio })))
        if (error) throw error
      }

      setMsg(editId ? 'Item atualizado ✓' : 'Item cadastrado ✓')
      limpar(); carregar()
    } catch (e: any) {
      setMsg('Erro: ' + (e.message || e))
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este item?')) return
    await supabase.from('itens').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="admin">
      <div className="card">
        <h3>{editId ? 'Editar item' : 'Novo item'}</h3>
        <input placeholder="Código M *" value={form.codigo_m} onChange={e => setForm({ ...form, codigo_m: e.target.value })} />
        <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />

        <div className="secao-rot">Endereços / Locações</div>
        {locs.map((l, idx) => (
          <div className="loc-row" key={idx}>
            <input
              placeholder="Endereço (ex: 7B-3E1)"
              value={l.codigo}
              onChange={e => setLocs(locs.map((x, i) => i === idx ? { ...x, codigo: e.target.value } : x))}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={l.vazio}
                onChange={e => setLocs(locs.map((x, i) => i === idx ? { ...x, vazio: e.target.checked } : x))}
              />
              Vazio
            </label>
            <button
              className="rm"
              onClick={() => setLocs(locs.length > 1 ? locs.filter((_, i) => i !== idx) : [{ ...locVazia }])}
              aria-label="Remover endereço"
            >✕</button>
          </div>
        ))}
        <button className="secundario add" onClick={() => setLocs([...locs, { ...locVazia }])}>+ Adicionar endereço</button>

        <div className="secao-rot">Fotos</div>
        {(fotosAtuais.length > 0 || fotosNovas.length > 0) && (
          <div className="fotos-grid">
            {fotosAtuais.map((url, idx) => (
              <div className="foto-item" key={'a' + idx}>
                <img src={url} alt="" />
                <button onClick={() => setFotosAtuais(fotosAtuais.filter((_, i) => i !== idx))} aria-label="Remover">✕</button>
              </div>
            ))}
            {fotosNovas.map((f, idx) => (
              <div className="foto-item" key={'n' + idx}>
                <img src={URL.createObjectURL(f)} alt="" />
                <button onClick={() => setFotosNovas(fotosNovas.filter((_, i) => i !== idx))} aria-label="Remover">✕</button>
              </div>
            ))}
          </div>
        )}
        <label className="foto-btn">
          📷 Adicionar fotos
          <input
            type="file" accept="image/*" capture="environment" multiple hidden
            onChange={e => {
              const fs = Array.from(e.target.files || [])
              setFotosNovas(prev => [...prev, ...fs]);
              (e.target as HTMLInputElement).value = ''
            }}
          />
        </label>

        {msg && <div className={msg.startsWith('Erro') ? 'erro' : 'ok'}>{msg}</div>}
        <div className="row">
          <button className="primario" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Cadastrar')}
          </button>
          {editId && <button className="secundario" onClick={limpar}>Cancelar</button>}
        </div>
      </div>

      <div className="card">
        <h3>Itens cadastrados ({itens.length})</h3>
        <div className="lista">
          {itens.map(i => (
            <div key={i.id} className="linha">
              <div className="thumb">
                {i.fotos && i.fotos.length > 0 ? <img src={i.fotos[0]} alt="" /> : <span className="sem-foto">—</span>}
              </div>
              <div className="info">
                <div className="cod">{i.codigo_m}</div>
                <div className="nome">{i.nome || '—'}</div>
                <div className="meta">
                  {(i.locais || []).map((l, idx) => (
                    <span key={idx} className={`tag ${l.vazio ? 'vazio' : 'loc'}`}>📍 {l.codigo}{l.vazio ? ' • vazio' : ''}</span>
                  ))}
                </div>
              </div>
              <div className="acoes">
                <button onClick={() => editar(i)}>✏️</button>
                <button onClick={() => excluir(i.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
