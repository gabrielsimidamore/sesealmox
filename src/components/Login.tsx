import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar() {
    setErro(''); setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('Email ou senha inválidos.')
    setCarregando(false)
  }

  return (
    <div className="center">
      <div className="card login">
        <div className="brand big">📦 Estoque</div>
        <p className="muted">Entre para pesquisar os itens</p>
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && entrar()} />
        {erro && <div className="erro">{erro}</div>}
        <button className="primario" onClick={entrar} disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
