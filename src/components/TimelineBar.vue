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
    <button class="play" :disabled="simulation.status.value !== 'ready'" :aria-label="simulation.playing.value ? 'Jeda' : 'Putar'" @click="toggle">
      {{ simulation.playing.value ? '❚❚' : '▶' }}
    </button>
    <div class="speeds" role="group" aria-label="Kecepatan putar">
      <button v-for="s in SPEEDS" :key="s" :class="{ active: simulation.speed.value === s }" @click="simulation.setSpeed(s)">{{ s }}×</button>
    </div>
    <div class="track">
      <div class="ticks">
        <button v-for="e in ticks" :key="e.id" class="tick" :class="e.kind" :style="{ left: e.pct + '%' }" :title="`${formatWibShort(e.tMs)} — ${e.title}`" @click="simulation.seek(e.tMs)">{{ e.icon }}</button>
      </div>
      <input type="range" min="0" :max="maxStep" step="1" :value="sliderValue" aria-label="Waktu simulasi" @input="onInput" />
    </div>
    <div class="clock">
      <div class="wib">{{ formatWib(simulation.currentTimeMs.value) }}</div>
      <div class="utc">{{ formatUtc(simulation.currentTimeMs.value) }}, {{ simulation.aliveCount.value.toLocaleString('id-ID') }} partikel di udara<span v-if="simulation.seeking.value">, memuat…</span></div>
    </div>
  </div>
</template>

<style scoped>
.timeline { position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 1000; display: flex; gap: 14px; align-items: center; padding: 12px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; backdrop-filter: blur(8px); }
.play { flex: none; width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--ember); color: #fff; font-size: 15px; cursor: pointer; box-shadow: 0 0 0 0 rgba(255, 90, 60, 0.4); transition: box-shadow .2s; }
.play:hover:not(:disabled) { box-shadow: 0 0 0 6px rgba(255, 90, 60, 0.18); }
.play:disabled { opacity: .35; cursor: default; }
.speeds { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 6px; }
.speeds button { background: transparent; border: none; color: var(--ash); border-radius: 4px; padding: 3px 8px; font-size: 12px; font-variant-numeric: tabular-nums; cursor: pointer; }
.speeds button.active { background: var(--bone); color: var(--ink); font-weight: 600; }
.track { flex: 1; position: relative; padding-top: 18px; }
.track input { width: 100%; margin: 0; accent-color: var(--ember); }
.ticks { position: absolute; left: 0; right: 0; top: 0; height: 16px; }
.tick { position: absolute; transform: translateX(-50%); background: none; border: none; color: var(--ash); font-size: 10px; cursor: pointer; padding: 0; line-height: 16px; }
.tick.eruption { color: var(--ember); } .tick.ashfall { color: var(--ashfall); } .tick.aviation { color: #ffd166; } .tick.advisory { color: var(--sky); }
.clock { min-width: 230px; text-align: right; }
.wib { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.utc { font-size: 12px; color: var(--ash); font-variant-numeric: tabular-nums; }
@media (max-width: 767px) { .timeline { flex-wrap: wrap; gap: 10px; padding: 10px 12px; } .track { order: 3; flex-basis: 100%; } .clock { min-width: 0; flex: 1; text-align: right; } }
</style>
