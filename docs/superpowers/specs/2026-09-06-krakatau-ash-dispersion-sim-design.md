# Spec: Simulasi Sebaran Abu Anak Krakatau → Jakarta (v1)

Tanggal: 2026-09-06 · Status: draft untuk review · Path: architectural (project baru)

## 1. Ringkasan

Web app interaktif (Vue 3) berupa peta yang me-*replay* sebaran abu vulkanik erupsi besar Anak Krakatau 4–6 September 2026, dari kawah sampai menutupi Jakarta. Abu dimodelkan sebagai partikel yang didorong data angin nyata per ketinggian, dijatuhkan oleh gravitasi, dan dibandingkan dengan poligon resmi VAAC Darwin. Tujuan v1: **visualisasi/edukasi** — fisikanya disederhanakan tapi setiap angka berakar dari data nyata yang tersimpan di `data/raw/` (lihat `data/SOURCES.md`).

Target pengguna: publik umum / penonton awam. Satu halaman, tanpa backend, bisa di-deploy statis.

## 2. Lingkup v1

**Masuk:**
- Replay 72 jam: 2026-09-04 00:00 UTC (07:00 WIB) → 2026-09-07 00:00 UTC (07:00 WIB), dengan play/pause, kecepatan, dan slider waktu (scrub maju/mundur).
- Partikel abu 3D-semu (lat, lon, ketinggian) digerakkan angin dari grid Open-Meteo 7 level, difusi acak, penyebaran awal *umbrella*, dan pengendapan (settling) per kelas ukuran.
- Peta endapan (ashfall) kumulatif.
- Overlay poligon VAAC Darwin (observasi) sebagai pembanding, bisa di-toggle.
- Panah angin di level ketinggian yang dipilih.
- Timeline kejadian (erupsi, advisory, hujan abu, penutupan bandara) yang muncul sesuai waktu simulasi, plus marker lokasi laporan hujan abu.
- Batas provinsi, marker gunung, kota, dan bandara (CGK, HLP, TKG).

**Tidak masuk (v2 backlog, lihat §12):** sandbox what-if, grafik PM10, klik-untuk-lihat-konsentrasi, mobile-first, i18n, backend/polling data live.

## 3. Data & pipeline

Semua data mentah sudah ada di `data/raw/`. Script `scripts/build-data.mjs` (Node, dijalankan `npm run build:data`, juga otomatis lewat `prebuild`) mengubahnya jadi file siap-pakai di `public/data/`. Hasil generate **di-commit** supaya `npm run dev` dan hosting statis jalan tanpa langkah tambahan (total ≈1,5 MB sebelum gzip).

| Output | Sumber | Isi |
|---|---|---|
| `wind.json` | `raw/wind/open-meteo-grid-1deg-*.json` | `lats[10]`, `lons[13]`, `levels[7]{name, altKm}`, `times[96]` (ISO UTC), `u[]`, `v[]` (m/s, flat array urutan `[t][level][lat][lon]`, dibulatkan 2 desimal). Konversi dari speed/direction meteorologis: `u = -speed·sin(dir)`, `v = -speed·cos(dir)`. |
| `vaac.json` | `raw/vaac/vaac-darwin-krakatau-2026-09.txt` | Array advisory: `{nr, issuedUtc, obsUtc, layers[{topFl, topKm, polygon[[lat,lon]…], moveDeg, moveKt}], forecasts[{hours, validUtc, layers[…]}]}`. Parser di `src/engine/vaacParser.js` (dipakai script dan test). |
| `provinces.json` | `raw/geo/indonesia-province-simple.json` | Salin apa adanya (185 KB). Nama di properti `Propinsi`. |
| `eruption-source.json` | kurasi manual dari VAAC + Watchers | Deret tinggi kolom (lihat §4.2). |
| `events.json` | kurasi manual dari `SOURCES.md` §5 | `{id, timeUtc, kind, title, description, location?{name,lat,lon}, sourceUrl}` — `kind ∈ eruption, advisory, ashfall, aviation, report`. Teks bahasa Inggris (teks UI). |
| `places.json` | kurasi manual | Gunung (−6.102, 105.423), kota (Jakarta, Bogor, Depok, Tangerang, Serang, Bandar Lampung, Bandung), bandara (CGK −6.125 106.656; HLP −6.267 106.891; TKG −5.240 105.176). |

Level tekanan → ketinggian (km) yang dipakai: 10 m → 0.01, 850 hPa → 1.5, 700 → 3.0, 500 → 5.6, 300 → 9.2, 200 → 11.8, 100 → 16.2.

Data mentah `raw/air-quality/` dan `raw/vaac/*.png` tidak dipakai di v1 (disimpan untuk referensi/v2).

## 4. Model simulasi

Model Lagrangian sederhana. Semua parameter ada di `src/config/simConfig.js` supaya kalibrasi tinggal ubah angka. Jumlah partikel adalah **satuan visual, bukan massa** — ditulis jelas di legenda.

### 4.1 Domain & waktu
- Domain: lat −11…−2, lon 100…112 (= grid angin). Partikel yang keluar domain dihapus.
- Waktu: 04 Sep 00:00Z → 07 Sep 00:00Z. Langkah integrasi tetap `stepMinutes = 10` (432 langkah). Engine juga menerima `dt` lebih kecil untuk animasi halus (lihat §5.2), tapi test/kalibrasi selalu pakai 10 menit.
- Semua waktu internal dalam ms UTC; UI menampilkan WIB (UTC+7) dengan UTC kecil di bawahnya.

### 4.2 Sumber erupsi (`eruptionSource.js`)
Deret tinggi puncak kolom `H(t)` (km di atas laut), interpolasi tangga (nilai bertahan sampai titik berikutnya):

| UTC | H (km) | Dasar |
|---|---|---|
| 04 00:00 | 1.5 | VAAC 162 FL050 (fase latar sejak Juli) |
| 04 16:00 | 2.1 | VAAC 163 FL070 |
| 04 16:30 | 13.7 | VAAC 164 FL450 — erupsi besar mulai 23:07 WIB |
| 04 16:40 | 14.6 | VAAC 165 FL480 |
| 04 17:50 | 15.2 | JMA/VAAC ~15 km, lalu FL500 kontinu (171–183) |
| 06 02:00 | 6.1 | VAAC 184: lapisan FL500 lepas dari gunung, emisi kontinu tinggal FL200 |
| 07 00:00 | — | akhir simulasi |

Asumsi: setelah 184 tidak ada advisory tersimpan; H ditahan 6.1 km sampai akhir. Kalau advisory baru berhasil diambil saat implementasi, tabel ini diperbarui.

Laju emisi per langkah: `emissionPerStep = base · max(0.05, (H / 15.2)²)` dengan `base = 60` partikel/10 menit. Kap partikel hidup `maxParticles = 20000`; slot partikel yang mengendap/keluar domain dipakai ulang (free-list).

Ketinggian awal partikel: 60% seragam di pita *umbrella* `[0.7H, H]`, 40% seragam di `[0.1H, 0.7H]`. Posisi awal: offset radial acak dari kawah, jarak `U(0, R)` dengan `R = umbrellaFactor · H`, `umbrellaFactor = 2` (30 km saat H = 15 km) — meniru penyebaran awan payung yang tidak bergantung angin.

Kelas ukuran (dibagi saat emisi): `fine` 50% (v_settle 0.01 m/s, bobot endapan 0.2), `medium` 35% (0.1 m/s, 0.5), `coarse` 15% (0.5 m/s, 1.0). Angka dari orde Stokes untuk ~20 / 50 / 100 µm.

### 4.3 Gerak per langkah (`particleSystem.js`)
Untuk tiap partikel hidup, dengan `dt` detik:
1. `(u, v) = windField.sample(lat, lon, altKm, t)` — interpolasi bilinear horizontal, linear di ketinggian (antar level), linear di waktu (antar jam). Di bawah 0.01 km pakai 10 m; di atas 16.2 km ditahan level 100 hPa.
2. **Nudge VAAC**: `(u, v) = (1−α)·(u, v) + α·(u_vaac, v_vaac)` dengan `α = vaacNudge = 0.3`. `(u_vaac, v_vaac)` dari advisory observasi terakhir ≤ t: lapisan FL200 untuk `alt ≤ 6.1 km`, FL500 di atasnya; kalau advisory cuma satu lapisan, dipakai untuk semua. Kalau belum ada advisory (sebelum 162), α = 0. Alasan: angin model di 700 hPa memang punya komponen SE/E 8–19 km/jam pada 5 Sep 18Z–6 Sep 06Z (sesuai VAAC), tapi tipis; nudge menjaga sim tetap sejalan dengan gambaran resmi tanpa mematikan fisika. `α = 0` harus tetap jalan (mode "murni angin").
3. Difusi: tambah noise Gauss horizontal `σ_h = sqrt(2·K_h·dt)`, `K_h = 2000 m²/s` (≈1,5 km per 10 menit); vertikal `σ_z = 100 m` per 10 menit (diskalakan `sqrt(dt/600)`).
4. Advect: `lon += u·dt / (111320·cos lat)`, `lat += v·dt / 110540` (derajat).
5. Settling: `alt -= v_settle·dt`. Kalau `alt ≤ 0` → tambah `bobot` ke sel endapan di posisi itu, partikel dilepas.
6. Umur partikel dicatat (untuk fade visual, bukan fisika).

PRNG deterministik (mulberry32, `seed` di config) supaya dua run identik.

### 4.4 Endapan (`deposition.js`)
Grid 0,1° (≈11 km) menutupi domain: 90 baris × 120 kolom Float32, kumulatif. Nilai ditampilkan relatif terhadap maksimum saat itu (skala log). Sel di laut tetap dihitung (tidak ada mask darat di v1).

### 4.5 Keyframe & seek
Setiap 60 menit sim, engine menyimpan keyframe: `lon/lat` sebagai Int16 (×100), `alt` Uint8 (×10, kap 25,5 km), `cls|alive` Uint8, `bornStep` Uint16, plus salinan grid endapan. ≈200 KB/keyframe × 72 ≈ 15 MB. Seek ke waktu `t`: restore keyframe terakhir ≤ t, lalu maju langkah 10 menit sampai t (≤ 6 langkah). Seek maju dari posisi sekarang cukup lanjut integrasi.

## 5. Arsitektur aplikasi

Vue 3 (`<script setup>`, Composition API), Vite, JavaScript ESM (tanpa TypeScript), Leaflet 1.9 untuk peta, Vitest untuk test. Tanpa Pinia, tanpa UI library — state cukup composables, styling CSS scoped. Basemap: CARTO Positron/Dark Matter (dengan atribusi). Kode/identifier bahasa Inggris, komentar bahasa Indonesia singkat, teks UI bahasa Inggris.

### 5.1 Lapisan

```
src/
├── engine/          murni JS, tanpa Vue/DOM, di-unit-test penuh
│   ├── prng.js              mulberry32
│   ├── geo.js               deg↔meter, jarak
│   ├── windField.js         load wind.json → sample(lat, lon, altKm, tMs) → {u, v}
│   ├── vaacParser.js        teks advisory → objek (dipakai build script + runtime test)
│   ├── vaacAdvisories.js    latestObsAt(t), layerMotionAt(t, altKm) → {u, v}
│   ├── eruptionSource.js    plumeHeightAt(t), emissionCountAt(t, dt)
│   ├── deposition.js        grid endapan
│   ├── particleSystem.js    typed arrays, emit(), advance(dt), keyframe save/restore
│   └── simWorker.js         Web Worker: protokol pesan (§5.3)
├── map/             kelas Leaflet murni (tanpa Vue)
│   ├── ParticleLayer.js     canvas overlay partikel
│   ├── DepositionLayer.js   canvas overlay endapan
│   └── WindArrowLayer.js    panah angin level terpilih
├── composables/
│   ├── useDatasets.js       fetch public/data/*.json sekali, expose status + data
│   ├── useSimulation.js     pemilik worker: currentTime, playing, speed, play/pause/seek/setSpeed; frame terbaru disimpan non-reaktif (markRaw) + callback onFrame
│   └── useLayers.js         visibilitas layer + level angin terpilih
├── components/
│   ├── MapView.vue          init Leaflet, basemap, provinsi, marker, poligon VAAC, mount layer canvas
│   ├── TimelineBar.vue      slider, play/pause, speed, label waktu WIB/UTC, tick kejadian
│   ├── LayerPanel.vue       toggle layer + pilih level angin
│   ├── EventCard.vue        kejadian terakhir ≤ currentTime
│   └── Legend.vue
├── config/simConfig.js
├── App.vue, main.js
scripts/build-data.mjs
tests/                 vitest, cermin struktur engine
public/data/           hasil generate (di-commit)
```

### 5.2 Alur data
1. `App.vue` → `useDatasets()` fetch `wind.json`, `vaac.json`, `eruption-source.json`, `events.json`, `places.json`, `provinces.json`. Tampilkan layar loading.
2. `useSimulation.init(datasets, simConfig)` kirim data (wind sebagai Float32Array transferable) ke worker; worker bangun `windField`, `particleSystem`, lalu balas `ready`.
3. Play: worker menjalankan loop sendiri (`setInterval` ~30 fps), tiap tick maju `dtSim = speed · elapsedReal` (1× = 1 jam sim per detik nyata), dibatasi ≤ 10 menit per langkah (kalau lebih, dipecah), lalu `postMessage({type:'frame', tMs, count, positions: Float32Array[lon,lat,alt,age…], deposition?})` dengan transferable. Endapan dikirim tiap 1 jam sim atau saat seek.
4. `useSimulation` menerima frame → simpan di `latestFrame` (non-reaktif) → panggil `onFrame` → `MapView` minta `ParticleLayer.redraw(frame)` / `DepositionLayer.redraw(grid)`. `currentTime` (ref) diperbarui untuk UI (di-throttle ke 10 fps agar Vue tidak sibuk).
5. Seek dari slider → `worker.seek(tMs)` → worker restore keyframe + maju → kirim satu frame. Selama seek, UI tampilkan indikator kecil.
6. Poligon VAAC & kejadian dihitung di main thread dari `currentTime` (murah): `vaacAdvisories.latestObsAt(t)` → `MapView` gambar `L.polygon` per lapisan; `EventCard` cari event terakhir; marker hujan abu muncul kalau `event.timeUtc ≤ t`.

### 5.3 Protokol worker
Main → worker: `init {datasets, config}`, `play {speed}`, `pause`, `seek {tMs}`, `setSpeed {speed}`.
Worker → main: `ready`, `frame {tMs, count, positions, deposition?}`, `seeking {tMs}`, `error {message}`, `ended` (mencapai akhir waktu → auto-pause).

### 5.4 Rendering
- `ParticleLayer`: satu `<canvas>` seukuran viewport di pane overlay Leaflet; tiap frame: clear, proyeksi lon/lat → pixel (dihitung manual dari bounds peta, bukan `latLngToContainerPoint` per titik), gambar titik 2 px. Warna menurut ketinggian (rendah = abu gelap hangat, tinggi = abu terang kebiruan), alpha turun dengan umur. Redraw juga saat `move/zoom` peta memakai frame terakhir.
- `DepositionLayer`: canvas kedua; sel digambar sebagai persegi dengan alpha ∝ log(nilai)/log(maks), warna kuning → cokelat.
- `WindArrowLayer`: panah tiap titik grid 1° untuk level terpilih di waktu sekarang; diperbarui saat `currentTime` berubah ≥ 30 menit atau level berubah.
- Poligon VAAC: `L.polygon` garis putus-putus — FL500 merah, FL200 oranye — label `VAAC 2026/179 · obs 05/1610Z`.

## 6. UI/UX

Layout desktop: peta penuh layar; panel kanan (bisa dilipat) berisi LayerPanel + Legend; bar bawah = TimelineBar; kartu kejadian melayang kiri-atas di bawah judul. Lebar < 768 px: panel kanan jadi *bottom sheet* sederhana, timeline tetap.

- Judul: "Anak Krakatau Ash Dispersion — 4–6 Sep 2026" + subjudul sumber data.
- TimelineBar: tombol play/pause, pilihan speed 0.5× 1× 2× 4×, slider 0–72 jam (resolusi 10 menit), label `Sat 5 Sep 2026 23:10 WIB` + `16:10 UTC`, tick kejadian di atas slider (hover → judul).
- LayerPanel: toggle `Low ash (0–6 km)`, `High ash (6–16 km)`, `Ashfall`, `VAAC polygons`, `Wind arrows` + dropdown level, `Provinces`, `Places`. Default: semua nyala kecuali Wind arrows.
- EventCard: judul, waktu WIB, deskripsi singkat, link sumber. Kosong sebelum event pertama.
- Legend: ramp warna ketinggian, ramp endapan, garis VAAC, catatan "Particle count is illustrative, not mass".
- Kondisi awal saat buka: waktu = 04 Sep 16:00Z (23:00 WIB, sesaat sebelum erupsi besar), paused, peta terpusat di Selat Sunda–Jakarta zoom 7.

Arah visual (warna, tipografi) diputuskan saat implementasi dengan skill frontend-design; spec ini cuma menetapkan struktur.

## 7. Error handling

- Gagal fetch dataset → layar error dengan pesan file mana yang gagal + tombol Retry. Tidak ada mode degradasi parsial.
- Worker `error`/crash → banner merah di atas timeline "Simulation stopped: …" + tombol Reload.
- Sampel angin di luar domain/waktu → `null`; engine menghapus partikel keluar domain dan meng-clamp waktu ke rentang data.
- Parser VAAC menolak advisory tanpa `OBS VA CLD` yang bisa dibaca (throw dengan nomor advisory) — dijalankan saat build, jadi kesalahan ketahuan sebelum runtime.
- Tile basemap gagal → dibiarkan (Leaflet menampilkan kosong); atribusi tetap tampil.

## 8. Testing & kalibrasi

Unit test (Vitest, `tests/engine/*`), ditulis dulu (TDD):
- `vaacParser`: token `S0606 E10525` → (−6.1, 105.4167); poligon per lapisan dalam satu `OBS VA CLD`; forecast +6/+12/+18; advisory satu lapisan (162) dan dua lapisan (171); sampel nyata dari `data/raw`.
- `windField`: nilai di simpul grid tepat; tengah sel = rata-rata; konvensi arah (angin *dari* 90° → `u < 0`); interpolasi ketinggian antar level; interpolasi waktu; luar domain → `null`.
- `eruptionSource`: `H` di waktu-waktu tabel §4.2 dan di antaranya.
- `particleSystem`: angin sintetis seragam 10 m/s ke timur → setelah 1 jam Δlon ≈ 0.32° di lintang 6°S; `coarse` dari 1 km mengendap ≈33 menit; run dengan seed sama identik; restore keyframe + maju = run langsung.
- `vaacAdvisories`: `latestObsAt`, pemilihan lapisan menurut ketinggian, vektor dari `MOV SE 10KT`.
- `deposition`: indeks sel dari lat/lon, akumulasi.

Kalibrasi (script `scripts/calibrate.mjs`, bukan CI-gate): jalankan engine penuh, pada tiap waktu observasi VAAC hitung fraksi partikel lapisan rendah (≤ 6.1 km) yang berada di dalam poligon FL200 dan lapisan tinggi di dalam FL500. Target v1: ≥ 0.5 untuk advisory 175, 179, 183, 184. Parameter yang boleh diubah untuk mengejar target: `vaacNudge`, `K_h`, `umbrellaFactor`, distribusi ketinggian. Hasil kalibrasi dicatat di `docs/calibration.md`.

Verifikasi manual di browser (Chrome DevTools MCP): play penuh 72 jam tanpa error konsol, seek mundur konsisten, FPS ≥ 30 pada 20k partikel di laptop biasa, abu rendah terlihat menutup Jakarta sekitar 5 Sep 23:00 WIB – 6 Sep 10:00 WIB.

## 9. Performa & batasan

- ≤ 20.000 partikel hidup; 432 langkah × 20k ≈ 8,6 juta update per run penuh — jauh di bawah kemampuan worker.
- Memori keyframe ≈ 15 MB; frame per tick ≈ 320 KB (transferable, tidak dicopy).
- Data awal ≈ 1,5 MB (≈ 400 KB gzip).
- Batasan yang dinyatakan di UI (bagian "About"): angin adalah data model bukan observasi; jumlah partikel bukan massa; advisory VAAC tidak lengkap (163–182 sebagian hilang); tidak ada data ketebalan abu di darat.

## 10. Keputusan & alternatif yang ditolak

| Keputusan | Alternatif | Alasan |
|---|---|---|
| Hybrid: partikel + angin model + nudge VAAC | (A) angin murni; (B) morph poligon VAAC antar advisory | A berisiko abu tidak sampai Jakarta karena komponen timur tipis; B bukan simulasi dan bolong saat advisory hilang. Hybrid tetap fisika, tapi terjaga sejalan dengan gambaran resmi; `α = 0` tersedia untuk yang mau murni |
| Leaflet + canvas 2D | MapLibre GL / deck.gl | 20k titik cukup di canvas 2D; Leaflet paling ringan untuk dipelajari dan di-deploy |
| Engine di Web Worker + keyframe per jam | hitung di main thread / precompute semua langkah | UI tetap 60 fps; precompute penuh 40–60 MB terlalu boros |
| JavaScript, tanpa Pinia/UI lib | TypeScript, Pinia | belum diminta; state kecil |
| Hasil `build-data` di-commit | generate saat build saja | hosting statis & `npm run dev` langsung jalan |
| Replay murni, parameter di config | sandbox slider di UI | permintaan user v1 = visualisasi; engine sudah parametrik jadi sandbox tinggal UI di v2 |

## 11. Lingkup implementasi (urutan kasar untuk plan)

1. Scaffold Vite + Vue + Vitest, struktur folder, `simConfig`.
2. `vaacParser` + `build-data.mjs` → `public/data/*.json` (semua dataset).
3. Engine: `prng`, `geo`, `windField`, `eruptionSource`, `vaacAdvisories`, `deposition`, `particleSystem` (TDD).
4. `simWorker` + `useSimulation` + `useDatasets`.
5. `MapView` + `ParticleLayer` + `DepositionLayer`; poligon VAAC; marker.
6. `TimelineBar`, `LayerPanel`, `EventCard`, `Legend`, `WindArrowLayer`, layout responsif.
7. `calibrate.mjs`, tuning parameter, `docs/calibration.md`.
8. Verifikasi browser, README.

## 12. Backlog v2

- Mode sandbox (slider H, angin, α, K_h) — engine sudah siap.
- Grafik PM10 (CAMS) Jakarta/Serang sinkron dengan waktu.
- Klik peta → nilai endapan & jarak ke kawah.
- Polling endpoint BOM untuk advisory baru selama erupsi berlangsung; melengkapi 163–182 jika ada sumber.
- Mask darat untuk endapan, batas kabupaten.
- Ekspor GIF/video.
