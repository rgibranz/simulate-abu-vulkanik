// Grid endapan kumulatif, satuan relatif (bobot kelas partikel)
export function createDepositionGrid({ latMin, latMax, lonMin, lonMax, cellDeg }) {
  const rows = Math.round((latMax - latMin) / cellDeg)
  const cols = Math.round((lonMax - lonMin) / cellDeg)
  const values = new Float32Array(rows * cols)

  function cellIndex(lat, lon) {
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return -1
    const r = Math.min(rows - 1, Math.floor((lat - latMin) / cellDeg + 1e-9))
    const c = Math.min(cols - 1, Math.floor((lon - lonMin) / cellDeg + 1e-9))
    return r * cols + c
  }

  return {
    rows, cols, cellDeg, latMin, lonMin, values,
    cellIndex,
    add(lat, lon, weight) { const k = cellIndex(lat, lon); if (k >= 0) values[k] += weight },
    max() { let m = 0; for (let k = 0; k < values.length; k++) if (values[k] > m) m = values[k]; return m },
    snapshot() { return Float32Array.from(values) },
    restore(arr) { values.set(arr) },
    reset() { values.fill(0) },
  }
}
