import L from 'leaflet'
import { createProjector } from './projection.js'

const ALT_BUCKETS = 8, AGE_BUCKETS = 3, MAX_ALT_KM = 16
// warna: rendah = abu gelap hangat, tinggi = abu terang kebiruan
const LOW_RGB = [96, 74, 54], HIGH_RGB = [190, 205, 222]
const AGE_ALPHA = [0.9, 0.6, 0.35] // < 6 jam, < 18 jam, sisanya

function bucketStyles() {
  const styles = []
  for (let a = 0; a < ALT_BUCKETS; a++) {
    const f = a / (ALT_BUCKETS - 1)
    const rgb = LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i] - lo) * f))
    for (let g = 0; g < AGE_BUCKETS; g++) styles.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${AGE_ALPHA[g]})`)
  }
  return styles
}

export const ParticleLayer = L.Layer.extend({
  initialize(options = {}) {
    L.setOptions(this, options)
    this._lowTopKm = options.lowTopKm ?? 6.1
    this._frame = null
    this._show = { low: true, high: true }
    this._styles = bucketStyles()
    this._buckets = Array.from({ length: ALT_BUCKETS * AGE_BUCKETS }, () => [])
  },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'ash-particle-canvas')
    this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this)
    this._reset()
  },
  onRemove(map) {
    map.off('moveend zoomend resize', this._reset, this)
    L.DomUtil.remove(this._canvas)
    this._map = null
  },
  setFrame(frame) { this._frame = frame; this._draw() },
  setVisibility({ low, high }) { this._show = { low, high }; this._draw() },
  _reset() {
    const size = this._map.getSize()
    this._canvas.width = size.x; this._canvas.height = size.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]))
    this._draw()
  },
  _draw() {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d')
    const { width, height } = this._canvas
    ctx.clearRect(0, 0, width, height)
    const frame = this._frame
    if (!frame || frame.count === 0) return
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    for (const bucket of this._buckets) bucket.length = 0
    const p = frame.positions
    for (let i = 0; i < frame.count * 4; i += 4) {
      const alt = p[i + 2]
      if (alt <= this._lowTopKm ? !this._show.low : !this._show.high) continue
      const [x, y] = proj.toPixel(p[i], p[i + 1])
      if (x < 0 || y < 0 || x > width || y > height) continue
      const a = Math.min(ALT_BUCKETS - 1, Math.floor((alt / MAX_ALT_KM) * ALT_BUCKETS))
      const age = p[i + 3], g = age < 6 ? 0 : age < 18 ? 1 : 2
      this._buckets[a * AGE_BUCKETS + g].push(x, y)
    }
    this._buckets.forEach((pts, k) => {
      if (!pts.length) return
      ctx.fillStyle = this._styles[k]
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i] - 1, pts[i + 1] - 1, 2, 2)
    })
  },
})
