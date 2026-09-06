import { describe, it, expect } from 'vitest'
import { createWindField } from '../../src/engine/windField.js'

// grid 2x2 (lat -7,-6; lon 105,106), 2 level, 2 jam; u = kode unik per sel biar gampang dicek
const levels = [{ name: '850hPa', altKm: 1.5 }, { name: '700hPa', altKm: 3.0 }]
const times = ['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z']
const ds = { lats: [-7, -6], lons: [105, 106], levels, times, u: [], v: [] }
for (let t = 0; t < 2; t++) for (let l = 0; l < 2; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
  ds.u.push(t * 1000 + l * 100 + i * 10 + j) // t=0,l=0,i=0,j=0 → 0 ; i=1 → 10 ; j=1 → 1
  ds.v.push(1)
}
const T0 = Date.parse(times[0])
const wf = createWindField(ds)

describe('createWindField', () => {
  it('returns exact value at grid nodes', () => {
    expect(wf.sample(-7, 105, 1.5, T0).u).toBeCloseTo(0, 6)
    expect(wf.sample(-6, 106, 1.5, T0).u).toBeCloseTo(11, 6)
    expect(wf.sample(-6, 106, 3.0, T0).u).toBeCloseTo(111, 6)
    expect(wf.sample(-6, 106, 3.0, T0 + 3600e3).u).toBeCloseTo(1111, 6)
  })
  it('averages at the horizontal cell centre', () => {
    expect(wf.sample(-6.5, 105.5, 1.5, T0).u).toBeCloseTo((0 + 1 + 10 + 11) / 4, 6)
  })
  it('interpolates linearly in altitude and clamps outside the level range', () => {
    expect(wf.sample(-7, 105, 2.25, T0).u).toBeCloseTo(50, 6)
    expect(wf.sample(-7, 105, 0, T0).u).toBeCloseTo(0, 6)
    expect(wf.sample(-7, 105, 20, T0).u).toBeCloseTo(100, 6)
  })
  it('interpolates linearly in time', () => {
    expect(wf.sample(-7, 105, 1.5, T0 + 1800e3).u).toBeCloseTo(500, 6)
  })
  it('returns null outside the domain or time range', () => {
    expect(wf.sample(-8, 105, 1.5, T0)).toBeNull()
    expect(wf.sample(-7, 107, 1.5, T0)).toBeNull()
    expect(wf.sample(-7, 105, 1.5, T0 - 1)).toBeNull()
    expect(wf.sample(-7, 105, 1.5, T0 + 3600e3 + 1)).toBeNull()
  })
  it('exposes bounds and time range', () => {
    expect(wf.bounds).toEqual({ latMin: -7, latMax: -6, lonMin: 105, lonMax: 106 })
    expect(wf.timeStartMs).toBe(T0); expect(wf.timeEndMs).toBe(T0 + 3600e3)
    expect(wf.uvAt(1, 1, 1, 1)).toEqual({ u: 1111, v: 1 })
  })
})
