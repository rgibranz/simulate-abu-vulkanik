import { describe, it, expect } from 'vitest'
import { latLonToScanAngles, latLonToGridPx, gridToSlider, HIMAWARI } from '../../scripts/lib/geos.mjs'

describe('geos projection (Himawari)', () => {
  it('sub-satellite point is the image centre', () => {
    const s = latLonToScanAngles(0, 140.7)
    expect(s.xDeg).toBeCloseTo(0, 9); expect(s.yDeg).toBeCloseTo(0, 9)
    const px = latLonToGridPx(0, 140.7)
    expect(px.col).toBeCloseTo(HIMAWARI.coff - 1, 6); expect(px.line).toBeCloseTo(HIMAWARI.coff - 1, 6)
  })
  it('west is left, north is up', () => {
    const k = latLonToGridPx(-6.1, 105.42)
    expect(k.col).toBeLessThan(HIMAWARI.coff)
    expect(k.line).toBeGreaterThan(HIMAWARI.coff) // selatan → baris lebih besar
    const n = latLonToGridPx(5, 105.42)
    expect(n.line).toBeLessThan(HIMAWARI.coff)
  })
  it('1 km grid: 1 degree of longitude near the equator is roughly 111 px at nadir', () => {
    const a = latLonToGridPx(0, 140.7), b = latLonToGridPx(0, 141.7)
    expect(b.col - a.col).toBeGreaterThan(105); expect(b.col - a.col).toBeLessThan(115)
  })
  it('returns null behind the Earth', () => {
    expect(latLonToScanAngles(0, -40)).toBeNull()
  })
  it('maps grid pixels to SLIDER tiles', () => {
    const t = gridToSlider(5000, 5000, { zoom: 3 })
    expect(t.tileCol).toBe(3); expect(t.tileRow).toBe(3) // 5000 px grid → 2501,8 px SLIDER → tile ke-4 (indeks 3)
    expect(t.u).toBeCloseTo((5000 * 688 * 8) / 11000, 6)
    expect(t.du).toBeGreaterThanOrEqual(0); expect(t.du).toBeLessThan(688)
  })
})
