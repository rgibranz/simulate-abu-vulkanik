import { describe, it, expect } from 'vitest'
import { createDepositionGrid } from '../../src/engine/deposition.js'

describe('createDepositionGrid', () => {
  const grid = createDepositionGrid({ latMin: -11, latMax: -2, lonMin: 100, lonMax: 112, cellDeg: 0.1 })
  it('has 90 rows x 120 cols', () => {
    expect(grid.rows).toBe(90); expect(grid.cols).toBe(120); expect(grid.values).toHaveLength(10800)
  })
  it('maps lat/lon to a cell, row 0 at the south edge', () => {
    expect(grid.cellIndex(-11, 100)).toBe(0)
    expect(grid.cellIndex(-10.95, 100.05)).toBe(0)
    expect(grid.cellIndex(-10.85, 100.05)).toBe(120)
    expect(grid.cellIndex(-2, 112)).toBe(10800 - 1) // tepi atas/kanan masuk sel terakhir
    expect(grid.cellIndex(-12, 100)).toBe(-1)
    expect(grid.cellIndex(-6, 113)).toBe(-1)
  })
  it('accumulates weights and reports max', () => {
    grid.add(-6.2, 106.85, 0.5); grid.add(-6.2, 106.85, 1.0); grid.add(-20, 106, 5)
    expect(grid.values[grid.cellIndex(-6.2, 106.85)]).toBeCloseTo(1.5, 6)
    expect(grid.max()).toBeCloseTo(1.5, 6)
  })
  it('snapshot/restore/reset', () => {
    const snap = grid.snapshot(); grid.reset(); expect(grid.max()).toBe(0)
    grid.restore(snap); expect(grid.max()).toBeCloseTo(1.5, 6)
    expect(snap).not.toBe(grid.values)
  })
})
