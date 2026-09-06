<script setup>
import { onMounted, ref, watch } from 'vue'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { useLayers } from './composables/useLayers.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventCard from './components/EventCard.vue'
import LayerPanel from './components/LayerPanel.vue'
import Legend from './components/Legend.vue'
import AboutPanel from './components/AboutPanel.vue'

const INITIAL_UTC = '2026-09-04T16:00:00Z' // sesaat sebelum erupsi besar (spec §6)
const datasets = useDatasets()
const simulation = useSimulation()
const layers = useLayers()
const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)
const sideCollapsed = ref(window.innerWidth < 768)
const aboutOpen = ref(false)

onMounted(() => datasets.load())
watch(() => datasets.status.value, (s) => { if (s === 'ready') simulation.init(datasets.data.value, simConfig) })
watch(() => simulation.status.value, (s) => { if (s === 'ready') simulation.seek(Date.parse(INITIAL_UTC)) })

function reload() { window.location.reload() }
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="title">
        <h1>Anak Krakatau ash dispersion <span class="dates">4–6 September 2026</span></h1>
        <p>Ash particles carried by Open-Meteo winds, replayed against Darwin VAAC advisories.</p>
      </div>
      <button class="about" @click="aboutOpen = true">About</button>
    </header>

    <div v-if="datasets.status.value !== 'ready'" class="overlay">
      <template v-if="datasets.status.value === 'error'">
        <p class="err">Couldn't load the simulation data: {{ datasets.error.value }}</p>
        <button class="primary" @click="datasets.load()">Try again</button>
      </template>
      <p v-else>Loading wind and advisory data…</p>
    </div>

    <template v-else>
      <MapView :datasets="datasets.data.value" :simulation="simulation" :layers="layers" />
      <EventCard :events="datasets.data.value.events.events" :current-time-ms="simulation.currentTimeMs.value" />
      <aside class="side" :class="{ collapsed: sideCollapsed }">
        <button class="collapse" :aria-label="sideCollapsed ? 'Show layers' : 'Hide layers'" @click="sideCollapsed = !sideCollapsed">{{ sideCollapsed ? 'Layers' : '✕' }}</button>
        <div v-show="!sideCollapsed"><LayerPanel :layers="layers" /><Legend /></div>
      </aside>
      <div v-if="simulation.status.value === 'error'" class="banner">
        The simulation stopped: {{ simulation.error.value }} <button class="primary" @click="reload">Reload</button>
      </div>
      <TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" />
    </template>

    <AboutPanel :open="aboutOpen" @close="aboutOpen = false" />
  </div>
</template>

<style>
/* token warna & tipografi global (dipakai semua komponen) */
:root {
  --ink: #1b1a19;
  --smoke: #2b2925;
  --ash: #b9b1a6;
  --bone: #efe9df;
  --ember: #ff5a3c;
  --ashfall: #d69630;
  --sky: #7fd1ff;
  --panel: rgba(27, 26, 25, 0.86);
  --line: rgba(239, 233, 223, 0.12);
  --font: 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
body { margin: 0; font-family: var(--font); }
button, select, input { font-family: inherit; }
button:focus-visible, select:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>

<style scoped>
.app { position: fixed; inset: 0; color: var(--bone); background: var(--ink); font-family: var(--font); }
.header { position: absolute; left: 16px; top: 14px; right: 16px; z-index: 1000; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
.header > * { pointer-events: auto; }
.title { max-width: 560px; }
h1 { margin: 0; font-size: 22px; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; text-shadow: 0 1px 10px rgba(0, 0, 0, 0.9); }
.dates { display: block; font-size: 15px; font-weight: 500; color: var(--ash); font-variant-numeric: tabular-nums; }
.header p { margin: 6px 0 0; font-size: 13px; color: var(--ash); max-width: 46ch; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9); }
.about { background: var(--panel); border: 1px solid var(--line); color: var(--bone); border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
.about:hover { border-color: var(--ash); }
.overlay { position: absolute; inset: 0; display: grid; place-content: center; gap: 12px; text-align: center; color: var(--ash); }
.primary { background: var(--ember); color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.err { color: #ff8a73; max-width: 48ch; }
.side { position: absolute; right: 16px; top: 96px; z-index: 1000; width: 256px; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(8px); }
.side.collapsed { width: auto; padding: 0; border: none; background: none; }
.collapse { float: right; background: none; border: none; color: var(--ash); cursor: pointer; font-size: 13px; padding: 0 0 6px 8px; }
.side.collapsed .collapse { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 12px; float: none; color: var(--bone); }
.banner { position: absolute; left: 16px; right: 16px; bottom: 96px; z-index: 1100; padding: 10px 14px; background: #4a1d17; border: 1px solid #a3402f; border-radius: 6px; display: flex; gap: 12px; align-items: center; font-size: 13px; }
@media (max-width: 767px) {
  h1 { font-size: 17px; } .dates { font-size: 13px; } .header p { display: none; }
  .side { top: auto; bottom: 170px; right: 12px; max-height: 42vh; overflow: auto; width: 230px; }
  .side.collapsed { width: auto; right: auto; left: 12px; } /* kiri, biar nggak nabrak kontrol zoom */
}
</style>
