// Pengatur waktu: maju bertahap (≤ stepSec), keyframe tiap keyframeSec, seek mundur via keyframe
export function createSimController({ system, startMs, endMs, stepSec, keyframeSec }) {
  const kfMs = keyframeSec * 1000, stepMs = stepSec * 1000
  const keyframes = new Map()
  system.reset(startMs)
  keyframes.set(startMs, system.saveKeyframe())

  function saveIfBoundary() {
    const t = system.timeMs
    if ((t - startMs) % kfMs === 0 && !keyframes.has(t)) keyframes.set(t, system.saveKeyframe())
  }

  function advanceTo(targetMs) {
    targetMs = Math.min(endMs, Math.round(targetMs))
    while (system.timeMs < targetMs) {
      const nextKf = startMs + (Math.floor((system.timeMs - startMs) / kfMs) + 1) * kfMs
      const dtMs = Math.min(stepMs, targetMs - system.timeMs, nextKf - system.timeMs)
      system.advance(dtMs / 1000)
      saveIfBoundary()
    }
  }

  function seekTo(targetMs) {
    targetMs = Math.max(startMs, Math.min(endMs, Math.round(targetMs)))
    if (targetMs < system.timeMs) {
      let best = startMs
      for (const t of keyframes.keys()) if (t <= targetMs && t > best) best = t
      system.restoreKeyframe(keyframes.get(best))
    }
    advanceTo(targetMs)
  }

  return { get timeMs() { return system.timeMs }, startMs, endMs, advanceTo, seekTo, keyframeCount: () => keyframes.size }
}
