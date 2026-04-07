export default function UI({ isovistActive, isovistRadius }) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 100,
      background: 'rgba(30, 24, 16, 0.72)',
      color: '#f0e8d8',
      padding: '12px 16px',
      borderRadius: 8,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
      lineHeight: 1.6,
      maxWidth: 280,
      pointerEvents: 'none',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, letterSpacing: '0.5px' }}>
        Weimar 3D Viewer
      </div>
      <div style={{ color: '#aaa', fontSize: 12 }}>
        <div>Click on ground to calculate isovist</div>
        <div>Scroll to zoom · Drag to orbit · Right-drag to pan</div>
      </div>
      {isovistActive && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          color: '#d4a820',
          fontSize: 12,
        }}>
          Isovist active · radius {isovistRadius}m
        </div>
      )}
    </div>
  )
}
