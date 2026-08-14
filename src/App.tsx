import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Item } from './lib/supabase'
import Login from './components/Login'
import Busca from './components/Busca'
import ItemDetalhe from './components/ItemDetalhe'
import Admin from './components/Admin'
import Relatorios from './components/Relatorios'
import Dashboard from './components/Dashboard'
import Inventario from './components/Inventario'
import Mapa from './components/Mapa'
import Editor3D from './components/Editor3D'

type Tela = 'busca' | 'dashboard' | 'mapa' | 'armazem' | 'inventario' | 'admin' | 'relatorios'

const navItens: { id: Tela; icone: string; label: string }[] = [
  { id: 'busca', icone: '🔍', label: 'Buscar' },
  { id: 'dashboard', icone: '📊', label: 'Dashboard' },
  { id: 'mapa', icone: '🗺️', label: 'Mapa 3D' },
  { id: 'armazem', icone: '🏭', label: 'Armazém 3D' },
  { id: 'inventario', icone: '✅', label: 'Inventário' },
  { id: 'admin', icone: '🛠️', label: 'Cadastro' },
  { id: 'relatorios', icone: '📋', label: 'Relatórios' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tela, setTela] = useState<Tela>('busca')
  const [itemAberto, setItemAberto] = useState<Item | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [tema, setTema] = useState<'claro' | 'escuro'>(() => {
    const t = localStorage.getItem('tema')
    if (t === 'claro' || t === 'escuro') return t
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light')
    localStorage.setItem('tema', tema)
  }, [tema])

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

  function irPara(t: Tela) {
    setTela(t); setItemAberto(null); setMenuAberto(false)
  }

  return (
    <div className="layout">
      <aside className={`sidebar${menuAberto ? ' aberta' : ''}`}>
        <div className="sidebar-brand">📦 <span>Estoque</span></div>
        <nav className="sidebar-nav">
          {navItens.map(n => (
            <button
              key={n.id}
              className={`nav-item${tela === n.id ? ' on' : ''}`}
              onClick={() => irPara(n.id)}
            >
              <span className="ic">{n.icone}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-rodape">
          <button className="nav-item" onClick={() => setTema(tema === 'escuro' ? 'claro' : 'escuro')}>
            <span className="ic">{tema === 'escuro' ? '☀️' : '🌙'}</span>
            {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <button className="nav-item sair" onClick={() => supabase.auth.signOut()}>
            <span className="ic">🚪</span>Sair
          </button>
        </div>
      </aside>

      {menuAberto && <div className="menu-overlay" onClick={() => setMenuAberto(false)} />}

      <div className="painel">
        <header className="topo-mobile">
          <button className="menu-btn" onClick={() => setMenuAberto(true)} aria-label="Menu">☰</button>
          <div className="brand">📦 Estoque</div>
        </header>

        <main className="conteudo">
          <div className="fade-in" key={tela}>
            {tela === 'busca' && <Busca onAbrir={(it) => setItemAberto(it)} />}
            {tela === 'dashboard' && <Dashboard />}
            {tela === 'mapa' && <Mapa />}
            {tela === 'armazem' && <Editor3D />}
            {tela === 'inventario' && <Inventario />}
            {tela === 'admin' && <Admin />}
            {tela === 'relatorios' && <Relatorios />}
          </div>
        </main>
      </div>

      {itemAberto && (
        <ItemDetalhe item={itemAberto} onFechar={() => setItemAberto(null)} />
      )}
    </div>
  )
}
