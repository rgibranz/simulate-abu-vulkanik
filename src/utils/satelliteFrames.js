// pilih frame citra satelit untuk waktu t: frame terakhir ≤ t, asalkan tidak lebih tua dari maxGapMs
export function pickFrame(frames, tMs, maxGapMs = 90 * 60e3) {
  let best = null
  for (const f of frames) {
    const ft = f.tMs ?? Date.parse(f.time)
    if (ft <= tMs && (!best || ft > best.tMs)) best = { ...f, tMs: ft }
  }
  if (!best || tMs - best.tMs > maxGapMs) return null
  return best
}
