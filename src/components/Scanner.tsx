import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function Scanner({ onLer, onFechar }: { onLer: (texto: string) => void; onFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | null = null
    let ativo = true

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, ctrl) => {
        controls = ctrl
        if (!ativo) return
        if (result) {
          ativo = false
          ctrl.stop()
          onLer(result.getText())
        }
      })
      .catch((e) => setErro('Não foi possível abrir a câmera: ' + (e?.message || e)))

    return () => {
      ativo = false
      try { controls?.stop() } catch { /* ignora */ }
    }
  }, [])

  return (
    <div className="scanner-overlay" onClick={onFechar}>
      <div className="scanner-box" onClick={e => e.stopPropagation()}>
        <div className="scanner-topo">
          <span>Aponte para o código</span>
          <button className="drawer-fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="scanner-video">
          <video ref={videoRef} />
          <div className="scanner-mira" />
        </div>
        {erro && <div className="erro pad">{erro}</div>}
      </div>
    </div>
  )
}
