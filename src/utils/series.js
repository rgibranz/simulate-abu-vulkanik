// Helper deret waktu & path SVG (murni, tanpa DOM)

// interpolasi linear di antara sampel; di luar rentang → nilai ujung; null kalau kosong
export function valueAt(timesMs, values, tMs) {
  const n = timesMs.length
  if (!n) return null
  if (tMs <= timesMs[0]) return values[0]
  if (tMs >= timesMs[n - 1]) return values[n - 1]
  let lo = 0, hi = n - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (timesMs[mid] <= tMs) lo = mid; else hi = mid }
  const f = (tMs - timesMs[lo]) / (timesMs[hi] - timesMs[lo])
  return values[lo] + (values[hi] - values[lo]) * f
}

export function scaleLinear(d0, d1, r0, r1) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (x) => r0 + (x - d0) * k
}

const fmt = (v) => Math.round(v * 100) / 100

// [[x,y],...] → "M x y L x y ..."; titik null dilewati (garis putus)
export function linePath(points) {
  let d = '', pen = false
  for (const p of points) {
    if (!p || p[1] == null || Number.isNaN(p[1])) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])} `
    pen = true
  }
  return d.trim()
}

// tangga: nilai bertahan sampai x berikutnya, ditutup di xEnd
export function stepPath(points, xEnd) {
  if (!points.length) return ''
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`
  for (let i = 1; i < points.length; i++) d += ` H${fmt(points[i][0])} V${fmt(points[i][1])}`
  d += ` H${fmt(xEnd)}`
  return d
}
