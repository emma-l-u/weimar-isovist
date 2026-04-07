/**
 * 2D isovist calculation using ray casting.
 * Casts N rays outward from a point, finding the nearest building edge hit.
 */

function raySegmentIntersect(ox, oz, dx, dz, ax, az, bx, bz) {
  // Ray: P = O + t*D, t >= 0
  // Segment: Q = A + u*(B-A), 0 <= u <= 1
  // Solve: t*D - u*E = A - O  (E = B - A)
  const ex = bx - ax, ez = bz - az
  const denom = dx * ez - dz * ex
  if (Math.abs(denom) < 1e-10) return null
  const fx = ox - ax, fz = oz - az
  // Correct signs from Cramer's rule
  const t = (fz * ex - fx * ez) / denom
  const u = (fz * dx - fx * dz) / denom
  if (t >= 0 && u >= 0 && u <= 1) return t
  return null
}

/**
 * Calculate isovist polygon from a click point.
 * @param {{x: number, z: number}} clickPoint
 * @param {Array<{polygon: number[][], height: number}>} buildings
 * @param {number} maxRadius - max ray length in meters
 * @param {number} numRays - number of rays (default 360)
 * @returns {number[][]} array of [x, z] points forming the isovist boundary
 */
export function calculateIsovist(clickPoint, buildings, maxRadius = 200, numRays = 360) {
  const { x: ox, z: oz } = clickPoint

  // Pre-collect all building edges for efficiency
  const edges = []
  for (const building of buildings) {
    const poly = building.polygon
    for (let i = 0; i < poly.length - 1; i++) {
      edges.push([poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]])
    }
    // Close the polygon if not already closed
    const last = poly[poly.length - 1]
    const first = poly[0]
    if (last[0] !== first[0] || last[1] !== first[1]) {
      edges.push([last[0], last[1], first[0], first[1]])
    }
  }

  const points = []

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)

    let minT = maxRadius

    for (const [ax, az, bx, bz] of edges) {
      const t = raySegmentIntersect(ox, oz, dx, dz, ax, az, bx, bz)
      if (t !== null && t < minT) {
        minT = t
      }
    }

    points.push([ox + dx * minT, oz + dz * minT])
  }

  return points
}
