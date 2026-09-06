<script setup>
defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <button class="close" aria-label="Tutup" @click="emit('close')">✕</button>
      <h2 id="about-title">Tentang simulasi ini</h2>
      <p>Pemutaran ulang yang disederhanakan dari erupsi Anak Krakatau 4–6 September 2026. Abu dimodelkan sebagai partikel yang dilepaskan dari kawah setinggi kolom yang dilaporkan VAAC Darwin, dibawa angin model di tujuh level ketinggian, disebar oleh difusi acak, didorong mendekati vektor gerak resmi VAAC, dan diendapkan gravitasi dalam tiga kelas ukuran.</p>
      <h3>Yang tidak bisa dijawab simulasi ini</h3>
      <ul>
        <li>Angin adalah data model dari arsip prakiraan Open-Meteo, bukan pengamatan.</li>
        <li>Jumlah partikel hanya ilustrasi. Bukan massa atau konsentrasi abu.</li>
        <li>Advisory VAAC 163–182 hanya sebagian tersedia, jadi simulasi menginterpolasi di antara yang ada.</li>
        <li>Tidak ada pengukuran ketebalan abu di darat. Endapan ditampilkan relatif terhadap nilai maksimumnya.</li>
        <li>Tinggi kolom dianggap tetap di antara nilai yang dilaporkan.</li>
      </ul>
      <h3>Sumber data</h3>
      <ul>
        <li>Advisory abu vulkanik VAAC Darwin, lewat VolcanoDiscovery dan bom.gov.au</li>
        <li>Angin Open-Meteo di 10 m serta 850, 700, 500, 300, 200, dan 100 hPa (best match, ECMWF IFS 0,25°, GFS, ICON)</li>
        <li>Citra Himawari-9 geocolor per jam dari RAMMB/CIRA SLIDER, direproyeksi ke Web Mercator</li>
        <li>PM10 dan PM2.5 dari model CAMS (Open-Meteo Air Quality)</li>
        <li>PVMBG dan MAGMA Indonesia, pernyataan BMKG, serta pemberitaan media untuk kronologi kejadian</li>
        <li>Batas provinsi dari superpikar/indonesia-geojson (BAKOSURTANAL 1:250k)</li>
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
