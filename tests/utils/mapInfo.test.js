import { describe, it, expect } from 'vitest'
import { distanceKm, bearingDeg, compassName, uvToHeading, summarizePoint } from '../../src/utils/mapInfo.js'

describe('mapInfo', () => {
  it('distance and bearing Krakatau → Jakarta', () => {
    const d = distanceKm(-6.102, 105.423, -6.2, 106.85)
    expect(d).toBeGreaterThan(150); expect(d).toBeLessThan(165)
    const b = bearingDeg(-6.102, 105.423, -6.2, 106.85)
    expect(b).toBeGreaterThan(90); expect(b).toBeLessThan(100) // hampir tepat timur
    expect(compassName(b)).toBe('timur')
  })
  it('compassName covers 8 points and wraps', () => {
    expect(compassName(0)).toBe('utara'); expect(compassName(135)).toBe('tenggara'); expect(compassName(359)).toBe('utara'); expect(compassName(-90)).toBe('barat')
  })
  it('uvToHeading', () => {
    const h = uvToHeading(10, 0); expect(h.toDeg).toBeCloseTo(90, 6); expect(h.speedKmh).toBeCloseTo(36, 6)
  })
  it('summarizePoint counts particles, reads deposition, wind and nearest city', () => {
    const frame = { count: 3, positions: new Float32Array([106.85, -6.2, 3, 1, 106.86, -6.21, 12, 1, 100, -10, 3, 1]) }
    const grid = { max: 4, cellIndex: () => 7, values: { 7: 1 } }
    const windField = { levels: [{ name: '700hPa', altKm: 3 }], timeStartMs: 0, timeEndMs: 10, sample: () => ({ u: 0, v: -5 }) }
    const s = summarizePoint({ lat: -6.2, lon: 106.85, frame, grid, windField, levelIndex: 0, tMs: 5, vent: { lat: -6.102, lon: 105.423 }, places: { cities: [{ name: 'Jakarta', lat: -6.2, lon: 106.85 }, { name: 'Bogor', lat: -6.6, lon: 106.8 }] }, lowTopKm: 6.1 })
    expect(s.particles).toEqual({ low: 1, high: 1, radiusKm: 25 })
    expect(s.deposition).toEqual({ value: 1, fraction: 0.25 })
    expect(s.wind.toName).toBe('selatan'); expect(s.wind.speedKmh).toBeCloseTo(18, 6)
    expect(s.nearestPlace.name).toBe('Jakarta'); expect(s.bearingName).toBe('timur')
  })
})
