import { useRef, useEffect, useMemo, memo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Look-around controls (first-person, drag to rotate) ─────────────────────
function LookAroundControls({ origin }) {
  const { camera, gl } = useThree()
  const state = useRef({ yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    camera.position.set(origin.x, 1.7, origin.z)
    // Default look direction: toward city center
    const dx = -origin.x
    const dz = -origin.z
    state.current.yaw = Math.atan2(dx, dz)
    state.current.pitch = 0
  }, [origin, camera])

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e) => {
      state.current.dragging = true
      state.current.lastX = e.clientX
      state.current.lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e) => {
      if (!state.current.dragging) return
      const dx = e.clientX - state.current.lastX
      const dy = e.clientY - state.current.lastY
      state.current.yaw -= dx * 0.005
      state.current.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, state.current.pitch - dy * 0.005))
      state.current.lastX = e.clientX
      state.current.lastY = e.clientY
    }
    const onPointerUp = () => { state.current.dragging = false }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [gl])

  useFrame(() => {
    const { yaw, pitch } = state.current
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ')
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(euler)
    camera.lookAt(camera.position.clone().add(dir))
  })

  return null
}

// ─── Buildings (POV) ──────────────────────────────────────────────────────────
function POVBuildings({ buildings }) {
  const meshes = useMemo(() => {
    return buildings.map((building, i) => {
      const { polygon, height } = building
      if (polygon.length < 3) return null

      const shape = new THREE.Shape()
      shape.moveTo(polygon[0][0], -polygon[0][1])
      for (let j = 1; j < polygon.length; j++) {
        shape.lineTo(polygon[j][0], -polygon[j][1])
      }
      shape.closePath()

      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      geometry.rotateX(-Math.PI / 2)

      return (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#d6d0c8" emissive="#080808" roughness={0.7} metalness={0.05} />
        </mesh>
      )
    }).filter(Boolean)
  }, [buildings])

  return <group>{meshes}</group>
}

// ─── Streets (POV) ────────────────────────────────────────────────────────────
function POVStreets({ streets }) {
  const lines = useMemo(() => {
    return streets.map((street, i) => {
      const { points } = street
      if (points.length < 2) return null

      const positions = []
      for (let j = 0; j < points.length - 1; j++) {
        positions.push(points[j][0], 0.1, points[j][1])
        positions.push(points[j + 1][0], 0.1, points[j + 1][1])
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

      return (
        <lineSegments key={i} geometry={geometry}>
          <lineBasicMaterial color="#222a22" />
        </lineSegments>
      )
    }).filter(Boolean)
  }, [streets])

  return <group>{lines}</group>
}

// ─── Green Areas (POV) ────────────────────────────────────────────────────────
function POVGreenAreas({ greenAreas }) {
  const meshes = useMemo(() => {
    return greenAreas.map((area, i) => {
      const { polygon } = area
      if (polygon.length < 3) return null
      try {
        const contour = polygon.map(p => new THREE.Vector2(p[0], p[1]))
        const triangles = THREE.ShapeUtils.triangulateShape(contour, [])
        const positions = new Float32Array(triangles.length * 9)
        let idx = 0
        for (const [a, b, c] of triangles) {
          positions[idx++] = polygon[a][0]; positions[idx++] = 0.2; positions[idx++] = polygon[a][1]
          positions[idx++] = polygon[b][0]; positions[idx++] = 0.2; positions[idx++] = polygon[b][1]
          positions[idx++] = polygon[c][0]; positions[idx++] = 0.2; positions[idx++] = polygon[c][1]
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.computeVertexNormals()
        return (
          <mesh key={i} geometry={geometry}>
            <meshStandardMaterial color="#5a8f4a" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        )
      } catch {
        return null
      }
    }).filter(Boolean)
  }, [greenAreas])
  return <group>{meshes}</group>
}

// ─── Trees (POV) ─────────────────────────────────────────────────────────────
function POVTrees({ trees }) {
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.5, 4, 6), [])
  const canopyGeo = useMemo(() => new THREE.SphereGeometry(3.5, 7, 6), [])
  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          <mesh geometry={trunkGeo} position={[0, 2, 0]}>
            <meshStandardMaterial color="#7a5535" roughness={1} />
          </mesh>
          <mesh geometry={canopyGeo} position={[0, 7, 0]}>
            <meshStandardMaterial color="#3d8c3a" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ─── POV Scene inner ──────────────────────────────────────────────────────────
function POVInner({ origin, buildings, streets, greenAreas, trees }) {
  return (
    <>
      <LookAroundControls origin={origin} />
      <ambientLight intensity={1.1} color="#e8f0f8" />
      <directionalLight position={[300, 600, 200]} intensity={1.4} color="#ffffff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2200, 2200]} />
        <meshStandardMaterial color="#4a4e4a" />
      </mesh>
      <POVGreenAreas greenAreas={greenAreas} />
      <POVBuildings buildings={buildings} />
      <POVStreets streets={streets} />
      <POVTrees trees={trees} />
    </>
  )
}

// ─── POV Canvas overlay ───────────────────────────────────────────────────────
export default function POVScene({ origin, buildings, streets, greenAreas, trees }) {
  if (!origin) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 360,
      height: 240,
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.15)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      background: '#111',
    }}>
      <div style={{
        position: 'absolute',
        top: 8,
        left: 10,
        zIndex: 10,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        POV · drag to look around
      </div>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 3000 }}
        style={{ width: '100%', height: '100%', background: '#b8d4f0' }}
        gl={{ antialias: true }}
      >
        <POVInner origin={origin} buildings={buildings} streets={streets} greenAreas={greenAreas} trees={trees} />
      </Canvas>
    </div>
  )
}
