import { describe, it, expect } from 'vitest'
import { buildWindDataset, windIndex } from '../../scripts/lib/buildWind.mjs'

// 2 titik (lat -6 & -5 di lon 105), 2 level, 2 jam
function point(lat, lon, spd850, dir850, spd700, dir700) {
  return { latitude: lat + 0.03, longitude: lon - 0.02, hourly: {
    time: ['2026-09-04T00:00', '2026-09-04T01:00'],
    wind_speed_850hPa: [spd850, spd850], wind_direction_850hPa: [dir850, dir850],
    wind_speed_700hPa: [spd700, spd700], wind_direction_700hPa: [dir700, dir700],
  } }
}
const levels = [{ name: '850hPa', altKm: 1.5 }, { name: '700hPa', altKm: 3.0 }]

describe('buildWindDataset', () => {
  const points = [point(-5, 105, 36, 90, 18, 180), point(-6, 105, 36, 270, 18, 0)] // urutan acak sengaja
  const ds = buildWindDataset(points, { lats: [-6, -5], lons: [105], levels })
  it('normalizes times to ISO Z', () => {
    expect(ds.times).toEqual(['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z'])
  })
  it('converts km/h + direction to u,v m/s in [t][level][lat][lon] order', () => {
    // lat -6 (i=0), 850hPa (l=0), t=0: dari barat 36 km/h → u=+10
    expect(ds.u[windIndex(ds, 0, 0, 0, 0)]).toBeCloseTo(10, 2)
    expect(ds.v[windIndex(ds, 0, 0, 0, 0)]).toBeCloseTo(0, 2)
    // lat -5 (i=1), 850hPa: dari timur → u=-10
    expect(ds.u[windIndex(ds, 0, 0, 1, 0)]).toBeCloseTo(-10, 2)
    // lat -5, 700hPa (l=1): dari selatan 18 km/h → v=+5
    expect(ds.v[windIndex(ds, 0, 1, 1, 0)]).toBeCloseTo(5, 2)
  })
  it('has the right lengths', () => {
    expect(ds.u).toHaveLength(2 * 2 * 2 * 1)
    expect(ds.levels).toEqual(levels)
  })
  it('throws when a grid point is missing', () => {
    expect(() => buildWindDataset(points, { lats: [-6, -5, -4], lons: [105], levels })).toThrow(/missing/i)
  })
})
