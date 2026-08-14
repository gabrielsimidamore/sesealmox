import { useState } from 'react'
import type { Item } from '../lib/supabase'

export default function ItemDetalhe({ item, onVoltar }: { item: Item; onVoltar: () => void }) {
  const [zoom, setZoom] = useState(false)

  return (
    <div className="detalhe">
      <button className="voltar" onClick={onVoltar}>← Voltar</button>

      <div className="foto-grande" onClick={() => item.foto_url && setZoom(true)}>
        {item.foto_url
          ? <img src={item.foto_url} alt={item.nome || item.codigo_m} />
          : <div className="sem-foto grande">Sem foto</div>}
      </div>

      <h2>{item.nome || item.codigo_m}</h2>
      <div className="campos">
        <div><span className="rot">Código M</span><b>{item.codigo_m}</b></div>
        {item.categoria && <div><span className="rot">Categoria</span>{item.categoria}</div>}
        {item.locacao_codigo && <div><span className="rot">Locação</span>📍 {item.locacao_codigo}</div>}
        {item.descricao && <div className="desc"><span className="rot">Descrição</span>{item.descricao}</div>}
      </div>

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <img src={item.foto_url!} alt="" />
        </div>
      )}
    </div>
  )
}
