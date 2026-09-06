import { describe, it, expect } from 'vitest'
import { createVaacAdvisories } from '../../src/engine/vaacAdvisories.js'

const KT = 0.514444
const advisories = [
  { nr: '2026/162', obsUtc: '2026-09-04T10:00:00Z', issuedUtc: '2026-09-04T10:25:00Z', forecasts: [],
    layers: [{ topFl: 50, topKm: 1.524, polygon: [], moveDeg: 225, moveKt: 5 }] },
  { nr: '2026/171', obsUtc: '2026-09-05T00:10:00Z', issuedUtc: '2026-09-05T00:30:00Z', forecasts: [],
    layers: [{ topFl: 200, topKm: 6.096, polygon: [], moveDeg: 135, moveKt: 10 },
             { topFl: 500, topKm: 15.24, polygon: [], moveDeg: 270, moveKt: 40 }] },
]
const va = createVaacAdvisories(advisories)
const T = s => Date.parse(s)

describe('createVaacAdvisories', () => {
  it('latestObsAt picks the last advisory at or before t', () => {
    expect(va.latestObsAt(T('2026-09-04T09:59:00Z'))).toBeNull()
    expect(va.latestObsAt(T('2026-09-04T10:00:00Z')).nr).toBe('2026/162')
    expect(va.latestObsAt(T('2026-09-05T03:00:00Z')).nr).toBe('2026/171')
  })
  it('chooses the layer by altitude', () => {
    const a = va.latestObsAt(T('2026-09-05T03:00:00Z'))
    expect(va.layerForAltitude(a, 3).topFl).toBe(200)
    expect(va.layerForAltitude(a, 6.096).topFl).toBe(200)
    expect(va.layerForAltitude(a, 10).topFl).toBe(500)
    expect(va.layerForAltitude(a, 20).topFl).toBe(500)
  })
  it('single-layer advisory applies to all altitudes', () => {
    const a = va.latestObsAt(T('2026-09-04T12:00:00Z'))
    expect(va.layerForAltitude(a, 12).topFl).toBe(50)
  })
  it('layerMotionAt returns m/s vector toward the movement heading', () => {
    const low = va.layerMotionAt(T('2026-09-05T03:00:00Z'), 3)
    expect(low.u).toBeCloseTo(10 * KT * Math.SQRT1_2, 4); expect(low.v).toBeCloseTo(-10 * KT * Math.SQRT1_2, 4)
    const high = va.layerMotionAt(T('2026-09-05T03:00:00Z'), 12)
    expect(high.u).toBeCloseTo(-40 * KT, 4); expect(high.v).toBeCloseTo(0, 4)
    expect(va.layerMotionAt(T('2026-09-04T00:00:00Z'), 3)).toBeNull()
  })
})
