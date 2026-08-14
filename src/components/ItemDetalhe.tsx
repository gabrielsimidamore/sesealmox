import { useEffect, useState } from 'react'
import type { Item } from '../lib/supabase'

export default function ItemDetalhe({ item, onFechar }: { item: Item; onFechar: () => void }) {
  const fotos = (item.fotos && item.fotos.length > 0)
    ? item.fotos
    : (item.foto_url ? [item.foto_url] : [])
  const [sel, setSel] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [visivel, setVisivel] = useState(false)

  // anima a entrada no próximo frame após montar
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(r)
  }, [])

  function fechar() {
    setVisivel(false)
    window.setTimeout(onFechar, 260) // espera a animação de saída
  }

  // fechar com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') fechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`drawer-overlay${visivel ? ' aberto' : ''}`} onClick={fechar}>
      <aside
        className={`drawer${visivel ? ' aberto' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-topo">
          <div className="cod">{item.codigo_m}</div>
          <button className="drawer-fechar" onClick={fechar} aria-label="Fechar">✕</button>
        </div>

        <div className="drawer-corpo">
          <div className="foto-grande" onClick={() => fotos[sel] && setZoom(true)}>
            {fotos.length > 0
              ? <img src={fotos[sel]} alt={item.nome || item.codigo_m} />
              : <div className="sem-foto grande">Sem foto</div>}
          </div>
          {fotos.length > 1 && (
            <div className="galeria">
              {fotos.map((u, i) => (
                <img key={i} src={u} className={i === sel ? 'sel' : ''} onClick={() => setSel(i)} alt="" />
              ))}
            </div>
          )}

          <h2>{item.nome || item.codigo_m}</h2>
          <div className="campos">
            <div><span className="rot">Código M</span><b>{item.codigo_m}</b></div>
            {item.categoria && <div><span className="rot">Categoria</span>{item.categoria}</div>}

            {item.locais && item.locais.length > 0 && (
              <div>
                <span className="rot">Endereços</span>
                <div className="locais-lista">
                  {item.locais.map((l, i) => (
                    <div className="li" key={i}>
                      <span>📍 {l.codigo}</span>
                      <span className={`tag ${l.vazio ? 'vazio' : 'loc'}`}>{l.vazio ? 'vazio' : 'com estoque'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.descricao && <div className="desc"><span className="rot">Descrição</span>{item.descricao}</div>}
          </div>
        </div>
      </aside>

      {zoom && (
        <div className="lightbox" onClick={(e) => { e.stopPropagation(); setZoom(false) }}>
          <img src={fotos[sel]} alt="" />
        </div>
      )}
    </div>
  )
}
