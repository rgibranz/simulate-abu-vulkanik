// Interpolasi angin 4D dari WindDataset (lihat scripts/lib/buildWind.mjs untuk layout)
export function createWindField(ds) {
  const lats = ds.lats, lons = ds.lons, levels = ds.levels
  const u = ds.u instanceof Float32Array ? ds.u : Float32Array.from(ds.u)
  const v = ds.v instanceof Float32Array ? ds.v : Float32Array.from(ds.v)
  const timeMs = ds.times.map(s => Date.parse(s))
  const NT = timeMs.length, NL = levels.length, NLAT = lats.length, NLON = lons.length
  const dLat = lats[1] - lats[0], dLon = lons[1] - lons[0], dT = timeMs[1] - timeMs[0]
  const bounds = { latMin: lats[0], latMax: lats[NLAT - 1], lonMin: lons[0], lonMax: lons[NLON - 1] }
  const altKm = levels.map(l => l.altKm)

  const idx = (t, l, i, j) => ((t * NL + l) * NLAT + i) * NLON + j

  function sample(lat, lon, alt, tMs) {
    if (lat < bounds.latMin || lat > bounds.latMax || lon < bounds.lonMin || lon > bounds.lonMax) return null
    if (tMs < timeMs[0] || tMs > timeMs[NT - 1]) return null
    // waktu
    const t0 = Math.min(NT - 2, Math.floor((tMs - timeMs[0]) / dT)); const ft = (tMs - timeMs[t0]) / dT
    // ketinggian (clamp)
    let l0 = 0
    if (alt >= altKm[NL - 1]) l0 = NL - 2
    else while (l0 < NL - 2 && alt >= altKm[l0 + 1]) l0++
    let fl = (alt - altKm[l0]) / (altKm[l0 + 1] - altKm[l0]); fl = Math.min(1, Math.max(0, fl))
    // horizontal
    const i0 = Math.min(NLAT - 2, Math.floor((lat - lats[0]) / dLat)); const fi = (lat - lats[i0]) / dLat
    const j0 = Math.min(NLON - 2, Math.floor((lon - lons[0]) / dLon)); const fj = (lon - lons[j0]) / dLon
    let su = 0, sv = 0
    for (let dt = 0; dt < 2; dt++) {
      const wt = dt ? ft : 1 - ft; if (!wt) continue
      for (let dl = 0; dl < 2; dl++) {
        const wl = dl ? fl : 1 - fl; if (!wl) continue
        for (let di = 0; di < 2; di++) {
          const wi = di ? fi : 1 - fi; if (!wi) continue
          for (let dj = 0; dj < 2; dj++) {
            const wj = dj ? fj : 1 - fj; if (!wj) continue
            const w = wt * wl * wi * wj, k = idx(t0 + dt, l0 + dl, i0 + di, j0 + dj)
            su += w * u[k]; sv += w * v[k]
          }
        }
      }
    }
    return { u: su, v: sv }
  }

  return {
    sample, bounds, levels, lats, lons,
    timeStartMs: timeMs[0], timeEndMs: timeMs[NT - 1],
    uvAt: (t, l, i, j) => ({ u: u[idx(t, l, i, j)], v: v[idx(t, l, i, j)] }),
  }
}
