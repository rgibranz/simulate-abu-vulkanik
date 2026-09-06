import { describe, it, expect } from 'vitest'
import { createParticleSystem } from '../../src/engine/particleSystem.js'
import { createPrng } from '../../src/engine/prng.js'
import { createDepositionGrid } from '../../src/engine/deposition.js'
import { simConfig } from '../../src/config/simConfig.js'
import { metersPerDegLon } from '../../src/engine/geo.js'

const T0 = Date.parse(simConfig.startUtc)
const uniformWind = (u, v) => ({ sample: (lat, lon) => (lon > 111 ? null : { u, v }), timeStartMs: -Infinity, timeEndMs: Infinity })
const noVaac = { layerMotionAt: () => null }
const quietSource = { plumeHeightAt: () => 5, emissionCountAt: () => 0 }
const noDiffusion = { ...simConfig, maxParticles: 100, diffusion: { horizontalM2s: 0, verticalSigmaMPerStep: 0 }, vaacNudge: 0 }

function build({ config = noDiffusion, wind = uniformWind(10, 0), source = quietSource, vaac = noVaac, seed = 1 } = {}) {
  const deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
  const system = createParticleSystem({ config, windField: wind, eruptionSource: source, vaacAdvisories: vaac, deposition, prng: createPrng(seed) })
  system.reset(T0)
  return { system, deposition }
}

describe('createParticleSystem', () => {
  it('advects a particle with uniform eastward wind (~0.325° per hour at 6°S)', () => {
    const { system } = build()
    system.spawn(-6, 105, 3, 0)
    for (let i = 0; i < 6; i++) system.advance(600)
    const f = system.getFrame()
    expect(system.aliveCount).toBe(1)
    expect(f[0]).toBeCloseTo(105 + 36000 / metersPerDegLon(-6), 2)
    expect(f[1]).toBeCloseTo(-6, 3)
    expect(f[2]).toBeCloseTo(3 - 0.01 * 3600 / 1000, 3) // fine settles 36 m
    expect(f[3]).toBeCloseTo(1, 6) // umur 1 jam
    expect(system.timeMs).toBe(T0 + 3600e3)
  })
  it('coarse particle from 1 km deposits after ~33 min with weight 1.0', () => {
    const { system, deposition } = build({ wind: uniformWind(0, 0) })
    system.spawn(-6.2, 106.85, 1, 2)
    for (let i = 0; i < 3; i++) system.advance(600)
    expect(system.aliveCount).toBe(1)
    system.advance(600)
    expect(system.aliveCount).toBe(0)
    expect(deposition.values[deposition.cellIndex(-6.2, 106.85)]).toBeCloseTo(1.0, 6)
  })
  it('emits with fractional carry and assigns altitudes within [0.1H, H]', () => {
    const source = { plumeHeightAt: () => 10, emissionCountAt: () => 2.5 }
    // settling dimatikan biar ketinggian awal bisa dicek apa adanya
    const cfg = { ...noDiffusion, sizeClasses: noDiffusion.sizeClasses.map(c => ({ ...c, settleMps: 0 })) }
    const { system } = build({ config: cfg, source })
    system.advance(600); expect(system.aliveCount).toBe(2)
    system.advance(600); expect(system.aliveCount).toBe(5)
    const f = system.getFrame()
    for (let k = 0; k < system.aliveCount; k++) { expect(f[k * 4 + 2]).toBeGreaterThan(0.9); expect(f[k * 4 + 2]).toBeLessThanOrEqual(10) }
  })
  it('kills particles when wind is unavailable or outside the domain', () => {
    const { system } = build()
    system.spawn(-6, 111.05, 3, 0) // angin null di lon > 111
    system.advance(600)
    expect(system.aliveCount).toBe(0)
    const { system: s2 } = build({ wind: uniformWind(0, 200) })
    s2.spawn(-2.05, 105, 3, 0) // 200 m/s ke utara keluar domain
    s2.advance(600)
    expect(s2.aliveCount).toBe(0)
  })
  it('applies the VAAC nudge as a velocity blend', () => {
    const cfg = { ...noDiffusion, vaacNudge: 0.5 }
    const vaac = { layerMotionAt: (t, alt) => (alt <= cfg.lowLayerTopKm ? { u: -10, v: 0 } : { u: 30, v: 0 }) }
    const { system } = build({ config: cfg, vaac })
    system.spawn(-6, 105, 3, 0); system.spawn(-6, 105, 10, 0)
    system.advance(600)
    const f = system.getFrame()
    // rendah: 0.5*10 + 0.5*(-10) = 0 → diam ; tinggi: 0.5*10 + 0.5*30 = 20 m/s → 12 km
    expect(f[0]).toBeCloseTo(105, 4)
    expect(f[4]).toBeCloseTo(105 + 12000 / metersPerDegLon(-6), 3)
  })
  it('is deterministic for the same seed with diffusion on', () => {
    const cfg = { ...simConfig, maxParticles: 500 }
    const source = { plumeHeightAt: () => 8, emissionCountAt: () => 20 }
    const a = build({ config: cfg, source, seed: 5 }).system, b = build({ config: cfg, source, seed: 5 }).system
    for (let i = 0; i < 12; i++) { a.advance(600); b.advance(600) }
    expect(a.aliveCount).toBe(b.aliveCount)
    expect(Array.from(a.getFrame())).toEqual(Array.from(b.getFrame()))
  })
  it('restores a keyframe and continues within quantization tolerance', () => {
    const cfg = { ...simConfig, maxParticles: 500 }
    const source = { plumeHeightAt: () => 8, emissionCountAt: () => 20 }
    const { system, deposition } = build({ config: cfg, source, seed: 8 })
    for (let i = 0; i < 6; i++) system.advance(600)
    const kf = system.saveKeyframe()
    for (let i = 0; i < 6; i++) system.advance(600)
    const direct = Array.from(system.getFrame()), directAlive = system.aliveCount, directDep = deposition.max()
    system.restoreKeyframe(kf)
    expect(system.timeMs).toBe(T0 + 3600e3)
    for (let i = 0; i < 6; i++) system.advance(600)
    const replay = Array.from(system.getFrame())
    expect(system.aliveCount).toBe(directAlive)
    expect(replay.length).toBe(direct.length)
    for (let k = 0; k < replay.length; k += 4) {
      expect(Math.abs(replay[k] - direct[k])).toBeLessThan(0.02)
      expect(Math.abs(replay[k + 1] - direct[k + 1])).toBeLessThan(0.02)
      expect(Math.abs(replay[k + 2] - direct[k + 2])).toBeLessThan(0.15)
    }
    expect(Math.abs(deposition.max() - directDep)).toBeLessThan(1.5) // kuantisasi bisa geser 1 partikel ke sel tetangga
  })
})
