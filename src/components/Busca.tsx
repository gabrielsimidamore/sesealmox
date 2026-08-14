import { useEffect, useRef, useState } from 'react'
import { supabase, type Item } from '../lib/supabase'

export default function Busca({ onAbrir }: { onAbrir: (i: Item) => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (termo.trim().length < 1) { setResultados([]); return }
    setCarregando(true)
    timer.current = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('buscar_itens', { termo: termo.trim() })
      if (!error && data) setResultados(data as Item[])
      setCarregando(false)
    }, 300)
    return () => window.clearTimeout(timer.current)
  }, [termo])

  return (
    <div>
      <input
        className="busca"
        autoFocus
        placeholder="Código M, nome ou descrição…"
        value={termo}
        onChange={e => setTermo(e.target.value)}
      />

      {carregando && <div className="muted pad">Buscando…</div>}
      {!carregando && termo && resultados.length === 0 && (
        <div className="muted pad">Nada encontrado para “{termo}”.</div>
      )}
      {!termo && <div className="muted pad">Digite para pesquisar um item.</div>}

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
                    📍 {l.codigo}{l.vazio ? ' • vazio' : ''}
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
