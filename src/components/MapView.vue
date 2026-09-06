<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import { ParticleLayer } from '../map/ParticleLayer.js'
import { DepositionLayer } from '../map/DepositionLayer.js'
import { WindArrowLayer } from '../map/WindArrowLayer.js'
import { createVaacAdvisories } from '../engine/vaacAdvisories.js'
import { createDepositionGrid } from '../engine/deposition.js'
import { locatedEventsUpTo } from '../utils/events.js'
import { formatWibShort } from '../utils/formatTime.js'
import { summarizePoint } from '../utils/mapInfo.js'
import { simConfig } from '../config/simConfig.js'

const props = defineProps({
  datasets: { type: Object, required: true },
  simulation: { type: Object, required: true },
  layers: { type: Object, required: true },
  windField: { type: Object, required: true },
})

const container = ref(null)
let map, particleLayer, depositionLayer, windArrowLayer, provinceLayer, placeGroup, offFrame
let vaacGroup, vaacForecastGroup, eventGroup, shownAdvisoryNr = null, shownEventIds = ''
let lastFrame = null
const { domain, deposition } = simConfig
const vaacAdvisories = createVaacAdvisories(props.datasets.vaac)
// grid endapan lokal (salinan dari frame) buat popup klik
const depositionGrid = createDepositionGrid({ ...domain, cellDeg: deposition.cellDeg })
let depositionMax = 0

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

const obsLabel = (iso) => `${iso.slice(8, 10)}/${iso.slice(11, 13)}${iso.slice(14, 16)}Z`

// poligon observasi + prakiraan VAAC terakhir ≤ t; digambar ulang hanya kalau advisory-nya ganti
function updateVaac(tMs) {
  const a = vaacAdvisories.latestObsAt(tMs)
  const nr = a?.nr ?? null
  if (nr === shownAdvisoryNr) return
  shownAdvisoryNr = nr; vaacGroup.clearLayers(); vaacForecastGroup.clearLayers()
  if (!a) return
  for (const layer of a.layers) {
    const high = layer.topFl >= 500
    const mov = layer.moveKt != null ? ` MOV ${layer.moveDeg}° ${layer.moveKt}KT` : ''
    L.polygon(layer.polygon, { color: high ? '#ff4d4d' : '#ffa53c', weight: 1.5, dashArray: '6 4', fill: false, interactive: true })
      .bindTooltip(`VAAC ${a.nr} · observasi ${obsLabel(a.obsUtc)} · SFC/FL${layer.topFl}${mov}`, { sticky: true })
      .addTo(vaacGroup)
  }
  // prakiraan +6/+12/+18 jam: makin jauh makin pudar
  const opacities = { 6: 0.75, 12: 0.5, 18: 0.32 }
  for (const f of a.forecasts) {
    for (const layer of f.layers) {
      const high = layer.topFl >= 500
      L.polygon(layer.polygon, { color: high ? '#ff4d4d' : '#ffa53c', weight: 1, dashArray: '2 5', opacity: opacities[f.hours] ?? 0.3, fill: false, interactive: true })
        .bindTooltip(`Prakiraan VAAC ${a.nr} +${f.hours} jam · berlaku ${obsLabel(f.validUtc)} · SFC/FL${layer.topFl}`, { sticky: true })
        .addTo(vaacForecastGroup)
    }
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
  toggleGroup(vaacGroup, l.vaac); toggleGroup(vaacForecastGroup, l.vaacForecast)
  toggleGroup(eventGroup, l.places); toggleGroup(placeGroup, l.places); toggleGroup(provinceLayer, l.provinces)
  windArrowLayer.setState({ visible: l.wind, levelIndex: l.windLevel, tMs: props.simulation.currentTimeMs.value })
}

const fmtNum = (n) => Math.round(n).toLocaleString('id-ID')

// klik peta → ringkasan titik itu
function onMapClick(ev) {
  const { lat, lng } = ev.latlng
  const info = summarizePoint({
    lat, lon: lng, frame: lastFrame, grid: { max: depositionMax, cellIndex: depositionGrid.cellIndex, values: depositionGrid.values },
    windField: props.windField, levelIndex: props.layers.windLevel, tMs: props.simulation.currentTimeMs.value,
    vent: simConfig.vent, places: props.datasets.places, lowTopKm: simConfig.lowLayerTopKm,
  })
  const rows = [
    `<b>${lat.toFixed(2)}°, ${lng.toFixed(2)}°</b> · ${fmtNum(info.fromVentKm)} km ${info.bearingName} kawah`,
    info.deposition ? `Endapan abu: ${info.deposition.value > 0 ? `${Math.max(1, Math.round(info.deposition.fraction * 100))} % dari maksimum` : 'belum ada'}` : 'Endapan abu: belum ada',
    `Partikel dalam ${info.particles.radiusKm} km: ${fmtNum(info.particles.low)} rendah, ${fmtNum(info.particles.high)} tinggi`,
    info.wind ? `Angin ${info.wind.levelName} (${info.wind.altKm} km): ${fmtNum(info.wind.speedKmh)} km/jam ke ${info.wind.toName}` : 'Angin: di luar cakupan data',
    info.nearestPlace ? `Kota terdekat: ${info.nearestPlace.name} (${fmtNum(info.nearestPlace.distanceKm)} km)` : '',
  ].filter(Boolean)
  L.popup({ className: 'info-popup', maxWidth: 280 }).setLatLng(ev.latlng).setContent(rows.join('<br>')).openOn(map)
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
  windArrowLayer = new WindArrowLayer({ windField: props.windField }).addTo(map)
  vaacGroup = L.layerGroup().addTo(map)
  vaacForecastGroup = L.layerGroup()
  eventGroup = L.layerGroup().addTo(map)
  updateVaac(props.simulation.currentTimeMs.value); updateEventMarkers(props.simulation.currentTimeMs.value)
  applyLayers()
  map.on('click', onMapClick)

  // frame dari worker → canvas (bukan lewat reaktivitas Vue)
  offFrame = props.simulation.onFrame((frame) => {
    lastFrame = frame
    particleLayer.setFrame(frame)
    if (frame.deposition) {
      depositionGrid.restore(frame.deposition); depositionMax = frame.depositionMax
      depositionLayer.setGrid({ values: frame.deposition, max: frame.depositionMax, rows: depositionGrid.rows, cols: depositionGrid.cols, cellDeg: deposition.cellDeg, latMin: domain.latMin, lonMin: domain.lonMin })
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

defineExpose({ getMap: () => map, getParticleLayer: () => particleLayer, getDepositionLayer: () => depositionLayer, getOverlayGroups: () => ({ vaacGroup, vaacForecastGroup, eventGroup }) })
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
.info-popup .leaflet-popup-content-wrapper { background: var(--smoke); color: var(--bone); border: 1px solid var(--line); border-radius: 6px; font: 12.5px/1.5 var(--font); }
.info-popup .leaflet-popup-tip { background: var(--smoke); }
.info-popup .leaflet-popup-close-button { color: var(--ash); }
@media (max-width: 767px) { .leaflet-bottom { bottom: 150px; } }
</style>
