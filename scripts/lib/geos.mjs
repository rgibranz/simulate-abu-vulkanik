// Proyeksi geostasioner Himawari-8/9 (spesifikasi CGMS LRIT/HRIT), sub-satellite 140.7°E.
// Grid tetap 1 km: 11000 px, COFF/LOFF 5500.5, CFAC/LFAC 40932549.
export const HIMAWARI = { subLonDeg: 140.7, hKm: 42164.0, reqKm: 6378.137, rpolKm: 6356.7523, cfac: 40932549, coff: 5500.5, gridPx: 11000 }
const DEG = Math.PI / 180

// lat/lon → sudut pindai (derajat); null kalau titik di balik Bumi
export function latLonToScanAngles(latDeg, lonDeg, p = HIMAWARI) {
  const lat = latDeg * DEG, dlon = (lonDeg - p.subLonDeg) * DEG
  const req2 = p.reqKm * p.reqKm, rpol2 = p.rpolKm * p.rpolKm
  const cLat = Math.atan((rpol2 / req2) * Math.tan(lat))
  const rl = p.rpolKm / Math.sqrt(1 - ((req2 - rpol2) / req2) * Math.cos(cLat) ** 2)
  const r1 = p.hKm - rl * Math.cos(cLat) * Math.cos(dlon)
  const r2 = -rl * Math.cos(cLat) * Math.sin(dlon)
  const r3 = rl * Math.sin(cLat)
  // terlihat satelit kalau sudut titik–sub-satelit lebih kecil dari sudut horizon (cos > rl/h)
  if (Math.cos(cLat) * Math.cos(dlon) <= rl / p.hKm) return null
  const rn = Math.sqrt(r1 * r1 + r2 * r2 + r3 * r3)
  return { xDeg: Math.atan(-r2 / r1) / DEG, yDeg: Math.asin(-r3 / rn) / DEG }
}

// lat/lon → piksel grid tetap 1 km (kolom ke kanan = timur, baris ke bawah = selatan), 0-based pecahan
export function latLonToGridPx(latDeg, lonDeg, p = HIMAWARI) {
  const s = latLonToScanAngles(latDeg, lonDeg, p)
  if (!s) return null
  const k = p.cfac / 65536
  return { col: p.coff - 1 + s.xDeg * k, line: p.coff - 1 + s.yDeg * k }
}

// piksel grid 1 km → piksel gambar SLIDER pada zoom z (full disk = tilePx·2^z piksel) + indeks tile
export function gridToSlider(col, line, { zoom, tilePx = 688, gridPx = HIMAWARI.gridPx } = {}) {
  const scale = (tilePx * 2 ** zoom) / gridPx
  const u = col * scale, v = line * scale
  return { u, v, tileCol: Math.floor(u / tilePx), tileRow: Math.floor(v / tilePx), du: u - Math.floor(u / tilePx) * tilePx, dv: v - Math.floor(v / tilePx) * tilePx }
}
