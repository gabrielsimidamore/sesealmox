import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, PointerLockControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'

export const S = 0.02
export type Ferramenta = 'mover' | 'girar' | 'redimensionar'

export type Node3D = {
  id: string; kind: 'prat' | 'obj'; tipo: string; nome?: string | null
  pos_x: number; pos_z: number; rot_y: number
  larg: number; prof: number; alt: number
  linhas?: number; colunas?: number
}

function corTipo(t: string) {
  return ({ caixa: '#c8863b', galao: '#2f7fd1', pallet: '#9c6b3f', porta_pallet: '#e08a2b', parede: '#b9c2cf', prateleira: '#5b6b82' } as any)[t] || '#888'
}

function Forma({ o }: { o: Node3D }) {
  if (o.kind === 'prat') {
    const w = (o.colunas || 4) * 0.55, h = (o.linhas || 3) * 0.42, d = 0.55, n = o.linhas || 3
    return (
      <group>
        <mesh position={[-w / 2, h / 2, 0]}><boxGeometry args={[0.05, h, d]} /><meshStandardMaterial color="#3a4759" /></mesh>
        <mesh position={[w / 2, h / 2, 0]}><boxGeometry args={[0.05, h, d]} /><meshStandardMaterial color="#3a4759" /></mesh>
        <mesh position={[0, h / 2, -d / 2]}><boxGeometry args={[w, h, 0.04]} /><meshStandardMaterial color="#46536a" /></mesh>
        {Array.from({ length: n + 1 }).map((_, i) => (
          <mesh key={i} position={[0, i * (h / n), 0]}><boxGeometry args={[w, 0.04, d]} /><meshStandardMaterial color="#5b6b82" /></mesh>
        ))}
        <Html position={[0, h + 0.15, 0]} center distanceFactor={10} wrapperClass="gaveta-wrap"><div className="gaveta-label">{o.nome}</div></Html>
      </group>
    )
  }
  if (o.tipo === 'galao')
    return <mesh position={[0, o.alt / 2, 0]}><cylinderGeometry args={[o.larg / 2, o.larg / 2, o.alt, 20]} /><meshStandardMaterial color={corTipo('galao')} /></mesh>
  if (o.tipo === 'porta_pallet') {
    const w = o.larg, h = o.alt, d = o.prof, c = corTipo('porta_pallet')
    const post = (x: number, z: number) => <mesh position={[x, h / 2, z]}><boxGeometry args={[0.08, h, 0.08]} /><meshStandardMaterial color={c} /></mesh>
    return (
      <group>
        {post(-w / 2, -d / 2)}{post(w / 2, -d / 2)}{post(-w / 2, d / 2)}{post(w / 2, d / 2)}
        {[0.4, h * 0.5, h * 0.9].map((y, i) => (
          <group key={i}>
            <mesh position={[0, y, -d / 2]}><boxGeometry args={[w, 0.08, 0.08]} /><meshStandardMaterial color={c} /></mesh>
            <mesh position={[0, y, d / 2]}><boxGeometry args={[w, 0.08, 0.08]} /><meshStandardMaterial color={c} /></mesh>
          </group>
        ))}
      </group>
    )
  }
  return <mesh position={[0, o.alt / 2, 0]}><boxGeometry args={[o.larg, o.alt, o.prof]} /><meshStandardMaterial color={corTipo(o.tipo)} /></mesh>
}

function No({ o, selecionado, ferramenta, orbitRef, onSelect, onGrab, onRot, onResize }: {
  o: Node3D; selecionado: boolean; ferramenta: Ferramenta; orbitRef: React.MutableRefObject<any>
  onSelect: (id: string) => void; onGrab: (id: string) => void
  onRot: (id: string, rot: number) => void; onResize: (id: string, larg: number, alt: number, prof: number) => void
}) {
  const ref = useRef<THREE.Group>(null)
  const grupo = (
    <group ref={ref} position={[o.pos_x * S, 0, o.pos_z * S]} rotation={[0, o.rot_y, 0]}
      onPointerDown={(e) => { if (ferramenta === 'mover') { e.stopPropagation(); onGrab(o.id) } }}
      onClick={(e) => { e.stopPropagation(); onSelect(o.id) }}>
      <Forma o={o} />
    </group>
  )
  if (!selecionado) return grupo

  const desliga = () => { if (orbitRef.current) orbitRef.current.enabled = false }
  const liga = () => { if (orbitRef.current) orbitRef.current.enabled = true }

  if (ferramenta === 'girar')
    return (
      <TransformControls mode="rotate" size={0.9} showX={false} showZ={false} rotationSnap={Math.PI / 12}
        onMouseDown={desliga} onMouseUp={() => { liga(); if (ref.current) onRot(o.id, ref.current.rotation.y) }}>
        {grupo}
      </TransformControls>
    )

  if (ferramenta === 'redimensionar' && o.kind === 'obj')
    return (
      <TransformControls mode="scale" size={0.9}
        onMouseDown={desliga} onMouseUp={() => {
          liga()
          if (ref.current) {
            const s = ref.current.scale
            onResize(o.id, +(o.larg * s.x).toFixed(2), +(o.alt * s.y).toFixed(2), +(o.prof * s.z).toFixed(2))
            ref.current.scale.set(1, 1, 1)
          }
        }}>
        {grupo}
      </TransformControls>
    )

  return grupo
}

function Andarilho() {
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const d = (e: KeyboardEvent) => (keys.current[e.code] = true)
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false)
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    camera.position.set(2, 1.6, 6)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])
  useFrame((_, dt) => {
    const v = 3 * dt
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
    const mov = new THREE.Vector3()
    if (keys.current['KeyW'] || keys.current['ArrowUp']) mov.add(fwd)
    if (keys.current['KeyS'] || keys.current['ArrowDown']) mov.sub(fwd)
    if (keys.current['KeyD'] || keys.current['ArrowRight']) mov.add(right)
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) mov.sub(right)
    if (mov.lengthSq() > 0) camera.position.add(mov.normalize().multiplyScalar(v))
    camera.position.y = 1.6
  })
  return null
}

function Arrastador({ arrastando, orbitRef, onLive, onFim }: {
  arrastando: React.MutableRefObject<string | null>; orbitRef: React.MutableRefObject<any>
  onLive: (id: string, x: number, z: number) => void; onFim: (id: string) => void
}) {
  const { camera, gl } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  useEffect(() => {
    const el = gl.domElement
    const move = (e: PointerEvent) => {
      if (!arrastando.current) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const p = new THREE.Vector3()
      if (ray.ray.intersectPlane(plano, p)) onLive(arrastando.current, p.x / S, p.z / S)
    }
    const up = () => {
      const id = arrastando.current
      if (!id) return
      arrastando.current = null
      if (orbitRef.current) orbitRef.current.enabled = true
      onFim(id)
    }
    el.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { el.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [onLive, onFim])
  return null
}

export default function Cena3D({ nodes, selId, modo, ferramenta, colocando, onColocar, onSelect, onDragLive, onDragEnd, onRot, onResize }: {
  nodes: Node3D[]; selId: string | null; modo: 'editar' | 'andar'; ferramenta: Ferramenta
  colocando: string | null; onColocar: (x: number, z: number) => void
  onSelect: (id: string | null) => void
  onDragLive: (id: string, x: number, z: number) => void; onDragEnd: (id: string) => void
  onRot: (id: string, rot: number) => void; onResize: (id: string, larg: number, alt: number, prof: number) => void
}) {
  const orbitRef = useRef<any>(null)
  const arrastando = useRef<string | null>(null)
  const grab = (id: string) => { onSelect(id); arrastando.current = id; if (orbitRef.current) orbitRef.current.enabled = false }

  return (
    <Canvas shadows camera={{ position: [6, 7, 12], fov: 50 }} onPointerMissed={() => onSelect(null)}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 14, 6]} intensity={1} castShadow />
      <hemisphereLight args={['#ffffff', '#6b7280', 0.4]} />
      <Grid args={[60, 60]} cellColor="#9aa7b8" sectionColor="#6b7c93" infiniteGrid fadeDistance={45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow
        onClick={(e) => { if (colocando) { e.stopPropagation(); onColocar(e.point.x / S, e.point.z / S) } }}>
        <planeGeometry args={[80, 80]} /><meshStandardMaterial color="#e9eef5" />
      </mesh>

      {nodes.map(o => (
        <No key={o.id} o={o} selecionado={modo === 'editar' && selId === o.id} ferramenta={ferramenta}
          orbitRef={orbitRef} onSelect={onSelect} onGrab={grab} onRot={onRot} onResize={onResize} />
      ))}

      {modo === 'editar'
        ? <>
            <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.12} />
            <Arrastador arrastando={arrastando} orbitRef={orbitRef} onLive={onDragLive} onFim={onDragEnd} />
          </>
        : <><PointerLockControls /><Andarilho /></>}
    </Canvas>
  )
}
