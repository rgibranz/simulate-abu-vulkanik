import { describe, it, expect } from 'vitest'
import { createPrng } from '../../src/engine/prng.js'

describe('createPrng', () => {
  it('is deterministic for the same seed', () => {
    const a = createPrng(42), b = createPrng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })
  it('returns values in [0,1)', () => {
    const p = createPrng(7)
    for (let i = 0; i < 1000; i++) { const x = p.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
  it('gauss has ~0 mean and ~1 std', () => {
    const p = createPrng(3); let s = 0, s2 = 0; const n = 20000
    for (let i = 0; i < n; i++) { const g = p.gauss(); s += g; s2 += g * g }
    const mean = s / n, std = Math.sqrt(s2 / n - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.03)
    expect(Math.abs(std - 1)).toBeLessThan(0.03)
  })
  it('state can be saved and restored', () => {
    const p = createPrng(9); p.next(); const s = p.getState(); const x = p.next()
    p.setState(s); expect(p.next()).toBe(x)
  })
})
