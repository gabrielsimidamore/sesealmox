import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase, type Item, type LocalRef } from '../lib/supabase'
import { tempoVazia } from '../lib/datas'
import { registrarHistorico } from '../lib/historico'

type Hist = { id: string; tipo: string; descricao: string | null; usuario: string | null; created_at: string }

export default function ItemDetalhe({ item, onFechar }: { item: Item; onFechar: () => void }) {
  const fotos = (item.fotos && item.fotos.length > 0)
    ? item.fotos
    : (item.foto_url ? [item.foto_url] : [])
  const [sel, setSel] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const [locais, setLocais] = useState<LocalRef[]>(item.locais || [])
  const [salvandoLoc, setSalvandoLoc] = useState<string | null>(null)
  const [hist, setHist] = useState<Hist[]>([])

  useEffect(() => {
    const r = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(r)
  }, [])

  useEffect(() => {
    supabase.from('historico').select('*').eq('item_id', item.id)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHist((data as Hist[]) || []))
  }, [item.id])

  function fechar() {
    setVisivel(false)
    window.setTimeout(onFechar, 260)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { if (zoom) setZoom(false); else fechar() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  async function mudarQtd(l: LocalRef, novo: number) {
    if (!l.locacao_id || novo < 0) return
    setSalvandoLoc(l.locacao_id)
    const { error } = await supabase
      .from('item_locacoes').update({ quantidade: novo })
      .eq('item_id', item.id).eq('locacao_id', l.locacao_id)
    setSalvandoLoc(null)
    if (!error) {
      setLocais(locais.map(x => x.locacao_id === l.locacao_id
        ? { ...x, quantidade: novo, vazio: novo === 0, vazio_desde: novo === 0 ? new Date().toISOString() : null }
        : x))
      await registrarHistorico(item.id, 'quantidade', `${l.codigo}: quantidade = ${novo}${novo === 0 ? ' (vazio)' : ''}`, novo)
      const { data } = await supabase.from('historico').select('*').eq('item_id', item.id)
        .order('created_at', { ascending: false }).limit(20)
      setHist((data as Hist[]) || [])
    }
  }

  function dataBR(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`drawer-overlay${visivel ? ' aberto' : ''}`} onClick={fechar}>
      <aside className={`drawer${visivel ? ' aberto' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
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

            {locais.length > 0 && (
              <div>
                <span className="rot">Locações e quantidade</span>
                <div className="locais-lista">
                  {locais.map((l, i) => (
                    <div className={`li${l.vazio ? ' vazia' : ''}`} key={i}>
                      <div>
                        <span>📍 {l.codigo}</span>
                        {l.vazio && l.vazio_desde && (
                          <span className="muted vazio-tempo"> · vazia {tempoVazia(l.vazio_desde)}</span>
                        )}
                      </div>
                      <div className="stepper">
                        <button disabled={salvandoLoc === l.locacao_id || (l.quantidade ?? 0) <= 0}
                          onClick={() => mudarQtd(l, (l.quantidade ?? 0) - 1)}>−</button>
                        <span className="qtd">{l.quantidade ?? 0}</span>
                        <button disabled={salvandoLoc === l.locacao_id}
                          onClick={() => mudarQtd(l, (l.quantidade ?? 0) + 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.descricao && <div className="desc"><span className="rot">Descrição</span>{item.descricao}</div>}

            <div>
              <span className="rot">Histórico</span>
              {hist.length === 0 ? (
                <div className="muted" style={{ fontSize: 14 }}>Sem registros ainda.</div>
              ) : (
                <div className="hist-lista">
                  {hist.map(h => (
                    <div className="hist-item" key={h.id}>
                      <div className="hist-txt">{h.descricao || h.tipo}</div>
                      <div className="hist-meta">{dataBR(h.created_at)}{h.usuario ? ` · ${h.usuario}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {zoom && createPortal(
        <div className="lightbox" onClick={() => setZoom(false)}>
          <button className="lb-fechar" onClick={(e) => { e.stopPropagation(); setZoom(false) }} aria-label="Fechar">✕</button>
          {fotos.length > 1 && (
            <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); setSel((sel - 1 + fotos.length) % fotos.length) }} aria-label="Anterior">‹</button>
          )}
          <img src={fotos[sel]} alt="" onClick={(e) => e.stopPropagation()} />
          {fotos.length > 1 && (
            <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); setSel((sel + 1) % fotos.length) }} aria-label="Próxima">›</button>
          )}
          {fotos.length > 1 && <div className="lb-cont">{sel + 1} / {fotos.length}</div>}
        </div>,
        document.body
      )}
    </div>
  )
}
