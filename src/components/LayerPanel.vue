<script setup>
import { simConfig } from '../config/simConfig.js'
import { WIND_MODELS } from '../composables/useDatasets.js'
defineProps({ layers: { type: Object, required: true } })
const levels = simConfig.levels
const rows = [
  ['lowAsh', 'Abu rendah, 0–6 km'], ['highAsh', 'Abu tinggi, 6–16 km'], ['ashfall', 'Endapan abu di darat'],
  ['vaac', 'Poligon abu VAAC'], ['vaacForecast', 'Prakiraan VAAC +6/+12/+18 jam'], ['wind', 'Panah angin'],
  ['provinces', 'Batas provinsi'], ['places', 'Kota dan bandara'], ['pm10', 'Grafik PM10 (CAMS)'],
  ['satellite', 'Citra satelit Himawari-9'],
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
    <h4 class="sub">Model angin penggerak</h4>
    <label class="row">
      <select v-model="layers.windModel" aria-label="Model angin">
        <option v-for="m in WIND_MODELS" :key="m.key" :value="m.key">{{ m.label }}</option>
      </select>
    </label>
    <p class="hint">Ganti model = simulasi dihitung ulang dari awal sampai waktu sekarang.</p>
  </section>
</template>

<style scoped>
.panel h4 { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--bone); }
.row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--bone); padding: 3px 0; cursor: pointer; }
.row input { accent-color: var(--ash); margin: 0; }
.row.indent { padding-left: 22px; color: var(--ash); }
select { flex: 1; background: var(--smoke); color: var(--bone); border: 1px solid var(--line); border-radius: 4px; padding: 3px 6px; font-size: 12px; }
.panel h4.sub { margin-top: 12px; }
.hint { margin: 4px 0 0; font-size: 11px; color: var(--ash); line-height: 1.4; }
</style>
