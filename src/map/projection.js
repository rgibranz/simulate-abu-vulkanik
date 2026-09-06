const DEG = Math.PI / 180

export function mercatorY(latDeg) {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * DEG) / 2))
}

// Proyeksi Web-Mercator viewport → pixel, tanpa Leaflet (biar bisa di-test & cepat di loop partikel)
export function createProjector({ west, east, north, south, width, height }) {
  const yN = mercatorY(north), yS = mercatorY(south)
  const sx = width / (east - west), sy = height / (yS - yN)
  return { toPixel(lon, lat) { return [(lon - west) * sx, (mercatorY(lat) - yN) * sy] } }
}
