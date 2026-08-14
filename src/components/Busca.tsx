import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { supabase, type Item } from '../lib/supabase'

const Scanner = lazy(() => import('./Scanner'))

export default function Busca({ onAbrir }: { onAbrir: (i: Item) => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(false)
  const [scan, setScan] = useState(false)
  const [categorias, setCategorias] = useState<string[]>([])
  const [filtroCat, setFiltroCat] = useState('')
  const [soVazias, setSoVazias] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    supabase.from('itens').select('categoria').then(({ data }) => {
      setCategorias([...new Set((data || []).map((r: any) => r.categoria).filter(Boolean))] as string[])
    })
  }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    const termoLimpo = termo.trim()
    const temFiltro = !!filtroCat || soVazias
    if (termoLimpo.length < 1 && !temFiltro) { setResultados([]); return }
    setCarregando(true)
    timer.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('buscar_itens', { termo: termoLimpo })
      let res = (!error && data) ? (data as Item[]) : []
      if (filtroCat) res = res.filter(r => (r.categoria || '') === filtroCat)
      if (soVazias) res = res.filter(r => (r.locais || []).some(l => l.vazio))
      setResultados(res)
      setCarregando(false)
    }, 300)
    return () => window.clearTimeout(timer.current)
  }, [termo, filtroCat, soVazias])

  const temFiltro = !!filtroCat || soVazias

  return (
    <div>
      <div className="page-head"><h2>Buscar</h2></div>

      <div className="busca-linha">
        <input
          className="busca"
          autoFocus
          placeholder="Código M, nome ou descrição…"
          value={termo}
          onChange={e => setTermo(e.target.value)}
        />
        <button className="scan-btn" onClick={() => setScan(true)} aria-label="Escanear código" title="Escanear código">📷</button>
      </div>

      <div className="filtros">
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className={`filtro-chip${soVazias ? ' on' : ''}`}
          onClick={() => setSoVazias(v => !v)}
        >
          {soVazias ? '☑' : '☐'} Só vazias
        </button>
      </div>

      {scan && (
        <Suspense fallback={<div className="scanner-overlay"><div className="muted pad">Abrindo câmera…</div></div>}>
          <Scanner onLer={(t) => { setTermo(t); setScan(false) }} onFechar={() => setScan(false)} />
        </Suspense>
      )}

      {carregando && <div className="muted pad">Buscando…</div>}
      {!carregando && (termo || temFiltro) && resultados.length === 0 && (
        <div className="muted pad">Nada encontrado.</div>
      )}
      {!termo && !temFiltro && <div className="muted pad">Digite ou use os filtros para pesquisar.</div>}

      <div className="lista">
        {resultados.map(it => (
          <button key={it.id} className="linha" onClick={() => onAbrir(it)}>
            <div className="thumb">
              {it.fotos && it.fotos.length > 0
                ? <img src={it.fotos[0]} alt="" />
                : <span className="sem-foto">sem foto</span>}
            </div>
            <div className="info">
              <div className="cod">{it.codigo_m}</div>
              <div className="nome">{it.nome || '—'}</div>
              <div className="meta">
                {it.categoria && <span className="tag">{it.categoria}</span>}
                {(it.locais || []).map((l, idx) => (
                  <span key={idx} className={`tag ${l.vazio ? 'vazio' : 'loc'}`}>
                    📍 {l.codigo}{l.vazio ? ' • vazio' : ` • ${l.quantidade ?? 0}`}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
