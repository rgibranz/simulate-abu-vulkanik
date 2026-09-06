<script setup>
import { computed } from 'vue'
import { latestEventAt } from '../utils/events.js'
import { formatWib } from '../utils/formatTime.js'
import { pickFrame } from '../utils/satelliteFrames.js'

const props = defineProps({
  orientation: { type: String, required: true }, // portrait | landscape
  phase: { type: String, default: 'main' }, // intro | main | outro
  currentTimeMs: { type: Number, required: true },
  startMs: { type: Number, required: true },
  endMs: { type: Number, required: true },
  events: { type: Array, required: true },
  himawari: { type: Object, default: null },
  siteUrl: { type: String, default: '' },
})

const KIND_LABEL = { eruption: 'Erupsi', advisory: 'Advisory VAAC', ashfall: 'Laporan hujan abu', aviation: 'Penerbangan', report: 'Laporan' }
const event = computed(() => latestEventAt(props.events, props.currentTimeMs))
const progress = computed(() => Math.min(1, Math.max(0, (props.currentTimeMs - props.startMs) / (props.endMs - props.startMs))))
const satellite = computed(() => (props.himawari ? pickFrame(props.himawari.frames, props.currentTimeMs) : null))
const hoursSince = computed(() => Math.max(0, (props.currentTimeMs - Date.parse('2026-09-04T16:07:00Z')) / 3600e3))
</script>

<template>
  <div class="video" :class="orientation">
    <!-- kartu pembuka -->
    <div v-if="phase === 'intro'" class="card intro">
      <p class="kicker">Simulasi partikel abu vs citra satelit</p>
      <h1>Sebaran abu Anak Krakatau</h1>
      <p class="dates">4–6 September 2026</p>
      <p class="lead">Bagaimana abu dari Selat Sunda sampai ke Lampung, Banten, dan Jakarta dalam 48 jam.</p>
    </div>

    <!-- strip utama -->
    <template v-else-if="phase === 'main'">
      <div class="brand">Sebaran abu Anak Krakatau <span>4–6 Sep 2026</span></div>
      <div class="strip">
        <div class="clock">
          <div class="wib">{{ formatWib(currentTimeMs) }}</div>
          <div class="since">{{ hoursSince < 1 ? 'Sebelum erupsi besar' : `${Math.floor(hoursSince)} jam setelah erupsi besar` }}<span v-if="satellite"> · citra Himawari-9 {{ formatWib(satellite.tMs).slice(-9) }}</span></div>
        </div>
        <div v-if="event" class="event" :class="event.kind">
          <div class="kind">{{ KIND_LABEL[event.kind] ?? event.kind }}</div>
          <div class="title">{{ event.title }}</div>
          <div class="desc">{{ event.description }}</div>
        </div>
        <div class="legend">
          <span><i class="chip low"></i>abu rendah</span>
          <span><i class="chip high"></i>abu tinggi</span>
          <span><i class="chip dep"></i>endapan</span>
          <span><i class="line"></i>poligon VAAC</span>
          <span><i class="dot"></i>laporan hujan abu</span>
        </div>
      </div>
      <div class="progress"><div class="bar" :style="{ width: (progress * 100).toFixed(2) + '%' }"></div></div>
    </template>

    <!-- kartu penutup -->
    <div v-else class="card outro">
      <h2>Simulasi edukasi, bukan prakiraan resmi</h2>
      <p>Jumlah partikel hanya ilustrasi. Angin dari model cuaca, bukan pengamatan.</p>
      <ul>
        <li>Advisory abu: VAAC Darwin (BOM)</li>
        <li>Angin: Open-Meteo (ECMWF, GFS, ICON)</li>
        <li>Citra: Himawari-9 (JMA) via RAMMB/CIRA</li>
        <li>PM10: CAMS · Kronologi: PVMBG, BMKG, media</li>
      </ul>
      <p v-if="siteUrl" class="url">{{ siteUrl }}</p>
    </div>
  </div>
</template>

<style scoped>
.video { position: absolute; inset: 0; z-index: 1500; pointer-events: none; font-family: var(--font); color: var(--bone); }
.card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 8%; background: linear-gradient(180deg, rgba(27, 26, 25, 0.55), rgba(27, 26, 25, 0.9)); }
.kicker { margin: 0 0 12px; font-size: 30px; color: var(--ash); }
h1 { margin: 0; font-size: 88px; font-weight: 600; line-height: 1.05; letter-spacing: -0.02em; }
.dates { margin: 16px 0 0; font-size: 44px; color: var(--ember); font-weight: 600; }
.lead { margin: 40px 0 0; font-size: 34px; line-height: 1.35; color: var(--bone); max-width: 22ch; }
.outro h2 { margin: 0 0 16px; font-size: 56px; font-weight: 600; line-height: 1.1; }
.outro p { margin: 0 0 28px; font-size: 30px; color: var(--ash); max-width: 30ch; line-height: 1.35; }
.outro ul { margin: 0; padding-left: 28px; font-size: 30px; line-height: 1.6; }
.url { margin-top: 36px !important; color: var(--sky) !important; }

.brand { position: absolute; left: 40px; top: 36px; font-size: 34px; font-weight: 600; text-shadow: 0 2px 12px #000; }
.brand span { color: var(--ash); font-weight: 500; margin-left: 12px; }
.strip { position: absolute; left: 0; right: 0; bottom: 0; padding: 36px 40px 56px; background: linear-gradient(180deg, rgba(27, 26, 25, 0) 0%, rgba(27, 26, 25, 0.82) 22%, rgba(27, 26, 25, 0.94) 100%); }
.wib { font-size: 52px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.since { font-size: 26px; color: var(--ash); margin-top: 4px; }
.event { margin-top: 24px; padding-left: 20px; border-left: 6px solid var(--ash); }
.event.eruption { border-color: var(--ember); } .event.ashfall { border-color: var(--ashfall); } .event.aviation { border-color: #ffd166; } .event.advisory { border-color: var(--sky); }
.kind { font-size: 24px; color: var(--ash); }
.title { font-size: 40px; font-weight: 600; line-height: 1.15; margin-top: 4px; }
.desc { font-size: 27px; line-height: 1.35; margin-top: 8px; color: var(--bone); max-width: 42ch; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-top: 28px; font-size: 24px; color: var(--ash); }
.legend span { display: inline-flex; align-items: center; gap: 10px; }
.chip { width: 22px; height: 22px; border-radius: 4px; } .chip.low { background: rgb(96, 74, 54); } .chip.high { background: rgb(190, 205, 222); } .chip.dep { background: rgba(214, 150, 48, 0.85); }
.line { width: 40px; height: 0; border-top: 4px dashed #ffa53c; }
.dot { width: 18px; height: 18px; border-radius: 50%; border: 4px solid var(--ashfall); }
.progress { position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: rgba(239, 233, 223, 0.15); }
.bar { height: 100%; background: var(--ember); }

/* landscape: strip lebih ramping di kiri bawah */
.landscape .strip { right: auto; width: 720px; padding: 28px 32px 44px; background: linear-gradient(90deg, rgba(27, 26, 25, 0.92), rgba(27, 26, 25, 0.75)); border-top-right-radius: 12px; }
.landscape .wib { font-size: 40px; } .landscape .since { font-size: 20px; }
.landscape .title { font-size: 30px; } .landscape .desc { font-size: 20px; max-width: 34ch; } .landscape .kind { font-size: 18px; }
.landscape .legend { font-size: 18px; gap: 6px 18px; margin-top: 18px; }
.landscape .chip { width: 16px; height: 16px; } .landscape .dot { width: 12px; height: 12px; border-width: 3px; }
.landscape h1 { font-size: 72px; } .landscape .dates { font-size: 36px; } .landscape .lead { font-size: 28px; } .landscape .kicker { font-size: 24px; }
.landscape .outro h2 { font-size: 44px; } .landscape .outro p, .landscape .outro ul { font-size: 24px; }
.landscape .brand { font-size: 28px; }
</style>
