import { useEffect, useState } from 'react'
import { supabase, type Item } from '../lib/supabase'

const vazio = { codigo_m: '', nome: '', descricao: '', categoria: '' }

export default function Admin() {
  const [itens, setItens] = useState<Item[]>([])
  const [form, setForm] = useState<any>(vazio)
  const [endereco, setEndereco] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoAtual, setFotoAtual] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  async function carregar() {
    const { data: its } = await supabase
      .from('itens')
      .select('*, locacoes(codigo)')
      .order('created_at', { ascending: false })
    setItens((its || []).map((i: any) => ({ ...i, locacao_codigo: i.locacoes?.codigo })))
  }
  useEffect(() => { carregar() }, [])

  function limpar() {
    setForm(vazio); setEndereco(''); setEditId(null); setFoto(null); setFotoAtual(null)
  }

  function editar(i: Item) {
    setForm({
      codigo_m: i.codigo_m, nome: i.nome || '', descricao: i.descricao || '',
      categoria: i.categoria || '',
    })
    setEndereco(i.locacao_codigo || '')
    setEditId(i.id); setFoto(null); setFotoAtual(i.foto_url || null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Resolve o texto do endereço para um locacao_id: reaproveita se já existir
  // exatamente igual, senão cria um novo. Assim o item mostra o endereço tal como digitado.
  async function resolverEndereco(): Promise<string | null> {
    const end = endereco.trim()
    if (!end) return null
    const { data: achada } = await supabase
      .from('locacoes').select('id').eq('codigo', end).maybeSingle()
    if (achada) return achada.id
    const { data: nova, error } = await supabase
      .from('locacoes').insert({ codigo: end }).select('id').single()
    if (error) throw error
    return nova!.id
  }

  async function salvar() {
    if (!form.codigo_m.trim()) { setMsg('Informe o código M.'); return }
    setSalvando(true); setMsg('')
    let foto_url = fotoAtual
    try {
      const locacao_id = await resolverEndereco()
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

  return (
    <div className="admin">
      <div className="card">
        <h3>{editId ? 'Editar item' : 'Novo item'}</h3>
        <input placeholder="Código M *" value={form.codigo_m} onChange={e => setForm({ ...form, codigo_m: e.target.value })} />
        <input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        <textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        <input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
        <input placeholder="Endereço (ex: 7B-3E1)" value={endereco} onChange={e => setEndereco(e.target.value)} />

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
