// Jalankan engine headless, ukur fraksi partikel di dalam poligon VAAC pada tiap waktu observasi (spec §8)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { simConfig } from '../src/config/simConfig.js'
import { createWindField } from '../src/engine/windField.js'
import { createEruptionSource } from '../src/engine/eruptionSource.js'
import { createVaacAdvisories } from '../src/engine/vaacAdvisories.js'
import { createDepositionGrid } from '../src/engine/deposition.js'
import { createPrng } from '../src/engine/prng.js'
import { createParticleSystem } from '../src/engine/particleSystem.js'
import { createSimController } from '../src/engine/simController.js'
import { pointInPolygon, metersPerDegLon, M_PER_DEG_LAT } from '../src/engine/geo.js'
import { formatWib } from '../src/utils/formatTime.js'

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, k === 'wind' ? v : Number(v)] }))
const WIND_FILE = args.wind && args.wind !== 'best' ? `wind-${args.wind}.json` : 'wind.json' // --wind=ecmwf|gfs|icon
const config = {
  ...simConfig,
  seed: args.seed ?? simConfig.seed,
  vaacNudge: args.nudge ?? simConfig.vaacNudge,
  diffusion: { ...simConfig.diffusion, horizontalM2s: args.kh ?? simConfig.diffusion.horizontalM2s },
  emission: { ...simConfig.emission, umbrellaFactor: args.umbrella ?? simConfig.emission.umbrellaFactor, umbrellaFraction: args.umbrellaFraction ?? simConfig.emission.umbrellaFraction },
}
const NEAR_KM = args.near ?? 30
const ROOT = resolve(import.meta.dirname, '..')
const load = (f) => JSON.parse(readFileSync(resolve(ROOT, 'public/data', f), 'utf8'))

const windField = createWindField(load(WIND_FILE))
const vaac = createVaacAdvisories(load('vaac.json'))
const eruptionSource = createEruptionSource(load('eruption-source.json').series, config.emission)
const deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
const system = createParticleSystem({ config, windField, eruptionSource, vaacAdvisories: vaac, deposition, prng: createPrng(config.seed) })
const controller = createSimController({ system, startMs: Date.parse(config.startUtc), endMs: Date.parse(config.endUtc), stepSec: config.stepSec, keyframeSec: config.keyframeSec })

const JAKARTA = { lat: -6.2, lon: 106.85 }
let firstJakartaMs = null
// jumlah partikel rendah dalam radius NEAR_KM dari Jakarta
function countNearJakarta() {
  const f = system.getFrame()
  let n = 0
  for (let i = 0; i < f.length; i += 4) {
    if (f[i + 2] > config.lowLayerTopKm) continue
    const dx = (f[i] - JAKARTA.lon) * metersPerDegLon(JAKARTA.lat), dy = (f[i + 1] - JAKARTA.lat) * M_PER_DEG_LAT
    if (Math.hypot(dx, dy) < NEAR_KM * 1000) n++
  }
  return n
}
function checkJakarta() {
  if (countNearJakarta() > 0) { firstJakartaMs = controller.timeMs; return true }
  return false
}

console.log(`wind=${WIND_FILE} nudge=${config.vaacNudge} kh=${config.diffusion.horizontalM2s} umbrella=${config.emission.umbrellaFactor} umbrellaFraction=${config.emission.umbrellaFraction} seed=${config.seed}`)
console.log('nr        | obs (WIB)              | low in/total (frac) | high in/total (frac) | alive | low near JKT')
const scores = []
for (const a of vaac.all) {
  if (a.obsMs < controller.startMs || a.obsMs > controller.endMs) continue
  // maju per jam supaya bisa cek Jakarta di sepanjang jalan
  while (controller.timeMs < a.obsMs) { controller.advanceTo(Math.min(a.obsMs, controller.timeMs + 3600e3)); if (!firstJakartaMs) checkJakarta() }
  const f = system.getFrame()
  let lowIn = 0, lowTot = 0, highIn = 0, highTot = 0
  for (let i = 0; i < f.length; i += 4) {
    const alt = f[i + 2], layer = vaac.layerForAltitude(a, alt)
    const inside = pointInPolygon(f[i + 1], f[i], layer.polygon)
    if (alt <= config.lowLayerTopKm) { lowTot++; if (inside) lowIn++ } else { highTot++; if (inside) highIn++ }
  }
  const lf = lowTot ? lowIn / lowTot : 0, hf = highTot ? highIn / highTot : 0
  scores.push({ nr: a.nr, lf, hf })
  console.log(`${a.nr.padEnd(9)} | ${formatWib(a.obsMs).padEnd(22)} | ${String(lowIn).padStart(5)}/${String(lowTot).padEnd(5)} (${lf.toFixed(2)}) | ${String(highIn).padStart(5)}/${String(highTot).padEnd(5)} (${hf.toFixed(2)}) | ${String(system.aliveCount).padStart(5)} | ${countNearJakarta()}`)
}
// lanjut sampai akhir buat cek Jakarta di fase setelah advisory terakhir
while (controller.timeMs < controller.endMs && !firstJakartaMs) { controller.advanceTo(controller.timeMs + 3600e3); checkJakarta() }
console.log(`first low-level ash within ${NEAR_KM} km of Jakarta: ${firstJakartaMs ? formatWib(firstJakartaMs) : 'never'}`)
const target = scores.filter(s => ['2026/175', '2026/179', '2026/183', '2026/184'].includes(s.nr))
const pass = target.every(s => s.lf >= 0.5)
console.log(`target (low ≥ 0.5 on 175/179/183/184): ${pass ? 'PASS' : 'FAIL'}`)
