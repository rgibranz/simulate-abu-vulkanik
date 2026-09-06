import { describe, it, expect } from 'vitest'
import { mercatorY, createProjector } from '../../src/map/projection.js'

describe('projection', () => {
  it('mercatorY is 0 at the equator and antisymmetric', () => {
    expect(mercatorY(0)).toBeCloseTo(0, 9)
    expect(mercatorY(-6)).toBeCloseTo(-mercatorY(6), 9)
  })
  it('maps viewport corners to pixel corners', () => {
    const p = createProjector({ west: 100, east: 112, north: -2, south: -11, width: 1200, height: 900 })
    const [x0, y0] = p.toPixel(100, -2); expect(x0).toBeCloseTo(0, 6); expect(y0).toBeCloseTo(0, 6)
    const [x, y] = p.toPixel(112, -11); expect(x).toBeCloseTo(1200, 6); expect(y).toBeCloseTo(900, 6)
  })
  it('is linear in longitude', () => {
    const p = createProjector({ west: 100, east: 110, north: 0, south: -10, width: 1000, height: 1000 })
    expect(p.toPixel(105, 0)[0]).toBeCloseTo(500, 6)
  })
})
