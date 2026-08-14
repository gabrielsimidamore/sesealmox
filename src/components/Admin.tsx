import { useEffect, useState } from 'react'
import { supabase, type Item, type Locacao } from '../lib/supabase'

const vazio = { codigo_m: '', nome: '', descricao: '', categoria: '', locacao_id: '' }

export default function Admin() {
  const [itens, setItens] = useState<Item[]>([])
  const [locacoes, setLocacoes] = useState<Locacao[]>([])
  const [form, setForm] = useState<any>(vazio)
  const [editId, setEditId] = useState<string | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoAtual, setFotoAtual] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [novaLoc, setNovaLoc] = useState({ codigo: '', descricao: '' })
  const [novoEndereco, setNovoEndereco] = useState('')

  async function carregar() {
    const { data: its } = await supabase.from('itens').select('*, locacoes(codigo)').order('created_at', { ascending: false })
    setItens((its || []).map((i: any) => ({ ...i, locacao_codigo: i.locacoes?.codigo })))
    const { data: locs } = await supabase.from('locacoes').select('*').order('codigo')
    setLocacoes(locs || [])
  }
  useEffect(() => { carregar() }, [])

  function limpar() {
    setForm(vazio); setEditId(null); setFoto(null); setFotoAtual(null); setNovoEndereco('')
  }

  function editar(i: Item) {
    setForm({
      codigo_m: i.codigo_m, nome: i.nome || '', descricao: i.descricao || '',
      categoria: i.categoria || '', locacao_id: i.locacao_id || ''
    })
    setEditId(i.id); setFoto(null); setFotoAtual(i.foto_url || null); setNovoEndereco('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar() {
    if (!form.codigo_m.trim()) { setMsg('Informe o código M.'); return }
    setSalvando(true); setMsg('')
    let foto_url = fotoAtual
    try {
      let locacao_id: string | null = form.locacao_id || null
      if (form.locacao_id === '__novo__') {
        const cod = novoEndereco.trim()
        if (!cod) { setMsg('Digite o novo endereço ou escolha um da lista.'); setSalvando(false); return }
        const existente = locacoes.find(l => l.codigo.toLowerCase() === cod.toLowerCase())
        if (existente) {
          locacao_id = existente.id
        } else {
          const { data: novaL, error: locErr } = await supabase
            .from('locacoes').insert({ codigo: cod }).select('id').single()
          if (locErr) throw locErr
          locacao_id = novaL!.id
        }
      }
      if (foto) {
        const nome = `${Date.now()}_${foto.name.replace(/[^\w.\-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('fotos').upload(nome, foto, { upsert: true })
        if (upErr) throw upErr
        foto_url = supabase.storage.from('fotos').getPublicUrl(nome).data.publicUrl
      }
      const payload = {
        codigo_m: form.codigo_m.trim(),
        nome: form.nome || null,
        descricao: form.descricao || null,
        categoria: form.categoria || null,
        locacao_id,
        foto_url,
        updated_at: new Date().toISOString(),
      }
      const resp = editId
        ? await supabase.from('itens').update(payload).eq('id', editId)
        : await supabase.from('itens').insert(payload)
      if (resp.error) throw resp.error
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

  async function addLocacao() {
    if (!novaLoc.codigo.trim()) return
    await supabase.from('locacoes').insert({ codigo: novaLoc.codigo.trim(), descricao: novaLoc.descricao || null })
    setNovaLoc({ codigo: '', descricao: '' }); carregar()
  }

  return (
    <div className="admin">
      <div className="card">
        <h3>{editId ? 'Editar item' : 'Novo item'}</h3>
        <input placeholder="Código M *" value={form.codigo_m} onChange={e => setForm({ ...form, codigo_m: e.target.value })} />
        <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
        <select value={form.locacao_id} onChange={e => setForm({ ...form, locacao_id: e.target.value })}>
          <option value="">— Endereço / Locação —</option>
          {locacoes.map(l => <option key={l.id} value={l.id}>{l.codigo}{l.descricao ? ` — ${l.descricao}` : ''}</option>)}
          <option value="__novo__">➕ Novo endereço…</option>
        </select>
        {form.locacao_id === '__novo__' && (
          <input
            placeholder="Digite o novo endereço (ex: 7B-3E1)"
            value={novoEndereco}
            onChange={e => setNovoEndereco(e.target.value.toUpperCase())}
            autoFocus
          />
        )}

        <label className="foto-btn">
          📷 {foto ? foto.name : (fotoAtual ? 'Trocar foto' : 'Tirar / escolher foto')}
          <input type="file" accept="image/*" capture="environment" hidden
            onChange={e => setFoto(e.target.files?.[0] || null)} />
        </label>
        {(foto || fotoAtual) && (
          <img className="preview" src={foto ? URL.createObjectURL(foto) : fotoAtual!} alt="" />
        )}

        {msg && <div className={msg.startsWith('Erro') ? 'erro' : 'ok'}>{msg}</div>}
        <div className="row">
          <button className="primario" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Cadastrar')}
          </button>
          {editId && <button className="secundario" onClick={limpar}>Cancelar</button>}
        </div>
      </div>

      <div className="card">
        <h3>Locações</h3>
        <div className="row">
          <input placeholder="Código (ex: A-01-02)" value={novaLoc.codigo} onChange={e => setNovaLoc({ ...novaLoc, codigo: e.target.value })} />
          <input placeholder="Descrição" value={novaLoc.descricao} onChange={e => setNovaLoc({ ...novaLoc, descricao: e.target.value })} />
          <button className="secundario" onClick={addLocacao}>+ Add</button>
        </div>
        <div className="chips">{locacoes.map(l => <span key={l.id} className="tag loc">{l.codigo}</span>)}</div>
      </div>

      <div className="card">
        <h3>Itens cadastrados ({itens.length})</h3>
        <div className="lista">
          {itens.map(i => (
            <div key={i.id} className="linha">
              <div className="thumb">{i.foto_url ? <img src={i.foto_url} alt="" /> : <span className="sem-foto">—</span>}</div>
              <div className="info">
                <div className="cod">{i.codigo_m}</div>
                <div className="nome">{i.nome || '—'}</div>
                {i.locacao_codigo && <div className="meta"><span className="tag loc">📍 {i.locacao_codigo}</span></div>}
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
