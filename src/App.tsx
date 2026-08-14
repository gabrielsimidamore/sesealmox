import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Item } from './lib/supabase'
import Login from './components/Login'
import Busca from './components/Busca'
import ItemDetalhe from './components/ItemDetalhe'
import Admin from './components/Admin'

type Tela = 'busca' | 'admin'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tela, setTela] = useState<Tela>('busca')
  const [itemAberto, setItemAberto] = useState<Item | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (carregando) return <div className="center muted">Carregando…</div>
  if (!session) return <Login />

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">📦 Estoque</div>
        <nav>
          <button className={tela === 'busca' ? 'nav on' : 'nav'} onClick={() => { setTela('busca'); setItemAberto(null) }}>Buscar</button>
          <button className={tela === 'admin' ? 'nav on' : 'nav'} onClick={() => { setTela('admin'); setItemAberto(null) }}>Admin</button>
          <button className="nav sair" onClick={() => supabase.auth.signOut()}>Sair</button>
        </nav>
      </header>

      <main className="conteudo">
        {itemAberto ? (
          <ItemDetalhe item={itemAberto} onVoltar={() => setItemAberto(null)} />
        ) : tela === 'busca' ? (
          <Busca onAbrir={(it) => setItemAberto(it)} />
        ) : (
          <Admin />
        )}
      </main>
    </div>
  )
}
