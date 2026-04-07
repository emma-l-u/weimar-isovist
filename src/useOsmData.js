import { useState, useEffect } from 'react'

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]
const BBOX = 'south=50.9697,west=11.3085,north=50.9897,east=11.3385'
const BBOX_COORDS = '50.9697,11.3085,50.9897,11.3385'

const ORIGIN_LAT = 50.9797
const ORIGIN_LON = 11.3235
const DEG_TO_RAD = Math.PI / 180

function latLonToXZ(lat, lon) {
  const x = (lon - ORIGIN_LON) * Math.cos(ORIGIN_LAT * DEG_TO_RAD) * 111320
  const z = -(lat - ORIGIN_LAT) * 111320
  return [x, z]
}

function parseNodes(elements) {
  const nodes = {}
  for (const el of elements) {
    if (el.type === 'node') {
      nodes[el.id] = { lat: el.lat, lon: el.lon }
    }
  }
  return nodes
}

function wayToPolygon(way, nodes) {
  const coords = []
  for (const nodeId of way.nodes) {
    const node = nodes[nodeId]
    if (!node) continue
    const [x, z] = latLonToXZ(node.lat, node.lon)
    coords.push([x, z])
  }
  return coords
}

function getBuildingHeight(tags) {
  if (tags && tags['height']) {
    const h = parseFloat(tags['height'])
    if (!isNaN(h)) return h
  }
  if (tags && tags['building:levels']) {
    const levels = parseFloat(tags['building:levels'])
    if (!isNaN(levels)) return levels * 3.5
  }
  return 8
}

function getStreetWidth(tags) {
  if (!tags || !tags['highway']) return 3
  const hw = tags['highway']
  const widths = {
    motorway: 8,
    motorway_link: 6,
    trunk: 7,
    trunk_link: 5,
    primary: 6,
    primary_link: 5,
    secondary: 5,
    secondary_link: 4,
    tertiary: 4,
    tertiary_link: 3,
    residential: 3,
    living_street: 2.5,
    service: 2,
    pedestrian: 3,
    footway: 1.5,
    path: 1.5,
    cycleway: 2,
    track: 2,
    unclassified: 3,
  }
  return widths[hw] ?? 3
}

async function fetchOverpass(query) {
  let lastError
  for (const url of OVERPASS_URLS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`All Overpass endpoints failed: ${lastError?.message}`)
}

const GREEN_TAGS = new Set([
  'park', 'grass', 'meadow', 'village_green', 'recreation_ground',
  'forest', 'wood', 'scrub', 'heath', 'allotments', 'garden',
])

export function useOsmData() {
  const [state, setState] = useState({ status: 'loading', buildings: [], streets: [], greenAreas: [], error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const buildingQuery = `[out:json][timeout:30];
(
  way["building"](${BBOX_COORDS});
  relation["building"](${BBOX_COORDS});
);
out body;
>;
out skel qt;`

        const streetQuery = `[out:json][timeout:30];
(
  way["highway"](${BBOX_COORDS});
);
out body;
>;
out skel qt;`

        const greenQuery = `[out:json][timeout:30];
(
  way["leisure"~"^(park|garden|pitch|golf_course)$"](${BBOX_COORDS});
  way["landuse"~"^(grass|meadow|village_green|recreation_ground|forest|allotments)$"](${BBOX_COORDS});
  way["natural"~"^(wood|scrub|heath|grassland)$"](${BBOX_COORDS});
  node["natural"="tree"](${BBOX_COORDS});
  way["natural"="tree_row"](${BBOX_COORDS});
);
out body;
>;
out skel qt;`

        const buildingData = await fetchOverpass(buildingQuery)
        if (cancelled) return
        const streetData = await fetchOverpass(streetQuery)
        if (cancelled) return
        const greenData = await fetchOverpass(greenQuery)
        if (cancelled) return

        const buildingNodes = parseNodes(buildingData.elements)
        const buildings = []
        for (const el of buildingData.elements) {
          if (el.type !== 'way') continue
          if (!el.tags || !el.tags['building']) continue
          const polygon = wayToPolygon(el, buildingNodes)
          if (polygon.length < 3) continue
          const height = getBuildingHeight(el.tags)
          buildings.push({ polygon, height })
        }

        const streetNodes = parseNodes(streetData.elements)
        const streets = []
        for (const el of streetData.elements) {
          if (el.type !== 'way') continue
          const points = wayToPolygon(el, streetNodes)
          if (points.length < 2) continue
          const width = getStreetWidth(el.tags)
          streets.push({ points, width })
        }

        const greenNodes = parseNodes(greenData.elements)
        const greenAreas = []
        const trees = []
        for (const el of greenData.elements) {
          if (el.type === 'node' && el.tags?.natural === 'tree') {
            const [x, z] = latLonToXZ(el.lat, el.lon)
            trees.push({ x, z })
          } else if (el.type === 'way') {
            // tree_row: emit a tree at each node
            if (el.tags?.natural === 'tree_row') {
              for (const nodeId of el.nodes) {
                const node = greenNodes[nodeId]
                if (!node) continue
                const [x, z] = latLonToXZ(node.lat, node.lon)
                trees.push({ x, z })
              }
            } else {
              const polygon = wayToPolygon(el, greenNodes)
              if (polygon.length >= 3) greenAreas.push({ polygon })
            }
          }
        }

        setState({ status: 'ready', buildings, streets, greenAreas, trees, error: null })
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', buildings: [], streets: [], error: err.message })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
