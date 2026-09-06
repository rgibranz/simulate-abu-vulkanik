export const M_PER_DEG_LAT = 110540
const DEG = Math.PI / 180

export function metersPerDegLon(latDeg) {
  return 111320 * Math.cos(latDeg * DEG)
}

// arah meteorologis = DARI mana angin datang
export function windFromToUV(dirDeg, speed) {
  return { u: -speed * Math.sin(dirDeg * DEG), v: -speed * Math.cos(dirDeg * DEG) }
}

// arah VAAC "MOV SE" = KE mana awan bergerak
export function headingToUV(dirDeg, speed) {
  return { u: speed * Math.sin(dirDeg * DEG), v: speed * Math.cos(dirDeg * DEG) }
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export function compassToDeg(name) {
  const i = COMPASS.indexOf(name.toUpperCase())
  if (i < 0) throw new Error(`Unknown compass direction: ${name}`)
  return i * 22.5
}

export function flToKm(fl) {
  return fl * 100 * 0.3048 / 1000
}

// ray casting; polygon = [[lat, lon], ...]
export function pointInPolygon(lat, lon, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i], [yj, xj] = polygon[j]
    const hit = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}
