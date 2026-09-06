<script setup>
import { computed } from 'vue'
import { uvToHeading, compassName } from '../utils/mapInfo.js'

const props = defineProps({
  windField: { type: Object, required: true },
  currentTimeMs: { type: Number, required: true },
  vent: { type: Object, required: true },
})

// angin di atas kawah per level, dari tinggi ke rendah
const rows = computed(() => {
  const wf = props.windField
  const t = Math.min(Math.max(props.currentTimeMs, wf.timeStartMs), wf.timeEndMs)
  return [...wf.levels].reverse().map(level => {
    const w = wf.sample(props.vent.lat, props.vent.lon, level.altKm, t)
    if (!w) return { ...level, speedKmh: null }
    const h = uvToHeading(w.u, w.v)
    return { ...level, toDeg: h.toDeg, toName: compassName(h.toDeg), speedKmh: Math.round(h.speedKmh) }
  })
})
</script>

<template>
  <section class="profile">
    <h4>Angin di atas kawah</h4>
    <table>
      <tbody>
        <tr v-for="r in rows" :key="r.name">
          <td class="alt">{{ r.altKm }} km</td>
          <td class="arrow"><svg viewBox="0 0 12 12" width="12" height="12" :style="{ transform: `rotate(${r.toDeg ?? 0}deg)` }"><path d="M6 1 L10 10 L6 8 L2 10 Z" /></svg></td>
          <td class="dir">{{ r.speedKmh == null ? '–' : `${r.speedKmh} km/jam ke ${r.toName}` }}</td>
        </tr>
      </tbody>
    </table>
    <p class="note">Panah = arah abu dibawa. Level tekanan: {{ windField.levels.map(l => l.name).join(', ') }}.</p>
  </section>
</template>

<style scoped>
.profile h4 { margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: var(--bone); }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
td { padding: 1px 0; color: var(--bone); }
.alt { width: 46px; color: var(--ash); font-variant-numeric: tabular-nums; }
.arrow { width: 18px; }
.arrow svg { display: block; fill: var(--sky); transition: transform .3s; }
.dir { font-variant-numeric: tabular-nums; }
.note { margin: 6px 0 0; font-size: 11px; color: var(--ash); line-height: 1.4; }
</style>
