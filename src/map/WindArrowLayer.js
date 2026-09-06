import L from 'leaflet'
import { createProjector } from './projection.js'

const REF_SPEED = 30 // m/s → panjang panah maksimum
const HALF_HOUR = 1800e3

// Panah angin di simpul grid untuk satu level, diperbarui tiap 30 menit sim
// options: windField, maxLenPx (36), lineWidth (1.5), color
export const WindArrowLayer = L.Layer.extend({
  initialize(options) {
    L.setOptions(this, options); this._windField = options.windField; this._state = { visible: false, levelIndex: 2, tMs: 0 }; this._slot = null
    this._maxLen = options.maxLenPx ?? 36; this._lineWidth = options.lineWidth ?? 1.5; this._color = options.color ?? 'rgba(127, 209, 255, 0.85)'
  },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'wind-arrow-canvas'); this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this); this._reset()
  },
  onRemove(map) { map.off('moveend zoomend resize', this._reset, this); L.DomUtil.remove(this._canvas); this._map = null },
  setWindField(windField) { this._windField = windField; this._slot = null; this._draw() },
  setState({ visible, levelIndex, tMs }) {
    const slot = Math.floor(tMs / HALF_HOUR)
    const changed = visible !== this._state.visible || levelIndex !== this._state.levelIndex || slot !== this._slot
    this._state = { visible, levelIndex, tMs }; this._slot = slot
    if (changed) this._draw()
  },
  _reset() {
    const size = this._map.getSize(); this._canvas.width = size.x; this._canvas.height = size.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0])); this._draw()
  },
  _draw() {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d'); const { width, height } = this._canvas
    ctx.clearRect(0, 0, width, height)
    const { visible, levelIndex, tMs } = this._state
    if (!visible) return
    const wf = this._windField, alt = wf.levels[levelIndex].altKm
    const t = Math.min(Math.max(tMs, wf.timeStartMs), wf.timeEndMs)
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    const maxLen = this._maxLen, head = Math.max(6, maxLen / 6)
    ctx.strokeStyle = this._color; ctx.fillStyle = this._color; ctx.lineWidth = this._lineWidth; ctx.lineCap = 'round'
    for (const lat of wf.lats) for (const lon of wf.lons) {
      const w = wf.sample(lat, lon, alt, t); if (!w) continue
      const [x, y] = proj.toPixel(lon, lat); if (x < -maxLen || y < -maxLen || x > width + maxLen || y > height + maxLen) continue
      const speed = Math.hypot(w.u, w.v), len = Math.min(maxLen, (speed / REF_SPEED) * maxLen)
      const dx = (w.u / (speed || 1)) * len, dy = (-w.v / (speed || 1)) * len // layar: y ke bawah
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke()
      const ang = Math.atan2(dy, dx)
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy)
      ctx.lineTo(x + dx - head * Math.cos(ang - 0.5), y + dy - head * Math.sin(ang - 0.5))
      ctx.lineTo(x + dx - head * Math.cos(ang + 0.5), y + dy - head * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill()
    }
  },
})
