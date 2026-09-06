<script setup>
import { simConfig } from '../config/simConfig.js'
defineProps({ layers: { type: Object, required: true } })
const levels = simConfig.levels
const rows = [
  ['lowAsh', 'Abu rendah, 0–6 km'], ['highAsh', 'Abu tinggi, 6–16 km'], ['ashfall', 'Endapan abu di darat'],
  ['vaac', 'Poligon abu VAAC'], ['wind', 'Panah angin'], ['provinces', 'Batas provinsi'], ['places', 'Kota dan bandara'],
]
</script>

<template>
  <section class="panel">
    <h4>Tampilkan di peta</h4>
    <label v-for="[key, label] in rows" :key="key" class="row">
      <input type="checkbox" v-model="layers[key]" /> {{ label }}
    </label>
    <label class="row indent" v-if="layers.wind">
      Level angin
      <select v-model.number="layers.windLevel">
        <option v-for="(lv, i) in levels" :key="lv.name" :value="i">{{ lv.name }}, {{ lv.altKm }} km</option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.panel h4 { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--bone); }
.row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--bone); padding: 3px 0; cursor: pointer; }
.row input { accent-color: var(--ash); margin: 0; }
.row.indent { padding-left: 22px; color: var(--ash); }
select { flex: 1; background: var(--smoke); color: var(--bone); border: 1px solid var(--line); border-radius: 4px; padding: 3px 6px; font-size: 12px; }
</style>
