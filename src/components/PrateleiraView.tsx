import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

export type GavetaInfo = {
  linha: number
  coluna: number
  codigo?: string
  temItem?: boolean
  assigned?: boolean
}

const DW = 0.92, DH = 0.62, DEP = 0.9, STEP_X = 1.05, STEP_Y = 0.75

function Gaveta({ g, aberta, onClick }: { g: GavetaInfo; aberta: boolean; onClick: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (ref.current) {
      const alvo = aberta ? 0.7 : 0
      ref.current.position.z += (alvo - ref.current.position.z) * 0.2
    }
  })
  const cor = !g.assigned ? '#7f8ea3' : g.temItem ? '#22a559' : '#d64545'
  return (
    <mesh ref={ref} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <boxGeometry args={[DW, DH, DEP]} />
      <meshStandardMaterial color={cor} metalness={0.1} roughness={0.7} />
      <Html position={[0, 0, DEP / 2 + 0.02]} center distanceFactor={7} occlude>
        <div className="gaveta-label">{g.codigo || '+'}</div>
      </Html>
    </mesh>
  )
}

export default function PrateleiraView({
  linhas, colunas, gavetas, selKey, onSelect,
}: {
  linhas: number
  colunas: number
  gavetas: GavetaInfo[]
  selKey: string | null
  onSelect: (linha: number, coluna: number) => void
}) {
  const largura = colunas * STEP_X
  const altura = linhas * STEP_Y
  const dist = Math.max(largura, altura) * 1.4 + 3

  return (
    <Canvas camera={{ position: [0, altura * 0.2, dist], fov: 45 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 6]} intensity={0.9} />
      <directionalLight position={[-4, 2, -4]} intensity={0.3} />

      {/* estrutura da prateleira */}
      <mesh position={[0, 0, -DEP / 2 - 0.1]}>
        <boxGeometry args={[largura + 0.4, altura + 0.4, 0.15]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {gavetas.map((g) => {
        const x = (g.coluna - (colunas - 1) / 2) * STEP_X
        const y = ((linhas - 1) / 2 - g.linha) * STEP_Y
        const key = `${g.linha}-${g.coluna}`
        return (
          <group key={key} position={[x, y, 0]}>
            <Gaveta g={g} aberta={selKey === key} onClick={() => onSelect(g.linha, g.coluna)} />
          </group>
        )
      })}

      <OrbitControls enablePan={false} minDistance={3} maxDistance={dist * 2} target={[0, 0, 0]} />
    </Canvas>
  )
}
