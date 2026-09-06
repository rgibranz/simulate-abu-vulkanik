import { describe, it, expect, vi } from 'vitest'
import { useSimulation } from '../../src/composables/useSimulation.js'

function fakeWorker() {
  const w = { posted: [], onmessage: null, onerror: null, terminated: false,
    postMessage(m) { w.posted.push(m) }, terminate() { w.terminated = true },
    emit(msg) { w.onmessage({ data: msg }) } }
  return w
}
const datasets = { wind: { w: 1 }, vaac: [], eruptionSource: { series: [] }, events: {}, places: {}, provinces: {} }
const config = { seed: 1 }

describe('useSimulation', () => {
  it('init posts only the datasets the worker needs and becomes ready', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w })
    sim.init(datasets, config)
    expect(sim.status.value).toBe('loading')
    expect(w.posted[0]).toEqual({ type: 'init', datasets: { wind: { w: 1 }, vaac: [], eruptionSource: { series: [] } }, config })
    w.emit({ type: 'ready', tMs: 123 })
    expect(sim.status.value).toBe('ready'); expect(sim.currentTimeMs.value).toBe(123)
  })
  it('dispatches frames to handlers and updates time/count', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config)
    const handler = vi.fn(); const off = sim.onFrame(handler)
    const frame = { type: 'frame', tMs: 5000, count: 2, positions: new Float32Array(8) }
    w.emit(frame)
    expect(handler).toHaveBeenCalledWith(frame)
    expect(sim.currentTimeMs.value).toBe(5000); expect(sim.aliveCount.value).toBe(2)
    expect(sim.getLatestFrame()).toBe(frame)
    off(); w.emit({ ...frame, tMs: 6000 }); expect(handler).toHaveBeenCalledTimes(1)
  })
  it('play/pause/seek/setSpeed post messages and track state', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config); w.posted.length = 0
    sim.setSpeed(2); sim.play(); sim.seek(999); sim.pause()
    expect(w.posted).toEqual([{ type: 'setSpeed', speed: 2 }, { type: 'play', speed: 2 }, { type: 'seek', tMs: 999 }, { type: 'pause' }])
    expect(sim.speed.value).toBe(2); expect(sim.playing.value).toBe(false); expect(sim.currentTimeMs.value).toBe(999)
    w.emit({ type: 'seeking', tMs: 999 }); expect(sim.seeking.value).toBe(true)
    w.emit({ type: 'frame', tMs: 999, count: 0, positions: new Float32Array(0) }); expect(sim.seeking.value).toBe(false)
  })
  it('handles ended and error', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config)
    sim.play(); w.emit({ type: 'ended' }); expect(sim.playing.value).toBe(false)
    w.emit({ type: 'error', message: 'boom' }); expect(sim.status.value).toBe('error'); expect(sim.error.value).toBe('boom')
    sim.dispose(); expect(w.terminated).toBe(true)
  })
})
