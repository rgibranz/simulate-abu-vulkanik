<script setup>
import { computed } from 'vue'
import { formatWib, formatUtc, formatWibShort } from '../utils/formatTime.js'

const props = defineProps({
  simulation: { type: Object, required: true },
  startMs: { type: Number, required: true },
  endMs: { type: Number, required: true },
  events: { type: Array, default: () => [] },
})
const STEP_MS = 600e3
const SPEEDS = [0.5, 1, 2, 4]
const KIND_ICON = { eruption: '▲', advisory: '◆', ashfall: '●', aviation: '✈', report: '■' }

const maxStep = computed(() => Math.round((props.endMs - props.startMs) / STEP_MS))
const sliderValue = computed(() => Math.round((props.simulation.currentTimeMs.value - props.startMs) / STEP_MS))
const ticks = computed(() => props.events.map(e => {
  const t = Date.parse(e.timeUtc)
  return { ...e, tMs: t, pct: ((t - props.startMs) / (props.endMs - props.startMs)) * 100, icon: KIND_ICON[e.kind] ?? '•' }
}).filter(e => e.pct >= 0 && e.pct <= 100))

let seekTimer = null
function onInput(ev) {
  const t = props.startMs + Number(ev.target.value) * STEP_MS
  // throttle biar worker nggak kebanjiran seek saat slider di-drag
  if (seekTimer) return
  seekTimer = setTimeout(() => { seekTimer = null }, 60)
  props.simulation.seek(t)
}
function toggle() { props.simulation.playing.value ? props.simulation.pause() : props.simulation.play() }
</script>

<template>
  <div class="timeline">
    <button class="play" :disabled="simulation.status.value !== 'ready'" :aria-label="simulation.playing.value ? 'Pause' : 'Play'" @click="toggle">
      {{ simulation.playing.value ? '❚❚' : '▶' }}
    </button>
    <div class="speeds">
      <button v-for="s in SPEEDS" :key="s" :class="{ active: simulation.speed.value === s }" @click="simulation.setSpeed(s)">{{ s }}×</button>
    </div>
    <div class="track">
      <div class="ticks">
        <button v-for="e in ticks" :key="e.id" class="tick" :class="e.kind" :style="{ left: e.pct + '%' }" :title="`${formatWibShort(e.tMs)} — ${e.title}`" @click="simulation.seek(e.tMs)">{{ e.icon }}</button>
      </div>
      <input type="range" min="0" :max="maxStep" step="1" :value="sliderValue" @input="onInput" />
    </div>
    <div class="clock">
      <div class="wib">{{ formatWib(simulation.currentTimeMs.value) }}</div>
      <div class="utc">{{ formatUtc(simulation.currentTimeMs.value) }} · {{ simulation.aliveCount.value.toLocaleString() }} particles<span v-if="simulation.seeking.value"> · seeking…</span></div>
    </div>
  </div>
</template>

<style scoped>
.timeline { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 1000; display: flex; gap: 12px; align-items: center; padding: 10px 14px; background: rgba(12, 15, 21, .85); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; backdrop-filter: blur(6px); }
.play { width: 40px; height: 40px; border-radius: 50%; border: none; background: #ff5a3c; color: #fff; font-size: 14px; cursor: pointer; }
.play:disabled { opacity: .4; cursor: default; }
.speeds { display: flex; gap: 4px; }
.speeds button { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #cfd5df; border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
.speeds button.active { background: #cfd5df; color: #0b0e13; }
.track { flex: 1; position: relative; padding-top: 18px; }
.track input { width: 100%; margin: 0; accent-color: #ff5a3c; }
.ticks { position: absolute; left: 0; right: 0; top: 0; height: 16px; }
.tick { position: absolute; transform: translateX(-50%); background: none; border: none; color: #9aa3b2; font-size: 10px; cursor: pointer; padding: 0; }
.tick.eruption { color: #ff5a3c; } .tick.ashfall { color: #d69630; } .tick.aviation { color: #ffd166; } .tick.advisory { color: #7fd1ff; }
.clock { min-width: 220px; text-align: right; }
.wib { font-size: 15px; font-variant-numeric: tabular-nums; }
.utc { font-size: 11px; color: #9aa3b2; }
@media (max-width: 767px) { .timeline { flex-wrap: wrap; gap: 8px; } .clock { min-width: 0; width: 100%; text-align: left; } }
</style>
