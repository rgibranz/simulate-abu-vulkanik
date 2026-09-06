<script setup>
import { onMounted, watch } from 'vue'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'

const datasets = useDatasets()
const simulation = useSimulation()

onMounted(() => datasets.load())
watch(() => datasets.status.value, (s) => { if (s === 'ready') simulation.init(datasets.data.value, simConfig) })

function toggle() { simulation.playing.value ? simulation.pause() : simulation.play() }
</script>

<template>
  <div class="app">
    <div v-if="datasets.status.value !== 'ready'" class="overlay">
      <p v-if="datasets.status.value === 'error'">Failed to load data: {{ datasets.error.value }}</p>
      <p v-else>Loading data…</p>
    </div>
    <template v-else>
      <MapView :datasets="datasets.data.value" :simulation="simulation" />
      <div class="debug">
        <button :disabled="simulation.status.value !== 'ready'" @click="toggle">{{ simulation.playing.value ? 'Pause' : 'Play' }}</button>
        <span>{{ new Date(simulation.currentTimeMs.value).toISOString() }} · {{ simulation.aliveCount.value }} particles</span>
        <span v-if="simulation.error.value" class="err">{{ simulation.error.value }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.app { position: fixed; inset: 0; font-family: system-ui, sans-serif; color: #e6e9ef; background: #0b0e13; }
.overlay { position: absolute; inset: 0; display: grid; place-items: center; }
.debug { position: absolute; left: 12px; bottom: 12px; z-index: 1000; display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,.6); padding: 8px 12px; border-radius: 6px; }
.err { color: #ff6b6b; }
</style>
