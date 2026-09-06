import { createWindField } from './windField.js'
import { createEruptionSource } from './eruptionSource.js'
import { createVaacAdvisories } from './vaacAdvisories.js'
import { createDepositionGrid } from './deposition.js'
import { createPrng } from './prng.js'
import { createParticleSystem } from './particleSystem.js'
import { createSimController } from './simController.js'

const TICK_MS = 33
let system, controller, deposition
let playing = false, speed = 1, timer = null, lastTick = 0, lastDepositionMs = -Infinity

function post(msg, transfer) { self.postMessage(msg, transfer) }
function fail(err) { pause(); post({ type: 'error', message: String(err?.message ?? err) }) }

function init({ datasets, config }) {
  const windField = createWindField(datasets.wind)
  const eruptionSource = createEruptionSource(datasets.eruptionSource.series, config.emission)
  const vaacAdvisories = createVaacAdvisories(datasets.vaac)
  deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
  system = createParticleSystem({ config, windField, eruptionSource, vaacAdvisories, deposition, prng: createPrng(config.seed) })
  controller = createSimController({ system, startMs: Date.parse(config.startUtc), endMs: Date.parse(config.endUtc), stepSec: config.stepSec, keyframeSec: config.keyframeSec })
  post({ type: 'ready', tMs: controller.timeMs })
  postFrame(true)
}

function postFrame(withDeposition) {
  const positions = system.getFrame()
  const msg = { type: 'frame', tMs: controller.timeMs, count: system.aliveCount, positions }
  const transfer = [positions.buffer]
  if (withDeposition) {
    msg.deposition = deposition.snapshot(); msg.depositionMax = deposition.max()
    transfer.push(msg.deposition.buffer); lastDepositionMs = controller.timeMs
  }
  post(msg, transfer)
}

function tick() {
  try {
    const now = performance.now(), dtReal = (now - lastTick) / 1000; lastTick = now
    controller.advanceTo(controller.timeMs + dtReal * speed * 3600e3)
    postFrame(controller.timeMs - lastDepositionMs >= 3600e3)
    if (controller.timeMs >= controller.endMs) { pause(); post({ type: 'ended' }) }
  } catch (err) { fail(err) }
}

function play(s) {
  if (s) speed = s
  if (playing) return
  playing = true; lastTick = performance.now(); timer = setInterval(tick, TICK_MS)
}
function pause() { playing = false; if (timer) clearInterval(timer); timer = null }
function seek(tMs) { post({ type: 'seeking', tMs }); controller.seekTo(tMs); postFrame(true) }

self.onmessage = ({ data: msg }) => {
  try {
    switch (msg.type) {
      case 'init': init(msg); break
      case 'play': play(msg.speed); break
      case 'pause': pause(); break
      case 'seek': seek(msg.tMs); break
      case 'setSpeed': speed = msg.speed; break
      default: throw new Error(`Unknown message: ${msg.type}`)
    }
  } catch (err) { fail(err) }
}
