import { headingToUV } from './geo.js'

const MPS_PER_KT = 0.514444

export function createVaacAdvisories(advisories) {
  const all = advisories
    .map(a => ({ ...a, obsMs: Date.parse(a.obsUtc), layers: [...a.layers].sort((x, y) => x.topKm - y.topKm) }))
    .sort((a, b) => a.obsMs - b.obsMs)

  function latestObsAt(tMs) {
    let found = null
    for (const a of all) { if (a.obsMs <= tMs) found = a; else break }
    return found
  }

  // lapisan dengan puncak terendah yang masih >= altKm; kalau semua di bawah, ambil tertinggi
  function layerForAltitude(advisory, altKm) {
    return advisory.layers.find(l => l.topKm >= altKm) ?? advisory.layers[advisory.layers.length - 1]
  }

  function layerMotionAt(tMs, altKm) {
    const a = latestObsAt(tMs)
    if (!a) return null
    const layer = layerForAltitude(a, altKm)
    if (layer.moveDeg == null || layer.moveKt == null) return null
    return headingToUV(layer.moveDeg, layer.moveKt * MPS_PER_KT)
  }

  return { all, latestObsAt, layerForAltitude, layerMotionAt }
}
