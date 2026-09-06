<script setup>
defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <button class="close" aria-label="Close" @click="emit('close')">✕</button>
      <h2 id="about-title">About this simulation</h2>
      <p>A simplified replay of the Anak Krakatau eruption of 4–6 September 2026. Ash is modelled as particles released from the crater at the plume height reported by Darwin VAAC, carried by model winds at seven altitude levels, spread by random diffusion, nudged toward the official VAAC movement vector, and settled by gravity in three size classes.</p>
      <h3>What it can't tell you</h3>
      <ul>
        <li>Winds are model data from the Open-Meteo forecast archive, not observations.</li>
        <li>Particle counts are illustrative. They do not represent ash mass or concentration.</li>
        <li>VAAC advisories 163–182 are only partly available, so the sim interpolates between the ones we have.</li>
        <li>No ground measurements of ash thickness were available. Ashfall is shown relative to its own maximum.</li>
        <li>Plume height is held constant between reported values.</li>
      </ul>
      <h3>Where the data comes from</h3>
      <ul>
        <li>Darwin VAAC volcanic ash advisories, via VolcanoDiscovery and bom.gov.au</li>
        <li>Open-Meteo wind at 10 m and at 850, 700, 500, 300, 200 and 100 hPa</li>
        <li>PVMBG and MAGMA Indonesia, BMKG statements, and Indonesian news reports for the event timeline</li>
        <li>Province boundaries from superpikar/indonesia-geojson (BAKOSURTANAL 1:250k)</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: absolute; inset: 0; z-index: 2000; background: rgba(10, 9, 8, 0.65); display: grid; place-items: center; backdrop-filter: blur(3px); }
.dialog { position: relative; width: min(560px, calc(100vw - 32px)); max-height: 80vh; overflow: auto; padding: 22px 26px; background: var(--smoke); color: var(--bone); border: 1px solid var(--line); border-radius: 8px; font-size: 14px; line-height: 1.5; }
.close { position: absolute; right: 12px; top: 12px; background: none; border: none; color: var(--ash); font-size: 16px; cursor: pointer; }
h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
h3 { margin: 16px 0 4px; font-size: 14px; font-weight: 600; color: var(--bone); }
p, li { max-width: 62ch; }
ul { margin: 0; padding-left: 18px; color: var(--bone); }
li { margin: 2px 0; }
</style>
