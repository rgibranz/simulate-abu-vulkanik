import { describe, it, expect } from 'vitest'
import { valueAt, scaleLinear, linePath, stepPath } from '../../src/utils/series.js'

describe('series helpers', () => {
  const t = [0, 10, 20], v = [1, 3, 2]
  it('valueAt interpolates and clamps', () => {
    expect(valueAt(t, v, 5)).toBe(2)
    expect(valueAt(t, v, 15)).toBe(2.5)
    expect(valueAt(t, v, -5)).toBe(1)
    expect(valueAt(t, v, 99)).toBe(2)
    expect(valueAt([], [], 1)).toBeNull()
  })
  it('scaleLinear maps domain to range', () => {
    const s = scaleLinear(0, 100, 0, 200)
    expect(s(50)).toBe(100); expect(scaleLinear(5, 5, 0, 1)(5)).toBe(0)
  })
  it('linePath breaks at nulls', () => {
    expect(linePath([[0, 1], [1, 2], null, [2, 3]])).toBe('M0 1 L1 2 M2 3')
  })
  it('stepPath holds values until the next point', () => {
    expect(stepPath([[0, 5], [10, 8]], 20)).toBe('M0 5 H10 V8 H20')
    expect(stepPath([], 1)).toBe('')
  })
})
