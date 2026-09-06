import { describe, it, expect } from 'vitest'
import { createEruptionSource } from '../../src/engine/eruptionSource.js'
import { simConfig } from '../../src/config/simConfig.js'

const series = [
  { timeUtc: '2026-09-04T00:00:00Z', heightKm: 1.5 },
  { timeUtc: '2026-09-04T16:30:00Z', heightKm: 13.7 },
  { timeUtc: '2026-09-04T17:50:00Z', heightKm: 15.2 },
  { timeUtc: '2026-09-06T02:00:00Z', heightKm: 6.1 },
]
const src = createEruptionSource(series, simConfig.emission)
const T = s => Date.parse(s)

describe('createEruptionSource', () => {
  it('holds the height until the next point (step function)', () => {
    expect(src.plumeHeightAt(T('2026-09-04T10:00:00Z'))).toBe(1.5)
    expect(src.plumeHeightAt(T('2026-09-04T16:30:00Z'))).toBe(13.7)
    expect(src.plumeHeightAt(T('2026-09-04T17:00:00Z'))).toBe(13.7)
    expect(src.plumeHeightAt(T('2026-09-05T12:00:00Z'))).toBe(15.2)
    expect(src.plumeHeightAt(T('2026-09-06T23:00:00Z'))).toBe(6.1)
  })
  it('uses the first height before the series starts', () => {
    expect(src.plumeHeightAt(T('2026-09-03T00:00:00Z'))).toBe(1.5)
  })
  it('emission scales with (H/ref)^2, floored at minFactor, per 600 s', () => {
    expect(src.emissionCountAt(T('2026-09-05T12:00:00Z'), 600)).toBeCloseTo(60, 6)
    expect(src.emissionCountAt(T('2026-09-05T12:00:00Z'), 300)).toBeCloseTo(30, 6)
    expect(src.emissionCountAt(T('2026-09-04T10:00:00Z'), 600)).toBeCloseTo(60 * 0.05, 6) // (1.5/15.2)^2 < 0.05
    expect(src.emissionCountAt(T('2026-09-06T12:00:00Z'), 600)).toBeCloseTo(60 * (6.1 / 15.2) ** 2, 6)
  })
})
