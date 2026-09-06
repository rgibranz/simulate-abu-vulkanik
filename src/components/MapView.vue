<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { ParticleLayer } from '../map/ParticleLayer.js'
import { DepositionLayer } from '../map/DepositionLayer.js'
import { WindArrowLayer } from '../map/WindArrowLayer.js'
import { createWindField } from '../engine/windField.js'
import { createVaacAdvisories } from '../engine/vaacAdvisories.js'
import { locatedEventsUpTo } from '../utils/events.js'
import { formatWibShort } from '../utils/formatTime.js'
import { simConfig } from '../config/simConfig.js'

const props = defineProps({
  datasets: { type: Object, required: true },
  simulation: { type: Object, required: true },
  layers: { type: Object, required: true },
})

const container = ref(null)
let map, particleLayer, depositionLayer, windArrowLayer, provinceLayer, placeGroup, offFrame
let vaacGroup, eventGroup, shownAdvisoryNr = null, shownEventIds = ''
const { domain, deposition } = simConfig
const vaacAdvisories = createVaacAdvisories(props.datasets.vaac)

function addPlaces(places) {
  placeGroup = L.layerGroup().addTo(map)
  L.marker([places.volcano.lat, places.volcano.lon], {
    icon: L.divIcon({ className: 'volcano-icon', html: '▲', iconSize: [20, 20], iconAnchor: [10, 10] }),
  }).bindTooltip(places.volcano.name, { permanent: true, direction: 'bottom', className: 'place-label' }).addTo(placeGroup)
  for (const c of places.cities) {
    L.circleMarker([c.lat, c.lon], { radius: 3, color: '#f2f2f2', weight: 1, fillOpacity: 0.9 })
      .bindTooltip(c.name, { permanent: true, direction: 'right', className: 'place-label' }).addTo(placeGroup)
  }
  for (const a of places.airports) {
    L.circleMarker([a.lat, a.lon], { radius: 4, color: '#ffd166', weight: 2, fillOpacity: 0.2 })
      .bindTooltip(`${a.code} · ${a.name}`, { direction: 'top' }).addTo(placeGroup)
  }
}

// poligon observasi VAAC terakhir ≤ t; digambar ulang hanya kalau advisory-nya ganti
function updateVaac(tMs) {
  const a = vaacAdvisories.latestObsAt(tMs)
  const nr = a?.nr ?? null
  if (nr === shownAdvisoryNr) return
  shownAdvisoryNr = nr; vaacGroup.clearLayers()
  if (!a) return
  for (const layer of a.layers) {
    const high = layer.topFl >= 500
    const obs = `${a.obsUtc.slice(8, 10)}/${a.obsUtc.slice(11, 13)}${a.obsUtc.slice(14, 16)}Z`
    const mov = layer.moveKt != null ? ` MOV ${layer.moveDeg}° ${layer.moveKt}KT` : ''
    L.polygon(layer.polygon, { color: high ? '#ff4d4d' : '#ffa53c', weight: 1.5, dashArray: '6 4', fill: false, interactive: true })
      .bindTooltip(`VAAC ${a.nr} · obs ${obs} · SFC/FL${layer.topFl}${mov}`, { sticky: true })
      .addTo(vaacGroup)
  }
}

// marker laporan hujan abu / bandara yang sudah terjadi sampai t
function updateEventMarkers(tMs) {
  const visible = locatedEventsUpTo(props.datasets.events.events, tMs)
  const ids = visible.map(e => e.id).join(',')
  if (ids === shownEventIds) return
  shownEventIds = ids; eventGroup.clearLayers()
  for (const e of visible) {
    const color = e.kind === 'aviation' ? '#ffd166' : '#d69630'
    L.circleMarker([e.location.lat, e.location.lon], { radius: 7, color, weight: 2, fillColor: color, fillOpacity: 0.35 })
      .bindTooltip(`${formatWibShort(Date.parse(e.timeUtc))} · ${e.title}`, { direction: 'top' }).addTo(eventGroup)
  }
}

function toggleGroup(layer, on) {
  if (!layer) return
  if (on && !map.hasLayer(layer)) layer.addTo(map)
  if (!on && map.hasLayer(layer)) map.removeLayer(layer)
}

function applyLayers() {
  const l = props.layers
  particleLayer.setVisibility({ low: l.lowAsh, high: l.highAsh })
  depositionLayer.setVisible(l.ashfall)
  toggleGroup(vaacGroup, l.vaac); toggleGroup(eventGroup, l.places); toggleGroup(placeGroup, l.places); toggleGroup(provinceLayer, l.provinces)
  windArrowLayer.setState({ visible: l.wind, levelIndex: l.windLevel, tMs: props.simulation.currentTimeMs.value })
}

onMounted(() => {
  map = L.map(container.value, { center: [-6.3, 106.2], zoom: 7, zoomControl: false, attributionControl: true })
  L.control.zoom({ position: 'bottomright' }).addTo(map) // kiri-atas dipakai judul
  // CARTO sekarang minta API key; Esri Dark Gray Canvas gratis dengan atribusi
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  }).addTo(map)
  provinceLayer = L.geoJSON(props.datasets.provinces, { style: { color: '#8a94a6', weight: 1, fillOpacity: 0.02, interactive: false } }).addTo(map)
  addPlaces(props.datasets.places)

  depositionLayer = new DepositionLayer().addTo(map)
  particleLayer = new ParticleLayer({ lowTopKm: simConfig.lowLayerTopKm }).addTo(map)
  windArrowLayer = new WindArrowLayer({ windField: createWindField(props.datasets.wind) }).addTo(map)
  vaacGroup = L.layerGroup().addTo(map)
  eventGroup = L.layerGroup().addTo(map)
  updateVaac(props.simulation.currentTimeMs.value); updateEventMarkers(props.simulation.currentTimeMs.value)
  applyLayers()

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

watch(() => props.simulation.currentTimeMs.value, (t) => {
  if (!map) return
  updateVaac(t); updateEventMarkers(t)
  windArrowLayer.setState({ visible: props.layers.wind, levelIndex: props.layers.windLevel, tMs: t })
})
watch(() => ({ ...props.layers }), () => { if (map) applyLayers() }, { deep: true })

onBeforeUnmount(() => { offFrame?.(); map?.remove() })

defineExpose({ getMap: () => map, getParticleLayer: () => particleLayer, getDepositionLayer: () => depositionLayer, getOverlayGroups: () => ({ vaacGroup, eventGroup }) })
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
/* kontrol bawah Leaflet naik di atas timeline bar */
.leaflet-bottom { bottom: 92px; }
.leaflet-bar a { background: var(--smoke); color: var(--bone); border-bottom-color: var(--line); }
.leaflet-bar a:hover { background: var(--ink); }
.leaflet-container .leaflet-control-attribution { background: rgba(27, 26, 25, 0.75); color: var(--ash); font-size: 10px; }
.leaflet-container .leaflet-control-attribution a { color: var(--ash); }
.leaflet-tooltip { background: var(--smoke); color: var(--bone); border: 1px solid var(--line); font: 12px var(--font); }
.leaflet-tooltip-top::before { border-top-color: var(--line); }
@media (max-width: 767px) { .leaflet-bottom { bottom: 150px; } }
</style>
