import { windFromToUV } from '../../src/engine/geo.js'

export function windIndex(ds, t, l, i, j) {
  return ((t * ds.levels.length + l) * ds.lats.length + i) * ds.lons.length + j
}

function key(lat, lon) { return `${Math.round(lat)},${Math.round(lon)}` }

function toIsoZ(s) { return s.length === 16 ? `${s}:00Z` : s.endsWith('Z') ? s : `${s}Z` }

// points = array respons Open-Meteo (multi-lokasi). lats/lons harus urut naik.
export function buildWindDataset(points, { lats, lons, levels }) {
  const byKey = new Map(points.map(p => [key(p.latitude, p.longitude), p]))
  const times = points[0].hourly.time.map(toIsoZ)
  const NT = times.length, NL = levels.length, NLAT = lats.length, NLON = lons.length
  const u = new Array(NT * NL * NLAT * NLON), v = new Array(NT * NL * NLAT * NLON)
  const ds = { lats, lons, levels, times, u, v }
  for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) {
    const p = byKey.get(key(lats[i], lons[j]))
    if (!p) throw new Error(`Missing grid point lat=${lats[i]} lon=${lons[j]}`)
    for (let l = 0; l < NL; l++) {
      const spd = p.hourly[`wind_speed_${levels[l].name}`], dir = p.hourly[`wind_direction_${levels[l].name}`]
      if (!spd || spd.length !== NT) throw new Error(`Missing level ${levels[l].name} at ${key(lats[i], lons[j])}`)
      for (let t = 0; t < NT; t++) {
        const { u: uu, v: vv } = windFromToUV(dir[t], spd[t] / 3.6)
        const k = windIndex(ds, t, l, i, j)
        u[k] = Math.round(uu * 100) / 100; v[k] = Math.round(vv * 100) / 100
      }
    }
  }
  return ds
}
