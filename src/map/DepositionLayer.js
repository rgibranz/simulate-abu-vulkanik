import L from 'leaflet'
import { createProjector } from './projection.js'

// Endapan: sel grid diwarnai dengan alpha ∝ log(nilai)/log(maks)
export const DepositionLayer = L.Layer.extend({
  initialize(options = {}) { L.setOptions(this, options); this._grid = null; this._visible = true },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'ash-deposition-canvas')
    this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this)
    this._reset()
  },
  onRemove(map) { map.off('moveend zoomend resize', this._reset, this); L.DomUtil.remove(this._canvas); this._map = null },
  setGrid(grid) { this._grid = grid; this._draw() },
  setVisible(v) { this._visible = v; this._draw() },
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
    const g = this._grid
    if (!this._visible || !g || !(g.max > 0)) return
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    const logMax = Math.log1p(g.max)
    ctx.fillStyle = 'rgb(214, 150, 48)'
    for (let r = 0; r < g.rows; r++) {
      const lat0 = g.latMin + r * g.cellDeg, lat1 = lat0 + g.cellDeg
      for (let c = 0; c < g.cols; c++) {
        const v = g.values[r * g.cols + c]
        if (v <= 0) continue
        const lon0 = g.lonMin + c * g.cellDeg
        const [x0, y0] = proj.toPixel(lon0, lat1), [x1, y1] = proj.toPixel(lon0 + g.cellDeg, lat0)
        if (x1 < 0 || y1 < 0 || x0 > width || y0 > height) continue
        ctx.globalAlpha = 0.15 + 0.7 * (Math.log1p(v) / logMax)
        ctx.fillRect(x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5)
      }
    }
    ctx.globalAlpha = 1
  },
})
