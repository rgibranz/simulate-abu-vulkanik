<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import L from 'leaflet'
import { ParticleLayer } from '../map/ParticleLayer.js'
import { DepositionLayer } from '../map/DepositionLayer.js'
import { simConfig } from '../config/simConfig.js'

const props = defineProps({ datasets: { type: Object, required: true }, simulation: { type: Object, required: true } })

const container = ref(null)
let map, particleLayer, depositionLayer, offFrame
const { domain, deposition } = simConfig

function addPlaces(places) {
  L.marker([places.volcano.lat, places.volcano.lon], {
    icon: L.divIcon({ className: 'volcano-icon', html: '▲', iconSize: [20, 20], iconAnchor: [10, 10] }),
  }).bindTooltip(places.volcano.name, { permanent: true, direction: 'bottom', className: 'place-label' }).addTo(map)
  for (const c of places.cities) {
    L.circleMarker([c.lat, c.lon], { radius: 3, color: '#f2f2f2', weight: 1, fillOpacity: 0.9 })
      .bindTooltip(c.name, { permanent: true, direction: 'right', className: 'place-label' }).addTo(map)
  }
  for (const a of places.airports) {
    L.circleMarker([a.lat, a.lon], { radius: 4, color: '#ffd166', weight: 2, fillOpacity: 0.2 })
      .bindTooltip(`${a.code} · ${a.name}`, { direction: 'top' }).addTo(map)
  }
}

onMounted(() => {
  map = L.map(container.value, { center: [-6.3, 106.2], zoom: 7, zoomControl: true, attributionControl: true })
  // CARTO sekarang minta API key; Esri Dark Gray Canvas gratis dengan atribusi
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  }).addTo(map)
  L.geoJSON(props.datasets.provinces, { style: { color: '#8a94a6', weight: 1, fillOpacity: 0.02, interactive: false } }).addTo(map)
  addPlaces(props.datasets.places)

  depositionLayer = new DepositionLayer().addTo(map)
  particleLayer = new ParticleLayer({ lowTopKm: simConfig.lowLayerTopKm }).addTo(map)

  // frame dari worker → canvas (bukan lewat reaktivitas Vue)
  offFrame = props.simulation.onFrame((frame) => {
    particleLayer.setFrame(frame)
    if (frame.deposition) {
      const rows = Math.round((domain.latMax - domain.latMin) / deposition.cellDeg)
      const cols = Math.round((domain.lonMax - domain.lonMin) / deposition.cellDeg)
      depositionLayer.setGrid({ values: frame.deposition, max: frame.depositionMax, rows, cols, cellDeg: deposition.cellDeg, latMin: domain.latMin, lonMin: domain.lonMin })
    }
  })
})

onBeforeUnmount(() => { offFrame?.(); map?.remove() })

defineExpose({ getMap: () => map, getParticleLayer: () => particleLayer, getDepositionLayer: () => depositionLayer })
</script>

<template>
  <div ref="container" class="map"></div>
</template>

<style scoped>
.map { position: absolute; inset: 0; background: #0b0e13; }
</style>

<style>
/* label peta global (Leaflet render di luar scope komponen) */
.place-label { background: transparent; border: none; box-shadow: none; color: #e6e9ef; font: 11px system-ui, sans-serif; text-shadow: 0 0 3px #000; }
.place-label::before { display: none; }
.volcano-icon { color: #ff5a3c; font-size: 18px; line-height: 20px; text-align: center; text-shadow: 0 0 6px #000; }
</style>
