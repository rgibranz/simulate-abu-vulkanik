<script setup>
import { simConfig } from '../config/simConfig.js'
defineProps({ layers: { type: Object, required: true } })
const levels = simConfig.levels
const rows = [
  ['lowAsh', 'Low ash (0–6 km)'], ['highAsh', 'High ash (6–16 km)'], ['ashfall', 'Ashfall'],
  ['vaac', 'VAAC polygons'], ['wind', 'Wind arrows'], ['provinces', 'Provinces'], ['places', 'Places'],
]
</script>

<template>
  <section class="panel">
    <h4>Layers</h4>
    <label v-for="[key, label] in rows" :key="key" class="row">
      <input type="checkbox" v-model="layers[key]" /> {{ label }}
    </label>
    <label class="row indent" v-if="layers.wind">
      Level
      <select v-model.number="layers.windLevel">
        <option v-for="(lv, i) in levels" :key="lv.name" :value="i">{{ lv.name }} · {{ lv.altKm }} km</option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.panel h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #9aa3b2; }
.row { display: flex; gap: 8px; align-items: center; font-size: 13px; padding: 3px 0; cursor: pointer; }
.row.indent { padding-left: 22px; }
select { background: #161b24; color: #e6e9ef; border: 1px solid rgba(255,255,255,.15); border-radius: 4px; padding: 2px 4px; }
</style>
