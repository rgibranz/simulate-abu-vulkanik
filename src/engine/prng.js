// mulberry32: PRNG 32-bit deterministik, cukup buat visualisasi
export function createPrng(seed) {
  let state = seed >>> 0
  let spare = null // cache Box-Muller
  function next() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  function gauss() {
    if (spare !== null) { const g = spare; spare = null; return g }
    let u, v, s
    do { u = next() * 2 - 1; v = next() * 2 - 1; s = u * u + v * v } while (s === 0 || s >= 1)
    const m = Math.sqrt(-2 * Math.log(s) / s)
    spare = v * m
    return u * m
  }
  return {
    next, gauss,
    getState: () => state,
    setState: (s) => { state = s >>> 0; spare = null },
  }
}
