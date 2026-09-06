<script setup>
import { computed, ref } from 'vue'
import { valueAt, scaleLinear, linePath } from '../utils/series.js'
import { formatWibShort, WIB_OFFSET_MS } from '../utils/formatTime.js'

const props = defineProps({
  airQuality: { type: Object, required: true },
  currentTimeMs: { type: Number, required: true },
  startMs: { type: Number, required: true },
  endMs: { type: Number, required: true },
})

// urutan hue tetap per stasiun (jangan di-cycle); divalidasi dengan dataviz validator (dark)
const SERIES_COLORS = ['#1e88d8', '#c8781a', '#8a63d6', '#2f9a3f'] // lolos validator: L 0.48–0.67, CVD ΔE ≥ 23
const W = 360, H = 150, M = { top: 10, right: 58, bottom: 22, left: 34 }
const plotW = W - M.left - M.right, plotH = H - M.top - M.bottom

const stations = computed(() => props.airQuality.stations.map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length], timesMs: s.times.map(t => Date.parse(t)) })))

const yMax = computed(() => {
  let m = 0
  for (const s of stations.value) s.timesMs.forEach((t, k) => { if (t >= props.startMs && t <= props.endMs && s.pm10[k] > m) m = s.pm10[k] })
  return Math.max(50, Math.ceil(m / 50) * 50)
})
const x = computed(() => scaleLinear(props.startMs, props.endMs, M.left, M.left + plotW))
const y = computed(() => scaleLinear(0, yMax.value, M.top + plotH, M.top))

const paths = computed(() => stations.value.map(s => ({
  name: s.name, color: s.color,
  d: linePath(s.timesMs.map((t, k) => (t < props.startMs || t > props.endMs ? null : [x.value(t), y.value(s.pm10[k])]))),
})))

const hoverMs = ref(null)
const cursorMs = computed(() => hoverMs.value ?? props.currentTimeMs)
const cursorX = computed(() => x.value(Math.min(props.endMs, Math.max(props.startMs, cursorMs.value))))
const readings = computed(() => stations.value.map(s => ({ name: s.name, color: s.color, value: valueAt(s.timesMs, s.pm10, cursorMs.value) })))

// label hari di tengah malam WIB
const dayTicks = computed(() => {
  const ticks = []
  const dayMs = 86400e3
  let t = Math.ceil((props.startMs + WIB_OFFSET_MS) / dayMs) * dayMs - WIB_OFFSET_MS
  for (; t <= props.endMs; t += dayMs) ticks.push({ x: x.value(t), label: formatWibShort(t).split(' ')[0] + ' ' + new Date(t + WIB_OFFSET_MS).getUTCDate() })
  return ticks
})
const yTicks = computed(() => [0, yMax.value / 2, yMax.value].map(v => ({ y: y.value(v), label: String(v) })))

function onMove(ev) {
  const rect = ev.currentTarget.getBoundingClientRect()
  const px = ((ev.clientX - rect.left) / rect.width) * W
  const t = props.startMs + ((px - M.left) / plotW) * (props.endMs - props.startMs)
  hoverMs.value = Math.min(props.endMs, Math.max(props.startMs, t))
}
</script>

<template>
  <section class="chart" aria-label="PM10 per kota">
    <header>
      <h4>PM10 di permukaan</h4>
      <span class="unit">µg/m³, model CAMS</span>
    </header>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" @mousemove="onMove" @mouseleave="hoverMs = null">
      <g class="grid">
        <line v-for="t in yTicks" :key="t.label" :x1="M.left" :x2="M.left + plotW" :y1="t.y" :y2="t.y" />
      </g>
      <g class="axis">
        <text v-for="t in yTicks" :key="'y' + t.label" :x="M.left - 6" :y="t.y + 3" text-anchor="end">{{ t.label }}</text>
        <text v-for="t in dayTicks" :key="'d' + t.label" :x="t.x" :y="H - 6" text-anchor="middle">{{ t.label }}</text>
      </g>
      <path v-for="p in paths" :key="p.name" :d="p.d" :stroke="p.color" class="series" />
      <line class="cursor" :x1="cursorX" :x2="cursorX" :y1="M.top" :y2="M.top + plotH" />
      <g class="labels">
        <text v-for="(r, i) in readings" :key="r.name" :x="M.left + plotW + 6" :y="M.top + 10 + i * 13"><tspan :fill="r.color">●</tspan> {{ r.name === 'Bandar Lampung' ? 'B. Lampung' : r.name }}</text>
      </g>
    </svg>
    <ul class="legend">
      <li v-for="r in readings" :key="r.name"><span class="chip" :style="{ background: r.color }"></span>{{ r.name }}<b>{{ r.value == null ? '–' : Math.round(r.value) }}</b></li>
    </ul>
    <p class="when">{{ formatWibShort(cursorMs) }} WIB<span v-if="hoverMs !== null">, arahkan kursor</span></p>
  </section>
</template>

<style scoped>
.chart { position: absolute; left: 16px; bottom: 100px; z-index: 900; width: 360px; padding: 10px 12px 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(8px); color: var(--bone); }
header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
h4 { margin: 0; font-size: 13px; font-weight: 600; }
.unit { font-size: 11px; color: var(--ash); }
svg { display: block; width: 100%; height: auto; margin-top: 4px; cursor: crosshair; }
.grid line { stroke: var(--line); stroke-width: 1; }
.axis text { fill: var(--ash); font-size: 9.5px; font-family: var(--font); }
.series { fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
.cursor { stroke: var(--bone); stroke-width: 1; stroke-dasharray: 2 3; }
.labels text { fill: var(--ash); font-size: 9px; font-family: var(--font); }
.legend { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; font-size: 11.5px; }
.legend li { display: flex; align-items: center; gap: 6px; }
.legend b { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; }
.chip { width: 8px; height: 8px; border-radius: 2px; flex: none; }
.when { margin: 4px 0 0; font-size: 11px; color: var(--ash); }
@media (max-width: 767px) { .chart { display: none; } }
</style>
