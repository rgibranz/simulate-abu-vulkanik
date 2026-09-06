import { ref, markRaw } from 'vue'

function defaultCreateWorker() {
  return new Worker(new URL('../engine/simWorker.js', import.meta.url), { type: 'module' })
}

// Pemilik worker simulasi. Frame besar disimpan non-reaktif, cuma waktu/count yang jadi ref.
export function useSimulation({ createWorker = defaultCreateWorker } = {}) {
  const status = ref('idle'), error = ref(null)
  const currentTimeMs = ref(0), playing = ref(false), speed = ref(1), seeking = ref(false), aliveCount = ref(0)
  let worker = null, latestFrame = null, lastUiUpdate = 0
  const handlers = new Set()

  function handleMessage({ data: msg }) {
    switch (msg.type) {
      case 'ready': status.value = 'ready'; currentTimeMs.value = msg.tMs; break
      case 'frame': {
        latestFrame = markRaw(msg); seeking.value = false
        const now = performance.now()
        if (!playing.value || now - lastUiUpdate >= 100) { currentTimeMs.value = msg.tMs; aliveCount.value = msg.count; lastUiUpdate = now }
        for (const h of handlers) h(msg)
        break
      }
      case 'seeking': seeking.value = true; break
      case 'ended': playing.value = false; break
      case 'error': error.value = msg.message; status.value = 'error'; playing.value = false; break
    }
  }

  function init(datasets, config) {
    worker = createWorker()
    worker.onmessage = handleMessage
    worker.onerror = (e) => { error.value = e.message || 'Worker crashed'; status.value = 'error'; playing.value = false }
    status.value = 'loading'
    worker.postMessage({ type: 'init', datasets: { wind: datasets.wind, vaac: datasets.vaac, eruptionSource: datasets.eruptionSource }, config })
  }
  function play() { worker.postMessage({ type: 'play', speed: speed.value }); playing.value = true }
  function pause() { worker.postMessage({ type: 'pause' }); playing.value = false }
  function seek(tMs) { worker.postMessage({ type: 'seek', tMs }); currentTimeMs.value = tMs }
  function setSpeed(s) { speed.value = s; worker.postMessage({ type: 'setSpeed', speed: s }) }
  function onFrame(handler) { handlers.add(handler); return () => handlers.delete(handler) }
  function dispose() { worker?.terminate(); worker = null }

  return { status, error, currentTimeMs, playing, speed, seeking, aliveCount, init, play, pause, seek, setSpeed, onFrame, getLatestFrame: () => latestFrame, dispose }
}
