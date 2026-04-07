import { useState } from 'react'
import { useOsmData } from './useOsmData.js'
import Scene from './Scene.jsx'
import POVScene from './POVScene.jsx'
import UI from './UI.jsx'

const ISOVIST_RADIUS = 200

function LoadingSpinner() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      gap: 20,
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '4px solid #333',
        borderTop: '4px solid #4499ff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ fontSize: 16, color: '#aaa' }}>Loading Weimar OSM data…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      gap: 12,
      padding: 32,
    }}>
      <div style={{ fontSize: 20, color: '#ff4466' }}>Failed to load OSM data</div>
      <div style={{ fontSize: 13, color: '#aaa', maxWidth: 400, textAlign: 'center' }}>{message}</div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          background: '#4499ff',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Retry
      </button>
    </div>
  )
}

export default function App() {
  const { status, buildings, streets, greenAreas, trees, error } = useOsmData()
  const [isovistActive, setIsovistActive] = useState(false)
  const [clickPos, setClickPos] = useState(null)

  if (status === 'loading') return <LoadingSpinner />
  if (status === 'error') return <ErrorScreen message={error} />

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Scene
        buildings={buildings}
        streets={streets}
        greenAreas={greenAreas ?? []}
        trees={trees ?? []}
        onIsovistChange={setIsovistActive}
        onClickPosChange={setClickPos}
      />
      <UI isovistActive={isovistActive} isovistRadius={ISOVIST_RADIUS} />
      <POVScene origin={clickPos} buildings={buildings} streets={streets} greenAreas={greenAreas ?? []} trees={trees ?? []} />
    </div>
  )
}
