<script setup>
import { onMounted, watch } from 'vue'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'

const datasets = useDatasets()
const simulation = useSimulation()
const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)

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
      <MapView :datasets="datasets.data.value" :simulation="simulation" />
      <TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" />
      <div v-if="simulation.error.value" class="err">{{ simulation.error.value }}</div>
    </template>
  </div>
</template>

<style scoped>
.app { position: fixed; inset: 0; font-family: system-ui, sans-serif; color: #e6e9ef; background: #0b0e13; }
.overlay { position: absolute; inset: 0; display: grid; place-items: center; }
.err { position: absolute; left: 12px; bottom: 88px; z-index: 1000; color: #ff6b6b; background: rgba(0,0,0,.7); padding: 6px 10px; border-radius: 6px; }
</style>
