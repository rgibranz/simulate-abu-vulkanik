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

const datasets = useDatasets()
const simulation = useSimulation()
const layers = useLayers()
const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)
const sideCollapsed = ref(false)

onMounted(() => datasets.load())
watch(() => datasets.status.value, (s) => { if (s === 'ready') simulation.init(datasets.data.value, simConfig) })
</script>

<template>
  <div class="app">
    <div v-if="datasets.status.value !== 'ready'" class="overlay">
      <p v-if="datasets.status.value === 'error'">Failed to load data: {{ datasets.error.value }}</p>
      <p v-else>Loading data…</p>
    </div>
    <template v-else>
      <MapView :datasets="datasets.data.value" :simulation="simulation" :layers="layers" />
      <EventCard :events="datasets.data.value.events.events" :current-time-ms="simulation.currentTimeMs.value" />
      <aside class="side" :class="{ collapsed: sideCollapsed }">
        <button class="collapse" @click="sideCollapsed = !sideCollapsed">{{ sideCollapsed ? '◀' : '▶' }}</button>
        <div v-show="!sideCollapsed"><LayerPanel :layers="layers" /><Legend /></div>
      </aside>
      <TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" />
      <div v-if="simulation.error.value" class="err">{{ simulation.error.value }}</div>
    </template>
  </div>
</template>

<style scoped>
.app { position: fixed; inset: 0; font-family: system-ui, sans-serif; color: #e6e9ef; background: #0b0e13; }
.overlay { position: absolute; inset: 0; display: grid; place-items: center; }
.side { position: absolute; right: 12px; top: 84px; z-index: 1000; width: 250px; padding: 12px; background: rgba(12,15,21,.88); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; }
.side.collapsed { width: auto; }
.collapse { float: right; background: none; border: none; color: #9aa3b2; cursor: pointer; }
.err { position: absolute; left: 12px; bottom: 88px; z-index: 1000; color: #ff6b6b; background: rgba(0,0,0,.7); padding: 6px 10px; border-radius: 6px; }
</style>
