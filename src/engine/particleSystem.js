import { M_PER_DEG_LAT, metersPerDegLon } from './geo.js'

// Sistem partikel Lagrangian (spec §4.3). Typed arrays + free-list, deterministik lewat prng.
export function createParticleSystem({ config, windField, eruptionSource, vaacAdvisories, deposition, prng }) {
  const N = config.maxParticles
  const lon = new Float32Array(N), lat = new Float32Array(N), alt = new Float32Array(N)
  const cls = new Uint8Array(N), alive = new Uint8Array(N), bornMs = new Float64Array(N)
  const classes = config.sizeClasses
  const cumFraction = []
  classes.reduce((acc, c) => { cumFraction.push(acc + c.fraction); return acc + c.fraction }, 0)
  const { domain, emission: e, vent } = config
  const startMs = Date.parse(config.startUtc)

  let free = [], aliveCount = 0, timeMs = startMs, carry = 0

  function reset(tMs) {
    alive.fill(0); free = []
    for (let k = N - 1; k >= 0; k--) free.push(k) // pop → indeks kecil dulu
    aliveCount = 0; timeMs = tMs; carry = 0
  }
  reset(startMs)

  function spawn(la, lo, al, classIndex) {
    if (free.length === 0) return -1
    const k = free.pop()
    lat[k] = la; lon[k] = lo; alt[k] = al; cls[k] = classIndex; alive[k] = 1; bornMs[k] = timeMs
    aliveCount++
    return k
  }
  function kill(k) { alive[k] = 0; free.push(k); aliveCount-- }

  function pickClass() {
    const r = prng.next()
    for (let i = 0; i < cumFraction.length; i++) if (r < cumFraction[i]) return i
    return classes.length - 1
  }

  // emisi dari kawah: ketinggian di pita umbrella/bawah, offset radial acak
  function emit(count) {
    const H = eruptionSource.plumeHeightAt(timeMs)
    const R = e.umbrellaFactor * H * 1000
    const mPerDegLon = metersPerDegLon(vent.lat)
    for (let n = 0; n < count; n++) {
      const inUmbrella = prng.next() < e.umbrellaFraction
      const a = inUmbrella
        ? H * (e.umbrellaBandLow + prng.next() * (1 - e.umbrellaBandLow))
        : H * (e.lowBandFloor + prng.next() * (e.umbrellaBandLow - e.lowBandFloor))
      const r = R * prng.next(), th = prng.next() * 2 * Math.PI
      spawn(vent.lat + (r * Math.cos(th)) / M_PER_DEG_LAT, vent.lon + (r * Math.sin(th)) / mPerDegLon, a, pickClass())
    }
  }

  function advance(dtSec) {
    carry += eruptionSource.emissionCountAt(timeMs, dtSec)
    const n = Math.floor(carry); carry -= n
    emit(n)

    const sigmaH = Math.sqrt(2 * config.diffusion.horizontalM2s * dtSec)
    const sigmaZKm = (config.diffusion.verticalSigmaMPerStep * Math.sqrt(dtSec / 600)) / 1000
    const alpha = config.vaacNudge
    const tSample = Math.min(Math.max(timeMs, windField.timeStartMs), windField.timeEndMs)
    const nudgeLow = alpha > 0 ? vaacAdvisories.layerMotionAt(timeMs, 0) : null
    const nudgeHigh = alpha > 0 ? vaacAdvisories.layerMotionAt(timeMs, config.lowLayerTopKm + 0.001) : null

    for (let k = 0; k < N; k++) {
      if (!alive[k]) continue
      const w = windField.sample(lat[k], lon[k], alt[k], tSample)
      if (!w) { kill(k); continue }
      let u = w.u, v = w.v
      const nudge = alt[k] <= config.lowLayerTopKm ? nudgeLow : nudgeHigh
      if (nudge) { u = (1 - alpha) * u + alpha * nudge.u; v = (1 - alpha) * v + alpha * nudge.v }
      const dx = u * dtSec + (sigmaH ? sigmaH * prng.gauss() : 0)
      const dy = v * dtSec + (sigmaH ? sigmaH * prng.gauss() : 0)
      lat[k] += dy / M_PER_DEG_LAT
      lon[k] += dx / metersPerDegLon(lat[k])
      alt[k] += (sigmaZKm ? sigmaZKm * prng.gauss() : 0) - (classes[cls[k]].settleMps * dtSec) / 1000
      if (alt[k] <= 0) { deposition.add(lat[k], lon[k], classes[cls[k]].depositWeight); kill(k); continue }
      if (lat[k] < domain.latMin || lat[k] > domain.latMax || lon[k] < domain.lonMin || lon[k] > domain.lonMax) kill(k)
    }
    timeMs += Math.round(dtSec * 1000)
  }

  function getFrame() {
    const out = new Float32Array(aliveCount * 4)
    let o = 0
    for (let k = 0; k < N; k++) {
      if (!alive[k]) continue
      out[o++] = lon[k]; out[o++] = lat[k]; out[o++] = alt[k]; out[o++] = (timeMs - bornMs[k]) / 3600e3
    }
    return out
  }

  function saveKeyframe() {
    const lonQ = new Int16Array(N), latQ = new Int16Array(N), altQ = new Uint8Array(N), bornQ = new Uint16Array(N)
    for (let k = 0; k < N; k++) {
      lonQ[k] = Math.round(lon[k] * 100); latQ[k] = Math.round(lat[k] * 100)
      altQ[k] = Math.max(0, Math.min(255, Math.round(alt[k] * 10)))
      bornQ[k] = Math.round((bornMs[k] - startMs) / 600e3)
    }
    return { timeMs, carry, prngState: prng.getState(), lonQ, latQ, altQ, cls: cls.slice(), alive: alive.slice(), bornQ, free: Uint16Array.from(free), deposition: deposition.snapshot() }
  }

  function restoreKeyframe(kf) {
    for (let k = 0; k < N; k++) {
      lon[k] = kf.lonQ[k] / 100; lat[k] = kf.latQ[k] / 100; alt[k] = kf.altQ[k] / 10
      bornMs[k] = startMs + kf.bornQ[k] * 600e3
    }
    cls.set(kf.cls); alive.set(kf.alive)
    free = Array.from(kf.free)
    aliveCount = 0; for (let k = 0; k < N; k++) aliveCount += alive[k]
    timeMs = kf.timeMs; carry = kf.carry; prng.setState(kf.prngState)
    deposition.restore(kf.deposition)
  }

  return {
    get timeMs() { return timeMs }, get aliveCount() { return aliveCount }, maxParticles: N,
    reset, spawn, advance, getFrame, saveKeyframe, restoreKeyframe,
  }
}
