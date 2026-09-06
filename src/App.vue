<script setup>
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { createWindField } from './engine/windField.js'
import { M_PER_DEG_LAT, metersPerDegLon } from './engine/geo.js'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { useLayers } from './composables/useLayers.js'
import { useVideoMode } from './composables/useVideoMode.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventCard from './components/EventCard.vue'
import LayerPanel from './components/LayerPanel.vue'
import Legend from './components/Legend.vue'
import AboutPanel from './components/AboutPanel.vue'
import AirQualityChart from './components/AirQualityChart.vue'
import WindProfile from './components/WindProfile.vue'
import VideoFrame from './components/VideoFrame.vue'

const INITIAL_UTC = '2026-09-04T16:00:00Z' // sesaat sebelum erupsi besar (spec §6)
const SITE_URL = 'rgibranz.github.io/simulate-abu-vulkanik'
const HANDLE = '@rgibranz' // watermark video
const datasets = useDatasets()
const simulation = useSimulation()
const layers = useLayers()
const video = useVideoMode()
const videoPhase = ref('main')
// layer tetap untuk render video: satelit nyala, panel/grafik mati; split = satelit kiri, simulasi kanan
const baseVideoLayers = { lowAsh: true, highAsh: true, ashfall: true, vaac: true, vaacForecast: false, wind: false, windLevel: 2, windModel: 'best', provinces: true, places: true, pm10: false, satellite: true }
const videoLayers = reactive({ ...baseVideoLayers })
const satelliteOnlyLayers = reactive({ ...baseVideoLayers, lowAsh: false, highAsh: false, ashfall: false, vaac: false })
const simOnlyLayers = reactive({ ...baseVideoLayers, satellite: false })
const focusStats = ref({ nearestKm: null, within: 0 })
const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)
const sideCollapsed = ref(window.innerWidth < 768)
const aboutOpen = ref(false)
const windData = shallowRef(null) // dataset angin yang sedang dipakai (ikut layers.windModel)
const windError = ref(null)
let resumeMs = null // waktu yang dikembalikan setelah worker di-init ulang

// medan angin di main thread (buat panah, profil kawah, popup klik); worker punya salinannya sendiri
const windField = computed(() => (windData.value ? createWindField(windData.value) : null))

onMounted(() => {
  datasets.load()
  if (video.enabled) installVideoHook()
})
watch(() => datasets.status.value, (s) => {
  if (s !== 'ready') return
  windData.value = datasets.data.value.wind
  simulation.init(datasets.data.value, simConfig)
})
watch(() => simulation.status.value, (s) => {
  if (s !== 'ready') return
  simulation.seek(resumeMs ?? Date.parse(INITIAL_UTC)); resumeMs = null
})
// ganti model angin → muat file-nya, hitung ulang simulasi sampai waktu yang sama
watch(() => layers.windModel, async (model) => {
  if (datasets.status.value !== 'ready') return
  try {
    windError.value = null
    const wind = await datasets.loadWind(model)
    windData.value = wind
    resumeMs = simulation.currentTimeMs.value
    simulation.init({ ...datasets.data.value, wind }, simConfig)
  } catch (e) { windError.value = e.message }
})

// jarak abu rendah terdekat + jumlah dalam radius dari titik fokus (mode video Ciangsana)
function updateFocusStats(frame) {
  const f = video.focus
  if (!f) return
  const p = frame.positions, mPerDegLon = metersPerDegLon(f.lat), rM = (f.radiusKm ?? 30) * 1000
  let nearest = Infinity, within = 0
  for (let i = 0; i < frame.count * 4; i += 4) {
    if (p[i + 2] > simConfig.lowLayerTopKm) continue
    const d = Math.hypot((p[i] - f.lon) * mPerDegLon, (p[i + 1] - f.lat) * M_PER_DEG_LAT)
    if (d < nearest) nearest = d
    if (d < rM) within++
  }
  focusStats.value = { nearestKm: Number.isFinite(nearest) ? nearest / 1000 : null, within }
}

// kait buat scripts/render-video.mjs: seek deterministik + ganti fase kartu
function installVideoHook() {
  simulation.onFrame(updateFocusStats)
  window.__sim = {
    get ready() { return simulation.status.value === 'ready' },
    get currentTimeMs() { return simulation.currentTimeMs.value },
    setPhase(p) { videoPhase.value = p },
    seek(tMs) {
      return new Promise((resolve) => {
        const off = simulation.onFrame((f) => { if (f.tMs >= tMs - 1) { off(); resolve(f.tMs) } })
        simulation.seek(tMs)
      })
    },
  }
}

function reload() { window.location.reload() }
</script>

<template>
  <div class="app" :class="{ 'video-mode': video.enabled }">
    <!-- mode render video: peta + overlay VideoFrame saja -->
    <template v-if="video.enabled">
      <div v-if="datasets.status.value !== 'ready'" class="overlay"><p>Memuat…</p></div>
      <template v-else-if="windField">
        <div v-if="video.variant === 'split'" class="split">
          <div class="pane"><MapView :datasets="datasets.data.value" :simulation="simulation" :layers="satelliteOnlyLayers" :wind-field="windField" :view="video.view" :show-caption="false" :zoom-control="false" /></div>
          <div class="pane"><MapView :datasets="datasets.data.value" :simulation="simulation" :layers="simOnlyLayers" :wind-field="windField" :view="video.view" :show-caption="false" :zoom-control="false" /></div>
        </div>
        <MapView v-else :datasets="datasets.data.value" :simulation="simulation" :layers="videoLayers" :wind-field="windField" :view="video.view" :show-caption="false" :zoom-control="false" :focus="video.focus" />
        <VideoFrame :orientation="video.orientation" :variant="video.variant" :phase="videoPhase" :current-time-ms="simulation.currentTimeMs.value" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" :himawari="datasets.data.value.himawari" :site-url="SITE_URL" :handle="HANDLE" :focus="video.focus" :focus-stats="focusStats" />
      </template>
    </template>

    <template v-else>
      <header class="header">
        <div class="title">
          <h1>Sebaran abu Anak Krakatau <span class="dates">4–6 September 2026</span></h1>
          <p>Partikel abu dibawa angin model Open-Meteo, diputar ulang dan dibandingkan dengan advisory VAAC Darwin.</p>
        </div>
        <button class="about" @click="aboutOpen = true">Tentang</button>
      </header>

      <div v-if="datasets.status.value !== 'ready'" class="overlay">
        <template v-if="datasets.status.value === 'error'">
          <p class="err">Data simulasi gagal dimuat: {{ datasets.error.value }}</p>
          <button class="primary" @click="datasets.load()">Coba lagi</button>
        </template>
        <p v-else>Memuat data angin dan advisory…</p>
      </div>

      <template v-else>
        <MapView v-if="windField" :datasets="datasets.data.value" :simulation="simulation" :layers="layers" :wind-field="windField" />
        <EventCard :events="datasets.data.value.events.events" :current-time-ms="simulation.currentTimeMs.value" />
        <AirQualityChart v-if="layers.pm10" :air-quality="datasets.data.value.airQuality" :current-time-ms="simulation.currentTimeMs.value" :start-ms="startMs" :end-ms="endMs" />
        <aside class="side" :class="{ collapsed: sideCollapsed }">
          <button class="collapse" :aria-label="sideCollapsed ? 'Tampilkan lapisan' : 'Sembunyikan lapisan'" @click="sideCollapsed = !sideCollapsed">{{ sideCollapsed ? 'Lapisan' : '✕' }}</button>
          <div v-show="!sideCollapsed">
            <LayerPanel :layers="layers" />
            <Legend />
            <WindProfile v-if="windField" :wind-field="windField" :current-time-ms="simulation.currentTimeMs.value" :vent="simConfig.vent" />
          </div>
        </aside>
        <div v-if="simulation.status.value === 'error'" class="banner">
          Simulasi berhenti: {{ simulation.error.value }} <button class="primary" @click="reload">Muat ulang</button>
        </div>
        <div v-else-if="windError" class="banner">
          Model angin gagal dimuat: {{ windError }}
        </div>
        <div v-else-if="simulation.status.value === 'loading'" class="banner soft">Menghitung ulang dengan model angin baru…</div>
        <TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" :eruption-series="datasets.data.value.eruptionSource.series" />
      </template>

      <AboutPanel :open="aboutOpen" @close="aboutOpen = false" />
    </template>
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
/* mode video: atribusi tetap ada tapi kecil, tanpa kontrol */
.video-mode .leaflet-bottom { bottom: 0; }
.video-mode .leaflet-control-attribution { font-size: 14px; }
</style>

<style scoped>
.app { position: fixed; inset: 0; color: var(--bone); background: var(--ink); font-family: var(--font); }
.split { position: absolute; inset: 0; display: flex; }
.pane { position: relative; flex: 1; overflow: hidden; }
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
.side { position: absolute; right: 16px; top: 96px; z-index: 1000; width: 256px; max-height: calc(100vh - 200px); overflow: auto; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(8px); }
.side.collapsed { width: auto; padding: 0; border: none; background: none; }
.collapse { float: right; background: none; border: none; color: var(--ash); cursor: pointer; font-size: 13px; padding: 0 0 6px 8px; }
.side.collapsed .collapse { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 12px; float: none; color: var(--bone); }
.banner { position: absolute; left: 16px; right: 16px; bottom: 96px; z-index: 1100; padding: 10px 14px; background: #4a1d17; border: 1px solid #a3402f; border-radius: 6px; display: flex; gap: 12px; align-items: center; font-size: 13px; }
.banner.soft { background: var(--panel); border-color: var(--line); color: var(--ash); left: auto; right: 16px; bottom: 100px; }
@media (max-width: 767px) {
  h1 { font-size: 17px; } .dates { font-size: 13px; } .header p { display: none; }
  .side { top: auto; bottom: 170px; right: 12px; max-height: 42vh; overflow: auto; width: 230px; }
  .side.collapsed { width: auto; right: auto; left: 12px; } /* kiri, biar nggak nabrak kontrol zoom */
}
</style>
