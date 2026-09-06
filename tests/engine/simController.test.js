import { describe, it, expect } from 'vitest'
import { createSimController } from '../../src/engine/simController.js'

const START = Date.parse('2026-09-04T00:00:00Z'), END = START + 72 * 3600e3

function fakeSystem() {
  const log = { steps: [], restored: [] }
  let timeMs = 0
  return { log, get timeMs() { return timeMs },
    reset(t) { timeMs = t }, advance(dtSec) { log.steps.push(dtSec); timeMs += dtSec * 1000 },
    saveKeyframe() { return { timeMs } }, restoreKeyframe(kf) { timeMs = kf.timeMs; log.restored.push(kf.timeMs) } }
}

describe('createSimController', () => {
  it('advances in 600 s steps and saves hourly keyframes (including start)', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    expect(c.keyframeCount()).toBe(1)
    c.advanceTo(START + 2 * 3600e3)
    expect(system.log.steps).toHaveLength(12)
    expect(system.log.steps.every(s => s === 600)).toBe(true)
    expect(c.keyframeCount()).toBe(3)
    expect(c.timeMs).toBe(START + 2 * 3600e3)
  })
  it('never steps across a keyframe boundary', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.advanceTo(START + 250e3)
    c.advanceTo(START + 3600e3 + 100e3)
    expect(system.log.steps).toEqual([250, 600, 600, 600, 600, 600, 350, 100])
    expect(c.keyframeCount()).toBe(2)
  })
  it('seeks backwards by restoring the latest keyframe at or before target', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.advanceTo(START + 3 * 3600e3)
    system.log.steps.length = 0
    c.seekTo(START + 90 * 60e3) // 1h30 → restore 1h, maju 3 langkah
    expect(system.log.restored).toEqual([START + 3600e3])
    expect(system.log.steps).toEqual([600, 600, 600])
    expect(c.timeMs).toBe(START + 90 * 60e3)
  })
  it('seeks forward without restoring and clamps to the time range', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.seekTo(START + 600e3)
    expect(system.log.restored).toEqual([])
    c.seekTo(START - 5e3); expect(c.timeMs).toBe(START)
    c.seekTo(END + 5e3); expect(c.timeMs).toBe(END)
  })
})
