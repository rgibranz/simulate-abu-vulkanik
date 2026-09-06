import { describe, it, expect } from 'vitest'
import { M_PER_DEG_LAT, metersPerDegLon, windFromToUV, headingToUV, compassToDeg, pointInPolygon, flToKm } from '../../src/engine/geo.js'

describe('geo', () => {
  it('meters per degree', () => {
    expect(M_PER_DEG_LAT).toBe(110540)
    expect(metersPerDegLon(0)).toBeCloseTo(111320, 0)
    expect(metersPerDegLon(-6)).toBeCloseTo(111320 * Math.cos(-6 * Math.PI / 180), 0)
  })
  it('wind FROM east pushes west (u<0)', () => {
    const { u, v } = windFromToUV(90, 10)
    expect(u).toBeCloseTo(-10, 6); expect(v).toBeCloseTo(0, 6)
  })
  it('wind FROM north pushes south (v<0)', () => {
    const { u, v } = windFromToUV(0, 5)
    expect(u).toBeCloseTo(0, 6); expect(v).toBeCloseTo(-5, 6)
  })
  it('heading toward SE gives u>0, v<0', () => {
    const { u, v } = headingToUV(135, Math.SQRT2)
    expect(u).toBeCloseTo(1, 6); expect(v).toBeCloseTo(-1, 6)
  })
  it('compass names', () => {
    expect(compassToDeg('N')).toBe(0); expect(compassToDeg('SE')).toBe(135)
    expect(compassToDeg('WNW')).toBe(292.5); expect(() => compassToDeg('X')).toThrow()
  })
  it('flToKm', () => { expect(flToKm(200)).toBeCloseTo(6.096, 3); expect(flToKm(500)).toBeCloseTo(15.24, 2) })
  it('pointInPolygon', () => {
    const square = [[-5, 105], [-5, 107], [-7, 107], [-7, 105]]
    expect(pointInPolygon(-6, 106, square)).toBe(true)
    expect(pointInPolygon(-8, 106, square)).toBe(false)
    expect(pointInPolygon(-6, 108, square)).toBe(false)
  })
})
