import { useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { calculateIsovist } from './isovist.js'

const ISOVIST_RADIUS = 200

// ─── Ground Plane ────────────────────────────────────────────────────────────
function Ground({ onGroundClick }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerDown={onGroundClick}
      receiveShadow
    >
      <planeGeometry args={[2200, 2200]} />
      <meshStandardMaterial color="#4a4e4a" />
    </mesh>
  )
}

// ─── Buildings ───────────────────────────────────────────────────────────────
function Buildings({ buildings }) {
  const meshes = useMemo(() => {
    return buildings.map((building, i) => {
      const { polygon, height } = building
      if (polygon.length < 3) return null

      // Build shape in XY plane. Negate Y so that after rotateX(-PI/2)
      // the world Z equals the original z coordinate (not its negation).
      const shape = new THREE.Shape()
      shape.moveTo(polygon[0][0], -polygon[0][1])
      for (let j = 1; j < polygon.length; j++) {
        shape.lineTo(polygon[j][0], -polygon[j][1])
      }
      shape.closePath()

      const extrudeSettings = { depth: height, bevelEnabled: false }
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

      // Rotate so extrusion goes up (Y axis). ExtrudeGeometry extrudes along Z,
      // so we rotate -90deg around X: Z becomes Y.
      geometry.rotateX(-Math.PI / 2)

      return (
        <mesh key={i} geometry={geometry} position={[0, 0, 0]}>
          <meshStandardMaterial
            color="#d6d0c8"
            emissive="#080808"
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>
      )
    }).filter(Boolean)
  }, [buildings])

  return <group>{meshes}</group>
}

// ─── Green Areas ─────────────────────────────────────────────────────────────
// Directly triangulate and place vertices in world XZ space — same coordinate
// system as streets — avoiding any Shape/rotateX winding ambiguity.
function GreenAreas({ greenAreas }) {
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

// ─── Trees ───────────────────────────────────────────────────────────────────
function Trees({ trees }) {
  // Shared geometries for all trees
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

// ─── Streets ─────────────────────────────────────────────────────────────────
function Streets({ streets }) {
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

// ─── Isovist Polygon ─────────────────────────────────────────────────────────
function IsovistMesh({ points }) {
  const mesh = useMemo(() => {
    if (!points || points.length < 3) return null

    // Build a THREE.Shape from the isovist polygon points. Negate Y so that
    // after rotateX(-PI/2) the world Z matches the click point's world Z.
    const shape = new THREE.Shape()
    shape.moveTo(points[0][0], -points[0][1])
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], -points[i][1])
    }
    shape.closePath()

    const geometry = new THREE.ShapeGeometry(shape)
    // Rotate the geometry so it lies flat in XZ plane (Y up)
    geometry.rotateX(-Math.PI / 2)

    return geometry
  }, [points])

  if (!mesh) return null

  return (
    <mesh geometry={mesh} position={[0, 0.5, 0]}>
      <meshBasicMaterial
        color="#ffdd00"
        transparent
        opacity={0.32}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ─── Click Marker ─────────────────────────────────────────────────────────────
function ClickMarker({ position }) {
  if (!position) return null
  return (
    <mesh position={[position.x, 1, position.z]}>
      <cylinderGeometry args={[2, 2, 2, 16]} />
      <meshBasicMaterial color="#ff4466" />
    </mesh>
  )
}

// ─── Scene Inner (needs Three.js context) ────────────────────────────────────
function SceneInner({ buildings, streets, greenAreas, trees, onIsovistChange, onClickPosChange }) {
  const [isovistPoints, setIsovistPoints] = useState(null)
  const [clickPos, setClickPos] = useState(null)
  const orbitRef = useRef()

  const handleGroundClick = useCallback((e) => {
    e.stopPropagation()
    const point = e.point
    const cp = { x: point.x, z: point.z }
    setClickPos(cp)
    if (onClickPosChange) onClickPosChange(cp)

    // Run isovist in a microtask to avoid blocking the frame
    setTimeout(() => {
      const pts = calculateIsovist(cp, buildings, ISOVIST_RADIUS, 360)
      setIsovistPoints(pts)
      if (onIsovistChange) onIsovistChange(true)
    }, 0)
  }, [buildings, onIsovistChange, onClickPosChange])

  return (
    <>
      {/* Camera */}
      <perspectiveCamera makeDefault fov={45} position={[0, 800, 600]} />

      {/* Controls */}
      <OrbitControls
        ref={orbitRef}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2}
        panSpeed={1.5}
        zoomSpeed={1.2}
      />

      {/* Lighting */}
      <ambientLight intensity={1.1} color="#e8f0f8" />
      <directionalLight position={[300, 600, 200]} intensity={1.4} color="#ffffff" castShadow />

      {/* Ground */}
      <Ground onGroundClick={handleGroundClick} />

      {/* OSM data */}
      <GreenAreas greenAreas={greenAreas} />
      <Buildings buildings={buildings} />
      <Streets streets={streets} />
      <Trees trees={trees} />

      {/* Isovist */}
      <IsovistMesh points={isovistPoints} />
      <ClickMarker position={clickPos} />
    </>
  )
}

// ─── Main Scene Export ────────────────────────────────────────────────────────
export default function Scene({ buildings, streets, greenAreas, trees, onIsovistChange, onClickPosChange }) {
  return (
    <Canvas
      camera={{ position: [0, 800, 600], fov: 45, near: 1, far: 5000 }}
      style={{ width: '100vw', height: '100vh', background: '#b8d4f0' }}
      gl={{ antialias: true }}
    >
      <SceneInner
        buildings={buildings}
        streets={streets}
        greenAreas={greenAreas}
        trees={trees}
        onIsovistChange={onIsovistChange}
        onClickPosChange={onClickPosChange}
      />
    </Canvas>
  )
}
