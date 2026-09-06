// Deret tinggi kolom (tangga) → laju emisi partikel (spec §4.2)
export function createEruptionSource(series, emission) {
  const pts = series.map(s => ({ tMs: Date.parse(s.timeUtc), h: s.heightKm })).sort((a, b) => a.tMs - b.tMs)
  if (pts.length === 0) throw new Error('eruption series is empty')

  function plumeHeightAt(tMs) {
    let h = pts[0].h
    for (const p of pts) { if (p.tMs <= tMs) h = p.h; else break }
    return h
  }

  function emissionCountAt(tMs, dtSec) {
    const h = plumeHeightAt(tMs)
    const factor = Math.max(emission.minFactor, (h / emission.refHeightKm) ** 2)
    return emission.basePerStep * factor * (dtSec / 600)
  }

  return { plumeHeightAt, emissionCountAt }
}
