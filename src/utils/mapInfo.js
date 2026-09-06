import { M_PER_DEG_LAT, metersPerDegLon } from '../engine/geo.js'

const DEG = Math.PI / 180
const COMPASS_ID = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut']

// jarak equirectangular (cukup untuk ratusan km di lintang rendah)
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dx = (lon2 - lon1) * metersPerDegLon((lat1 + lat2) / 2), dy = (lat2 - lat1) * M_PER_DEG_LAT
  return Math.hypot(dx, dy) / 1000
}

// arah dari titik 1 ke titik 2, 0 = utara, searah jarum jam
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const dx = (lon2 - lon1) * metersPerDegLon((lat1 + lat2) / 2), dy = (lat2 - lat1) * M_PER_DEG_LAT
  return (Math.atan2(dx, dy) / DEG + 360) % 360
}

export function compassName(deg) {
  return COMPASS_ID[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

// u,v m/s → arah KE mana (derajat) + kecepatan km/jam
export function uvToHeading(u, v) {
  return { toDeg: (Math.atan2(u, v) / DEG + 360) % 360, speedKmh: Math.hypot(u, v) * 3.6 }
}

// ringkasan satu titik klik di peta
export function summarizePoint({ lat, lon, frame, grid, windField, levelIndex, tMs, vent, places, lowTopKm, radiusKm = 25 }) {
  const fromVentKm = distanceKm(vent.lat, vent.lon, lat, lon)
  const bearing = bearingDeg(vent.lat, vent.lon, lat, lon)

  let deposition = null
  if (grid && grid.max > 0) {
    const k = grid.cellIndex(lat, lon)
    const value = k >= 0 ? grid.values[k] : 0
    deposition = { value, fraction: value / grid.max }
  }

  let low = 0, high = 0
  if (frame) {
    const p = frame.positions, rM = radiusKm * 1000, mPerDegLon = metersPerDegLon(lat)
    for (let i = 0; i < frame.count * 4; i += 4) {
      const dx = (p[i] - lon) * mPerDegLon, dy = (p[i + 1] - lat) * M_PER_DEG_LAT
      if (dx * dx + dy * dy > rM * rM) continue
      if (p[i + 2] <= lowTopKm) low++; else high++
    }
  }

  let wind = null
  if (windField) {
    const level = windField.levels[levelIndex]
    const t = Math.min(Math.max(tMs, windField.timeStartMs), windField.timeEndMs)
    const w = windField.sample(lat, lon, level.altKm, t)
    if (w) { const h = uvToHeading(w.u, w.v); wind = { ...h, toName: compassName(h.toDeg), levelName: level.name, altKm: level.altKm } }
  }

  let nearestPlace = null
  for (const c of places?.cities ?? []) {
    const d = distanceKm(lat, lon, c.lat, c.lon)
    if (!nearestPlace || d < nearestPlace.distanceKm) nearestPlace = { name: c.name, distanceKm: d }
  }

  return { lat, lon, fromVentKm, bearingDeg: bearing, bearingName: compassName(bearing), deposition, particles: { low, high, radiusKm }, wind, nearestPlace }
}
