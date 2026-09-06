# Krakatau Ash Dispersion Sim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app Vue 3 yang me-replay sebaran abu Anak Krakatau 4–7 Sep 2026 di peta: partikel abu didorong angin nyata per ketinggian, mengendap, dibandingkan dengan poligon VAAC Darwin.

**Architecture:** Engine partikel murni JS (tanpa DOM) jalan di Web Worker, dikendalikan composable `useSimulation`; peta Leaflet dengan dua canvas overlay (partikel, endapan) plus poligon VAAC/marker via Leaflet biasa. Data mentah di `data/raw` diubah `scripts/build-data.mjs` menjadi JSON di `public/data` (di-commit).

**Tech Stack:** Vue 3 (`<script setup>`), Vite, JavaScript ESM (tanpa TypeScript), Leaflet 1.9, Vitest (+ jsdom untuk test composable), Node 22.

**Spec:** `docs/superpowers/specs/2026-09-06-krakatau-ash-dispersion-sim-design.md` — baca dulu, plan ini mengacu ke nomor bagiannya (§).

## Global Constraints

- Kode selalu bahasa Inggris (variabel, fungsi, prop, key, konstanta). Komentar bahasa Indonesia casual, sependek mungkin. Teks UI bahasa Inggris.
- Commit: 1 kalimat singkat, **tanpa** trailer Co-Authored-By. Commit hanya file task itu (jangan `git add -A`).
- Tanpa TypeScript, tanpa Pinia, tanpa UI library. Styling CSS scoped.
- Engine (`src/engine/*`) dan `src/map/projection.js` tidak boleh import Vue/Leaflet/DOM.
- Semua waktu internal = ms UTC (`Date.UTC`). UI menampilkan WIB (UTC+7) + UTC kecil.
- Parameter fisika hanya di `src/config/simConfig.js` (§4). Nilai default persis seperti spec: `stepSec 600`, `maxParticles 20000`, `base 60`, `vaacNudge 0.3`, `K_h 2000`, `σ_z 100 m`, `umbrellaFactor 2`, kelas fine/medium/coarse 0.5/0.35/0.15 dengan settle 0.01/0.1/0.5 m/s dan bobot 0.2/0.5/1.0.
- Domain lat −11…−2, lon 100…112; waktu 2026-09-04T00:00Z → 2026-09-07T00:00Z.
- Level → km: 10m 0.01, 850 1.5, 700 3.0, 500 5.6, 300 9.2, 200 11.8, 100 16.2.
- Hasil `public/data/*.json` di-commit.
- Test: `npx vitest run` harus hijau sebelum tiap commit.

## File Structure

```
package.json, vite.config.js, index.html, .gitignore
data/raw/…                      (sudah ada, jangan diubah)
data/curated/eruption-source.json, events.json, places.json   (tulis tangan, Task 4)
scripts/build-data.mjs           raw + curated → public/data/*.json
scripts/lib/buildWind.mjs        fungsi murni konversi grid angin (di-test)
scripts/calibrate.mjs            jalankan engine headless, ukur overlap vs VAAC
public/data/{wind,vaac,provinces,eruption-source,events,places}.json
src/main.js, src/App.vue
src/config/simConfig.js
src/engine/prng.js               mulberry32 + gauss
src/engine/geo.js                konversi derajat/meter, kompas, point-in-polygon
src/engine/vaacParser.js         teks advisory → objek
src/engine/windField.js          sample(lat, lon, altKm, tMs) → {u, v}
src/engine/eruptionSource.js     plumeHeightAt, emissionCountAt
src/engine/vaacAdvisories.js     latestObsAt, layerMotionAt
src/engine/deposition.js         grid endapan
src/engine/particleSystem.js     partikel, advance, keyframe
src/engine/simController.js      advanceTo / seekTo + keyframe per jam
src/engine/simWorker.js          adaptor pesan Worker
src/utils/formatTime.js          WIB/UTC label
src/map/projection.js            lon/lat → pixel (murni)
src/map/ParticleLayer.js         L.Layer canvas partikel
src/map/DepositionLayer.js       L.Layer canvas endapan
src/map/WindArrowLayer.js        L.Layer canvas panah angin
src/composables/useDatasets.js   fetch public/data
src/composables/useSimulation.js pemilik worker
src/composables/useLayers.js     toggle layer
src/components/MapView.vue, TimelineBar.vue, LayerPanel.vue, EventCard.vue, Legend.vue, AboutPanel.vue
tests/engine/*.test.js, tests/scripts/buildWind.test.js, tests/map/projection.test.js, tests/utils/formatTime.test.js, tests/composables/useSimulation.test.js
docs/calibration.md, README.md
```

---

### Task 1: Scaffold project (Vite + Vue + Vitest) dan git init

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.js`, `src/App.vue`, `tests/smoke.test.js`

**Interfaces:**
- Produces: perintah `npm run dev`, `npm run build`, `npm test` (= `vitest run`), `npm run build:data`, `npm run calibrate`.

- [ ] **Step 1: git init + .gitignore**

```bash
cd "C:/Users/rahma/project/gibran-kalem/simulate-abu-vulkanik"
git init -b main
printf 'node_modules/\ndist/\n.vite/\n*.log\n.DS_Store\n' > .gitignore
```

- [ ] **Step 2: Tulis package.json**

```json
{
  "name": "krakatau-ash-sim",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build:data": "node scripts/build-data.mjs",
    "prebuild": "npm run build:data",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "calibrate": "node scripts/calibrate.mjs"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: vite.config.js, index.html, main.js, App.vue**

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './', // biar bisa di-host di subfolder (GitHub Pages)
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
})
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Anak Krakatau Ash Dispersion — 4–6 Sep 2026</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`src/main.js`:
```js
import { createApp } from 'vue'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'

createApp(App).mount('#app')
```

`src/App.vue` (placeholder, diganti di Task 12):
```vue
<script setup>
</script>

<template>
  <main class="app">
    <h1>Anak Krakatau Ash Dispersion</h1>
    <p>Loading…</p>
  </main>
</template>

<style scoped>
.app { font-family: system-ui, sans-serif; padding: 1rem; }
</style>
```

- [ ] **Step 4: Smoke test**

`tests/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Install & verifikasi**

Run: `npm install && npx vitest run && npx vite build`
Expected: 1 test passed; `dist/` terbentuk tanpa error. (Kalau `npm install` gagal karena versi, longgarkan caret — jangan ganti library.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html .gitignore src/main.js src/App.vue tests/smoke.test.js data docs
git commit -m "Scaffold Vite+Vue project with raw data and spec"
```

---

### Task 2: simConfig, prng, geo

**Files:**
- Create: `src/config/simConfig.js`, `src/engine/prng.js`, `src/engine/geo.js`
- Test: `tests/engine/prng.test.js`, `tests/engine/geo.test.js`

**Interfaces:**
- Produces:
  - `simConfig` (object, lihat Step 1) — dipakai semua task engine.
  - `createPrng(seed) → { next(): number [0,1), gauss(): number, getState(): number, setState(s) }`
  - `M_PER_DEG_LAT = 110540`, `metersPerDegLon(latDeg)`, `windFromToUV(dirDeg, speed) → {u, v}`, `headingToUV(dirDeg, speed) → {u, v}`, `compassToDeg(name)`, `pointInPolygon(lat, lon, polygon)` (polygon = `[[lat, lon], …]`), `flToKm(fl)`.

- [ ] **Step 1: Tulis simConfig.js**

```js
// Semua parameter simulasi (spec §4). Kalibrasi = ubah angka di sini.
export const simConfig = {
  seed: 20260904,
  startUtc: '2026-09-04T00:00:00Z',
  endUtc: '2026-09-07T00:00:00Z',
  stepSec: 600,
  keyframeSec: 3600,
  maxParticles: 20000,
  vent: { lat: -6.102, lon: 105.423 },
  domain: { latMin: -11, latMax: -2, lonMin: 100, lonMax: 112 },
  emission: {
    basePerStep: 60,      // partikel per 10 menit saat H = refHeightKm
    refHeightKm: 15.2,
    minFactor: 0.05,
    umbrellaFraction: 0.6, // porsi partikel di pita [0.7H, H]
    umbrellaBandLow: 0.7,
    lowBandFloor: 0.1,
    umbrellaFactor: 2,     // R_umbrella (km) = umbrellaFactor * H
  },
  sizeClasses: [
    { name: 'fine', fraction: 0.5, settleMps: 0.01, depositWeight: 0.2 },
    { name: 'medium', fraction: 0.35, settleMps: 0.1, depositWeight: 0.5 },
    { name: 'coarse', fraction: 0.15, settleMps: 0.5, depositWeight: 1.0 },
  ],
  diffusion: { horizontalM2s: 2000, verticalSigmaMPerStep: 100 },
  vaacNudge: 0.3,
  lowLayerTopKm: 6.1,
  deposition: { cellDeg: 0.1 },
  levels: [
    { name: '10m', altKm: 0.01 },
    { name: '850hPa', altKm: 1.5 },
    { name: '700hPa', altKm: 3.0 },
    { name: '500hPa', altKm: 5.6 },
    { name: '300hPa', altKm: 9.2 },
    { name: '200hPa', altKm: 11.8 },
    { name: '100hPa', altKm: 16.2 },
  ],
}
```

- [ ] **Step 2: Test prng (gagal dulu)**

`tests/engine/prng.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createPrng } from '../../src/engine/prng.js'

describe('createPrng', () => {
  it('is deterministic for the same seed', () => {
    const a = createPrng(42), b = createPrng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })
  it('returns values in [0,1)', () => {
    const p = createPrng(7)
    for (let i = 0; i < 1000; i++) { const x = p.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
  it('gauss has ~0 mean and ~1 std', () => {
    const p = createPrng(3); let s = 0, s2 = 0; const n = 20000
    for (let i = 0; i < n; i++) { const g = p.gauss(); s += g; s2 += g * g }
    const mean = s / n, std = Math.sqrt(s2 / n - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.03)
    expect(Math.abs(std - 1)).toBeLessThan(0.03)
  })
  it('state can be saved and restored', () => {
    const p = createPrng(9); p.next(); const s = p.getState(); const x = p.next()
    p.setState(s); expect(p.next()).toBe(x)
  })
})
```

- [ ] **Step 3: Run → gagal**

Run: `npx vitest run tests/engine/prng.test.js`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement prng.js**

```js
// mulberry32: PRNG 32-bit deterministik, cukup buat visualisasi
export function createPrng(seed) {
  let state = seed >>> 0
  let spare = null // cache Box-Muller
  function next() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  function gauss() {
    if (spare !== null) { const g = spare; spare = null; return g }
    let u, v, s
    do { u = next() * 2 - 1; v = next() * 2 - 1; s = u * u + v * v } while (s === 0 || s >= 1)
    const m = Math.sqrt(-2 * Math.log(s) / s)
    spare = v * m
    return u * m
  }
  return {
    next, gauss,
    getState: () => state,
    setState: (s) => { state = s >>> 0; spare = null },
  }
}
```

- [ ] **Step 5: Run → lulus**

Run: `npx vitest run tests/engine/prng.test.js` → PASS (4 tests).

- [ ] **Step 6: Test geo (gagal dulu)**

`tests/engine/geo.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { M_PER_DEG_LAT, metersPerDegLon, windFromToUV, headingToUV, compassToDeg, pointInPolygon, flToKm } from '../../src/engine/geo.js'

describe('geo', () => {
  it('meters per degree', () => {
    expect(M_PER_DEG_LAT).toBe(110540)
    expect(metersPerDegLon(0)).toBeCloseTo(111320, 0)
    expect(metersPerDegLon(-6)).toBeCloseTo(111320 * Math.cos(-6 * Math.PI / 180), 0)
  })
  it('wind FROM east pushes west (u<0)', () => {
    const { u, v } = windFromToUV(90, 10)
    expect(u).toBeCloseTo(-10, 6); expect(v).toBeCloseTo(0, 6)
  })
  it('wind FROM north pushes south (v<0)', () => {
    const { u, v } = windFromToUV(0, 5)
    expect(u).toBeCloseTo(0, 6); expect(v).toBeCloseTo(-5, 6)
  })
  it('heading toward SE gives u>0, v<0', () => {
    const { u, v } = headingToUV(135, Math.SQRT2)
    expect(u).toBeCloseTo(1, 6); expect(v).toBeCloseTo(-1, 6)
  })
  it('compass names', () => {
    expect(compassToDeg('N')).toBe(0); expect(compassToDeg('SE')).toBe(135)
    expect(compassToDeg('WNW')).toBe(292.5); expect(() => compassToDeg('X')).toThrow()
  })
  it('flToKm', () => { expect(flToKm(200)).toBeCloseTo(6.096, 3); expect(flToKm(500)).toBeCloseTo(15.24, 2) })
  it('pointInPolygon', () => {
    const square = [[-5, 105], [-5, 107], [-7, 107], [-7, 105]]
    expect(pointInPolygon(-6, 106, square)).toBe(true)
    expect(pointInPolygon(-8, 106, square)).toBe(false)
    expect(pointInPolygon(-6, 108, square)).toBe(false)
  })
})
```

- [ ] **Step 7: Run → gagal**, lalu **implement geo.js**

```js
export const M_PER_DEG_LAT = 110540
const DEG = Math.PI / 180

export function metersPerDegLon(latDeg) {
  return 111320 * Math.cos(latDeg * DEG)
}

// arah meteorologis = DARI mana angin datang
export function windFromToUV(dirDeg, speed) {
  return { u: -speed * Math.sin(dirDeg * DEG), v: -speed * Math.cos(dirDeg * DEG) }
}

// arah VAAC "MOV SE" = KE mana awan bergerak
export function headingToUV(dirDeg, speed) {
  return { u: speed * Math.sin(dirDeg * DEG), v: speed * Math.cos(dirDeg * DEG) }
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export function compassToDeg(name) {
  const i = COMPASS.indexOf(name.toUpperCase())
  if (i < 0) throw new Error(`Unknown compass direction: ${name}`)
  return i * 22.5
}

export function flToKm(fl) {
  return fl * 100 * 0.3048 / 1000
}

// ray casting; polygon = [[lat, lon], ...]
export function pointInPolygon(lat, lon, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i], [yj, xj] = polygon[j]
    const hit = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}
```

- [ ] **Step 8: Run semua → lulus, commit**

Run: `npx vitest run` → PASS.
```bash
git add src/config/simConfig.js src/engine/prng.js src/engine/geo.js tests/engine/prng.test.js tests/engine/geo.test.js
git commit -m "Add sim config, seeded PRNG and geo helpers"
```

---

### Task 3: vaacParser

**Files:**
- Create: `src/engine/vaacParser.js`
- Test: `tests/engine/vaacParser.test.js`

**Interfaces:**
- Produces: `parseVaacText(text) → Advisory[]` di mana
  ```js
  Advisory = { nr: '2026/171', issuedUtc: '2026-09-05T00:30:00Z', obsUtc: '2026-09-05T00:10:00Z',
               layers: [{ topFl: 200, topKm: 6.096, polygon: [[lat, lon], …], moveDeg: 135, moveKt: 10 }],
               forecasts: [{ hours: 6, validUtc: '…', layers: [{ topFl, topKm, polygon }] }] }
  ```
  Urut naik menurut `obsUtc`. Juga export `parseCloudLayers(str)` dan `parseCoordPair(latTok, lonTok)`.

Format input (lihat `data/raw/vaac/vaac-darwin-krakatau-2026-09.txt`): blok dipisah baris `######## …`; field `LABEL: nilai`; baris lanjutan bisa ber-indent (VolcanoDiscovery) atau tidak (BOM, advisory 184) — jadi unwrap berdasarkan *label*, bukan indentasi. `OBS VA CLD` bisa memuat dua lapisan berurutan: `SFC/FL200 <koordinat> MOV SE 10KT SFC/FL500 <koordinat> MOV W 40KT`. Forecast: `FCST VA CLD +6 HR: 05/0610Z SFC/FL500 <koordinat> SFC/FL200 <koordinat>` atau `NOT AVBL`.

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/vaacParser.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseVaacText, parseCloudLayers, parseCoordPair } from '../../src/engine/vaacParser.js'

const SAMPLE = `######## a
FVAU04 at 00:31 UTC, 05/09/26 from ADRM
VA ADVISORY
DTG: 20260905/0030Z
VAAC: DARWIN
VOLCANO: KRAKATAU 262000
PSN: S0606 E10525
ADVISORY NR: 2026/171
ERUPTION DETAILS: VA TO FL500 MOV W, VA TO FL200 MOV S TO
        ESE
OBS VA DTG: 05/0010Z
OBS VA CLD: SFC/FL200 S0552 E10510 - S0552 E10605 - S0643
        E10655 - S0732 E10559 - S0654 E10419 MOV SE 10KT SFC/FL500
        S0623 E10548 - S0736 E10204 - S0702 E10046 - S0529 E10047 -
        S0448 E10304 - S0540 E10548 MOV W 40KT
FCST VA CLD +6 HR: 05/0610Z SFC/FL500 S0625 E10548 - S0910
        E09757 - S0604 E09634 SFC/FL200 S0546 E10511 - S0622 E10737
        - S0754 E10738
FCST VA CLD +12 HR: 05/1210Z NOT AVBL
FCST VA CLD +18 HR: 05/1810Z NOT AVBL
RMK: CONTINUOUS VA.
NXT ADVISORY: NO LATER THAN 20260905/0230Z=

######## b (BOM style, no indentation)
FVAU04 ADRM 040330
VA ADVISORY
DTG: 20260904/1025Z
ADVISORY NR: 2026/162
OBS VA DTG: 04/1000Z
OBS VA CLD: SFC/FL050 S0603 E10533 - S0726 E10439 - S0710
E10354 - S0625 E10350 - S0555 E10527 MOV SW 05KT
FCST VA CLD +6 HR: 04/1600Z SFC/FL050 S0611 E10530 - S0623
E10406 - S0542 E10342
RMK: X
NXT ADVISORY: NO LATER THAN 20260904/1625Z=
`

describe('parseCoordPair', () => {
  it('converts S0606 E10525 to decimal degrees', () => {
    expect(parseCoordPair('S0606', 'E10525')).toEqual([-6.1, 105.4167])
  })
})

describe('parseCloudLayers', () => {
  it('splits two layers with motion', () => {
    const layers = parseCloudLayers('SFC/FL200 S0552 E10510 - S0552 E10605 MOV SE 10KT SFC/FL500 S0623 E10548 - S0736 E10204 MOV W 40KT')
    expect(layers).toHaveLength(2)
    expect(layers[0]).toMatchObject({ topFl: 200, moveDeg: 135, moveKt: 10 })
    expect(layers[0].topKm).toBeCloseTo(6.096, 3)
    expect(layers[0].polygon).toEqual([[-5.8667, 105.1667], [-5.8667, 106.0833]])
    expect(layers[1]).toMatchObject({ topFl: 500, moveDeg: 270, moveKt: 40 })
  })
  it('returns [] for NOT AVBL', () => {
    expect(parseCloudLayers('NOT AVBL')).toEqual([])
  })
})

describe('parseVaacText', () => {
  const advisories = parseVaacText(SAMPLE)
  it('parses both blocks sorted by obs time', () => {
    expect(advisories.map(a => a.nr)).toEqual(['2026/162', '2026/171'])
  })
  it('parses times', () => {
    const a = advisories[1]
    expect(a.issuedUtc).toBe('2026-09-05T00:30:00Z')
    expect(a.obsUtc).toBe('2026-09-05T00:10:00Z')
  })
  it('parses obs layers across wrapped lines', () => {
    const a = advisories[1]
    expect(a.layers).toHaveLength(2)
    expect(a.layers[0].polygon).toHaveLength(5)
    expect(a.layers[1].polygon).toHaveLength(6)
    expect(a.layers[1].moveDeg).toBe(270)
  })
  it('parses forecasts and skips NOT AVBL', () => {
    const a = advisories[1]
    expect(a.forecasts.map(f => f.hours)).toEqual([6, 12, 18])
    expect(a.forecasts[0].validUtc).toBe('2026-09-05T06:10:00Z')
    expect(a.forecasts[0].layers.map(l => l.topFl)).toEqual([500, 200])
    expect(a.forecasts[1].layers).toEqual([])
  })
  it('handles BOM style continuation without indent', () => {
    expect(advisories[0].layers[0].polygon).toHaveLength(5)
    expect(advisories[0].layers[0].moveDeg).toBe(225)
  })
  it('parses the real raw file', () => {
    const text = readFileSync('data/raw/vaac/vaac-darwin-krakatau-2026-09.txt', 'utf8')
    const all = parseVaacText(text)
    expect(all.map(a => a.nr)).toEqual(['2026/162', '2026/164', '2026/171', '2026/175', '2026/179', '2026/183', '2026/184'])
    const last = all.at(-1)
    expect(last.obsUtc).toBe('2026-09-06T03:10:00Z')
    expect(last.layers.map(l => l.topFl)).toEqual([200, 500])
    expect(last.layers[0].polygon).toHaveLength(5)
    expect(last.layers[0].moveDeg).toBe(270)
    expect(last.layers[1].moveDeg).toBe(225)
  })
})
```

- [ ] **Step 2: Run → gagal** (`npx vitest run tests/engine/vaacParser.test.js`)

- [ ] **Step 3: Implement vaacParser.js**

```js
import { compassToDeg, flToKm } from './geo.js'

const FIELD_RE = /^(DTG|VAAC|VOLCANO|PSN|AREA|SOURCE ELEV|ADVISORY NR|INFO SOURCE|ERUPTION DETAILS|OBS VA DTG|OBS VA CLD|FCST VA CLD \+\d+ HR|RMK|NXT ADVISORY):\s*(.*)$/
const COORD_RE = /([SN])(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})/g
const MOV_RE = /MOV\s+([A-Z]{1,3})\s+(\d+)KT/
const DAYTIME_RE = /^(\d{2})\/(\d{2})(\d{2})Z/

export function parseCoordPair(latTok, lonTok) {
  const lat = (Number(latTok.slice(1, 3)) + Number(latTok.slice(3, 5)) / 60) * (latTok[0] === 'S' ? -1 : 1)
  const lon = (Number(lonTok.slice(1, 4)) + Number(lonTok.slice(4, 6)) / 60) * (lonTok[0] === 'W' ? -1 : 1)
  return [round4(lat), round4(lon)]
}

function round4(x) { return Math.round(x * 1e4) / 1e4 }

// "SFC/FL200 S.. E.. - S.. E.. MOV SE 10KT SFC/FL500 ..." → array layer
export function parseCloudLayers(str) {
  if (!str || /NOT AVBL/.test(str)) return []
  const chunks = str.split(/(?=SFC\/FL\d{3})/).map(s => s.trim()).filter(s => s.startsWith('SFC/FL'))
  return chunks.map(chunk => {
    const topFl = Number(chunk.slice(6, 9))
    const polygon = []
    for (const m of chunk.matchAll(COORD_RE)) polygon.push(parseCoordPair(m[1] + m[2] + m[3], m[4] + m[5] + m[6]))
    const mov = chunk.match(MOV_RE)
    const layer = { topFl, topKm: round4(flToKm(topFl)), polygon }
    if (mov) { layer.moveDeg = compassToDeg(mov[1]); layer.moveKt = Number(mov[2]) }
    return layer
  })
}

// "20260905/0030Z" → ISO
function parseDtg(s) {
  const m = s.match(/(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z/)
  if (!m) throw new Error(`Bad DTG: ${s}`)
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])).toISOString().replace('.000Z', 'Z')
}

// "05/0010Z" + tanggal acuan → ISO; kalau hari > hari acuan berarti bulan sebelumnya
function parseDayTime(s, refIso) {
  const m = s.match(DAYTIME_RE)
  if (!m) throw new Error(`Bad day/time: ${s}`)
  const ref = new Date(refIso)
  let y = ref.getUTCFullYear(), mo = ref.getUTCMonth()
  if (+m[1] > ref.getUTCDate() + 1) { mo -= 1; if (mo < 0) { mo = 11; y -= 1 } }
  return new Date(Date.UTC(y, mo, +m[1], +m[2], +m[3])).toISOString().replace('.000Z', 'Z')
}

// gabungkan baris lanjutan ke field terakhir (berdasarkan label, bukan indent)
function collectFields(block) {
  const fields = {}
  let current = null
  for (const raw of block.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(FIELD_RE)
    if (m) { current = m[1]; fields[current] = m[2] }
    else if (current) fields[current] += ' ' + line
  }
  return fields
}

export function parseVaacText(text) {
  const blocks = text.split(/^#{4,}.*$/m).map(b => b.trim()).filter(b => /ADVISORY NR:/.test(b))
  const advisories = blocks.map(block => {
    const f = collectFields(block)
    const nr = f['ADVISORY NR']
    if (!f['OBS VA CLD']) throw new Error(`Advisory ${nr}: missing OBS VA CLD`)
    const issuedUtc = parseDtg(f['DTG'])
    const obsUtc = parseDayTime(f['OBS VA DTG'], issuedUtc)
    const layers = parseCloudLayers(f['OBS VA CLD'])
    if (layers.length === 0) throw new Error(`Advisory ${nr}: no readable OBS VA CLD layer`)
    const forecasts = []
    for (const key of Object.keys(f)) {
      const fm = key.match(/^FCST VA CLD \+(\d+) HR$/)
      if (!fm) continue
      const val = f[key]
      const validUtc = parseDayTime(val, issuedUtc)
      forecasts.push({ hours: Number(fm[1]), validUtc, layers: parseCloudLayers(val.replace(DAYTIME_RE, '').trim()) })
    }
    forecasts.sort((a, b) => a.hours - b.hours)
    return { nr, issuedUtc, obsUtc, layers, forecasts }
  })
  advisories.sort((a, b) => a.obsUtc.localeCompare(b.obsUtc))
  return advisories
}
```

- [ ] **Step 4: Run → lulus, commit**

Run: `npx vitest run tests/engine/vaacParser.test.js` → PASS (9 tests). Kalau test "real raw file" gagal di `moveDeg` 184, cek file: `MOV W 10KT` (FL200) dan `MOV SW 20KT` (FL500).
```bash
git add src/engine/vaacParser.js tests/engine/vaacParser.test.js
git commit -m "Add VAAC advisory text parser"
```

---

### Task 4: Data curated + build-data.mjs → public/data

**Files:**
- Create: `data/curated/eruption-source.json`, `data/curated/events.json`, `data/curated/places.json`, `scripts/lib/buildWind.mjs`, `scripts/build-data.mjs`
- Test: `tests/scripts/buildWind.test.js`
- Output (di-commit): `public/data/wind.json`, `vaac.json`, `provinces.json`, `eruption-source.json`, `events.json`, `places.json`

**Interfaces:**
- Produces `buildWindDataset(points, { lats, lons, levels }) → WindDataset`:
  ```js
  WindDataset = { lats: number[] /* naik */, lons: number[] /* naik */, levels: [{name, altKm}] /* naik */,
                  times: string[] /* ISO UTC per jam */, u: number[], v: number[] /* m/s, flat */ }
  // indeks flat: ((t * L + l) * NLAT + i) * NLON + j
  ```
- Produces file JSON di `public/data/` yang dipakai `useDatasets` (Task 11). Bentuk `eruption-source.json`: `{ series: [{ timeUtc, heightKm, note }] }`. `events.json`: `{ events: [{ id, timeUtc, kind, title, description, location?, sourceUrl }] }`. `places.json`: `{ volcano, cities[], airports[] }`.

- [ ] **Step 1: Tulis data curated**

`data/curated/eruption-source.json` (spec §4.2):
```json
{
  "series": [
    { "timeUtc": "2026-09-04T00:00:00Z", "heightKm": 1.5, "note": "VAAC 162 FL050, background phase" },
    { "timeUtc": "2026-09-04T16:00:00Z", "heightKm": 2.1, "note": "VAAC 163 FL070" },
    { "timeUtc": "2026-09-04T16:30:00Z", "heightKm": 13.7, "note": "VAAC 164 FL450, major eruption from 23:07 WIB" },
    { "timeUtc": "2026-09-04T16:40:00Z", "heightKm": 14.6, "note": "VAAC 165 FL480" },
    { "timeUtc": "2026-09-04T17:50:00Z", "heightKm": 15.2, "note": "JMA/VAAC ~15 km, FL500 continuous (171-183)" },
    { "timeUtc": "2026-09-06T02:00:00Z", "heightKm": 6.1, "note": "VAAC 184: FL500 detached, continuous emission to FL200" }
  ]
}
```

`data/curated/places.json`:
```json
{
  "volcano": { "name": "Anak Krakatau", "lat": -6.102, "lon": 105.423 },
  "cities": [
    { "name": "Jakarta", "lat": -6.2, "lon": 106.85 },
    { "name": "Tangerang", "lat": -6.18, "lon": 106.63 },
    { "name": "Depok", "lat": -6.4, "lon": 106.82 },
    { "name": "Bogor", "lat": -6.6, "lon": 106.8 },
    { "name": "Serang", "lat": -6.12, "lon": 106.15 },
    { "name": "Bandar Lampung", "lat": -5.43, "lon": 105.26 },
    { "name": "Bandung", "lat": -6.91, "lon": 107.61 }
  ],
  "airports": [
    { "code": "CGK", "name": "Soekarno-Hatta", "lat": -6.125, "lon": 106.656 },
    { "code": "HLP", "name": "Halim Perdanakusuma", "lat": -6.267, "lon": 106.891 },
    { "code": "TKG", "name": "Radin Inten II", "lat": -5.24, "lon": 105.176 }
  ]
}
```

`data/curated/events.json` (teks Inggris; waktu UTC; sumber = `data/SOURCES.md`):
```json
{
  "events": [
    { "id": "eruption-start", "timeUtc": "2026-09-04T16:07:00Z", "kind": "eruption", "title": "Major eruption begins",
      "description": "Continuous lava fountaining starts at 23:07 WIB. Eruption tremor lasts six hours (amplitude 70 mm), the strongest activity of 2026.",
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "vaac-164", "timeUtc": "2026-09-04T16:30:00Z", "kind": "advisory", "title": "VAAC: ash to FL450 (13.7 km)",
      "description": "Darwin VAAC advisory 2026/164 reports a high-level eruption. Ten minutes later ash reaches FL480, moving west at 93 km/h.",
      "sourceUrl": "https://watchers.news/2026/09/04/high-level-eruption-at-anak-krakatau-ejects-ash-over-15-km-50-000-feet-a-s-l-indonesia/" },
    { "id": "plume-15km", "timeUtc": "2026-09-04T17:50:00Z", "kind": "eruption", "title": "Plume reaches ~15 km",
      "description": "JMA and Darwin VAAC estimate the ash column at 15 km (50,000 ft). A lower layer to about 5.5 km drifts south.",
      "sourceUrl": "https://watchers.news/2026/09/04/high-level-eruption-at-anak-krakatau-ejects-ash-over-15-km-50-000-feet-a-s-l-indonesia/" },
    { "id": "vaac-171", "timeUtc": "2026-09-05T00:10:00Z", "kind": "advisory", "title": "Two ash layers",
      "description": "VAAC 2026/171: ash to FL500 moving west at 40 kt; a separate layer to FL200 moving south to east-southeast at 10 kt.",
      "sourceUrl": "https://www.volcanodiscovery.com/krakatau/news/341700/vaac-advisory-2026-171.html" },
    { "id": "vona-red", "timeUtc": "2026-09-05T02:00:00Z", "kind": "advisory", "title": "VONA RED issued",
      "description": "PVMBG raises the aviation colour code to RED (MAGMA notice 22575).",
      "sourceUrl": "https://magma.esdm.go.id/v1/vona?code=KRA" },
    { "id": "ashfall-lampung", "timeUtc": "2026-09-05T09:00:00Z", "kind": "ashfall", "title": "Ashfall in Lampung",
      "description": "From Saturday afternoon into the night, residents of Bandar Lampung, Lampung Selatan, Pesawaran, Pringsewu, Tanggamus and Pesisir Barat find ash on vehicles and terraces.",
      "location": { "name": "Bandar Lampung", "lat": -5.43, "lon": 105.26 },
      "sourceUrl": "https://lampung77.com/lampung/hujan-abu-vulkanik-anak-krakatau-di-lampung-warga-keluhkan-mata-perih-hingga-imbauan-bpbd/" },
    { "id": "ashfall-serang", "timeUtc": "2026-09-05T10:00:00Z", "kind": "ashfall", "title": "Ashfall on the Serang coast",
      "description": "From 17:00 WIB dust settles in Kampung Pasauran, Cinangka. Motorcyclists report stinging eyes; a school reports disrupted attendance.",
      "location": { "name": "Cinangka, Serang", "lat": -6.24, "lon": 105.84 },
      "sourceUrl": "https://koran-jakarta.com/2026-09-06/hujan-abu-anak-krakatau-melanda-serang-mata-warga-perih-hingga-sekolah-terganggu" },
    { "id": "vaac-179", "timeUtc": "2026-09-05T16:10:00Z", "kind": "advisory", "title": "VAAC cloud reaches Jakarta",
      "description": "Advisory 2026/179: the low-level (FL200) ash cloud now extends over Jakarta and West Java, moving SE at 10 kt. The FL500 cloud keeps moving west at 30 kt.",
      "sourceUrl": "https://www.volcanodiscovery.com/krakatau/news/342083/vaac-advisory-2026-179.html" },
    { "id": "cgk-closed", "timeUtc": "2026-09-05T18:30:00Z", "kind": "aviation", "title": "Soekarno-Hatta closed",
      "description": "NOTAM A3341/26 closes CGK from 01:30 WIB. The closure is extended to 05:30, 09:30 and finally 13:30 WIB; 209 movements and about 22,800 passengers affected.",
      "location": { "name": "Soekarno-Hatta (CGK)", "lat": -6.125, "lon": 106.656 },
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "eruption-0353", "timeUtc": "2026-09-05T20:53:00Z", "kind": "eruption", "title": "Further eruption at 03:53 WIB",
      "description": "Discrete eruption recorded with maximum amplitude 46 mm, duration 30 s.",
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "bmkg-clusters", "timeUtc": "2026-09-05T21:00:00Z", "kind": "report", "title": "BMKG: two ash clusters",
      "description": "Himawari-9 analysis at 04:00 WIB: cluster 1 (surface to 20,000 ft) over parts of Jakarta, Bogor, Depok, Banten and West Java; cluster 2 (to 50,000 ft) toward Lampung, Bengkulu and the Indian Ocean.",
      "sourceUrl": "https://news.detik.com/berita/d-8650368/bmkg-ungkap-2-klaster-sebaran-abu-anak-krakatau-arah-lampung-dan-jakarta" },
    { "id": "ashfall-jakarta", "timeUtc": "2026-09-05T22:30:00Z", "kind": "ashfall", "title": "Ash noticed in Jakarta",
      "description": "At dawn, residents in South Jakarta and Cilangkap (East Jakarta) find dust on floors, terraces and freshly washed vehicles, and report the air feels heavier.",
      "location": { "name": "Cilangkap, East Jakarta", "lat": -6.34, "lon": 106.9 },
      "sourceUrl": "https://www.liputan6.com/news/read/8285637/abu-anak-krakatau-sampai-jakarta-warga-mengeluh-udara-lebih-sesak" },
    { "id": "tkg-closed", "timeUtc": "2026-09-06T00:00:00Z", "kind": "aviation", "title": "Lampung airport closed",
      "description": "Radin Inten II suspends operations from 07:00 to 10:00 WIB.",
      "location": { "name": "Radin Inten II (TKG)", "lat": -5.24, "lon": 105.176 },
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "eruption-0710", "timeUtc": "2026-09-06T00:10:00Z", "kind": "eruption", "title": "Eruption at 07:10 WIB",
      "description": "Maximum amplitude 50 mm, duration 16 s. Column height not observed.",
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "hlp-closed", "timeUtc": "2026-09-06T00:20:00Z", "kind": "aviation", "title": "Halim Perdanakusuma closed",
      "description": "HLP closes at 07:20 WIB (NOTAM A3345/26), estimated reopening 10:00 WIB.",
      "location": { "name": "Halim Perdanakusuma (HLP)", "lat": -6.267, "lon": 106.891 },
      "sourceUrl": "https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport" },
    { "id": "vaac-184", "timeUtc": "2026-09-06T03:10:00Z", "kind": "advisory", "title": "VAAC: high-level cloud detaches",
      "description": "Advisory 2026/184: the FL500 cloud is detached from the volcano and moving SW. Continuous emission to FL200 now moves west, while remnants of earlier ash still drift east.",
      "sourceUrl": "https://www.bom.gov.au/aviation/volcanic-ash/darwin-va-advisory.shtml" }
  ]
}
```

- [ ] **Step 2: Test buildWind (gagal dulu)**

`tests/scripts/buildWind.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildWindDataset, windIndex } from '../../scripts/lib/buildWind.mjs'

// 2 titik (lat -6 & -5 di lon 105), 2 level, 2 jam
function point(lat, lon, spd850, dir850, spd700, dir700) {
  return { latitude: lat + 0.03, longitude: lon - 0.02, hourly: {
    time: ['2026-09-04T00:00', '2026-09-04T01:00'],
    wind_speed_850hPa: [spd850, spd850], wind_direction_850hPa: [dir850, dir850],
    wind_speed_700hPa: [spd700, spd700], wind_direction_700hPa: [dir700, dir700],
  } }
}
const levels = [{ name: '850hPa', altKm: 1.5 }, { name: '700hPa', altKm: 3.0 }]

describe('buildWindDataset', () => {
  const points = [point(-5, 105, 36, 90, 18, 180), point(-6, 105, 36, 270, 18, 0)] // urutan acak sengaja
  const ds = buildWindDataset(points, { lats: [-6, -5], lons: [105], levels })
  it('normalizes times to ISO Z', () => {
    expect(ds.times).toEqual(['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z'])
  })
  it('converts km/h + direction to u,v m/s in [t][level][lat][lon] order', () => {
    // lat -6 (i=0), 850hPa (l=0), t=0: dari barat 36 km/h → u=+10
    expect(ds.u[windIndex(ds, 0, 0, 0, 0)]).toBeCloseTo(10, 2)
    expect(ds.v[windIndex(ds, 0, 0, 0, 0)]).toBeCloseTo(0, 2)
    // lat -5 (i=1), 850hPa: dari timur → u=-10
    expect(ds.u[windIndex(ds, 0, 0, 1, 0)]).toBeCloseTo(-10, 2)
    // lat -5, 700hPa (l=1): dari selatan 18 km/h → v=+5
    expect(ds.v[windIndex(ds, 0, 1, 1, 0)]).toBeCloseTo(5, 2)
  })
  it('has the right lengths', () => {
    expect(ds.u).toHaveLength(2 * 2 * 2 * 1)
    expect(ds.levels).toEqual(levels)
  })
  it('throws when a grid point is missing', () => {
    expect(() => buildWindDataset(points, { lats: [-6, -5, -4], lons: [105], levels })).toThrow(/missing/i)
  })
})
```

- [ ] **Step 3: Run → gagal**, lalu **implement `scripts/lib/buildWind.mjs`**

```js
import { windFromToUV } from '../../src/engine/geo.js'

export function windIndex(ds, t, l, i, j) {
  return ((t * ds.levels.length + l) * ds.lats.length + i) * ds.lons.length + j
}

function key(lat, lon) { return `${Math.round(lat)},${Math.round(lon)}` }

function toIsoZ(s) { return s.length === 16 ? `${s}:00Z` : s.endsWith('Z') ? s : `${s}Z` }

// points = array respons Open-Meteo (multi-lokasi). lats/lons harus urut naik.
export function buildWindDataset(points, { lats, lons, levels }) {
  const byKey = new Map(points.map(p => [key(p.latitude, p.longitude), p]))
  const times = points[0].hourly.time.map(toIsoZ)
  const NT = times.length, NL = levels.length, NLAT = lats.length, NLON = lons.length
  const u = new Array(NT * NL * NLAT * NLON), v = new Array(NT * NL * NLAT * NLON)
  const ds = { lats, lons, levels, times, u, v }
  for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) {
    const p = byKey.get(key(lats[i], lons[j]))
    if (!p) throw new Error(`Missing grid point lat=${lats[i]} lon=${lons[j]}`)
    for (let l = 0; l < NL; l++) {
      const spd = p.hourly[`wind_speed_${levels[l].name}`], dir = p.hourly[`wind_direction_${levels[l].name}`]
      if (!spd || spd.length !== NT) throw new Error(`Missing level ${levels[l].name} at ${key(lats[i], lons[j])}`)
      for (let t = 0; t < NT; t++) {
        const { u: uu, v: vv } = windFromToUV(dir[t], spd[t] / 3.6)
        const k = windIndex(ds, t, l, i, j)
        u[k] = Math.round(uu * 100) / 100; v[k] = Math.round(vv * 100) / 100
      }
    }
  }
  return ds
}
```

- [ ] **Step 4: Run → lulus** (`npx vitest run tests/scripts/buildWind.test.js`)

- [ ] **Step 5: Tulis `scripts/build-data.mjs`**

```js
// raw + curated → public/data/*.json (hasil di-commit)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWindDataset } from './lib/buildWind.mjs'
import { parseVaacText } from '../src/engine/vaacParser.js'
import { simConfig } from '../src/config/simConfig.js'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = resolve(ROOT, 'public/data')
mkdirSync(OUT, { recursive: true })

const { domain, levels } = simConfig
const lats = Array.from({ length: domain.latMax - domain.latMin + 1 }, (_, k) => domain.latMin + k)
const lons = Array.from({ length: domain.lonMax - domain.lonMin + 1 }, (_, k) => domain.lonMin + k)

const points = JSON.parse(readFileSync(resolve(ROOT, 'data/raw/wind/open-meteo-grid-1deg-2026-09-04_07.json'), 'utf8'))
const wind = buildWindDataset(points, { lats, lons, levels })
writeFileSync(resolve(OUT, 'wind.json'), JSON.stringify(wind))
console.log(`wind.json: ${wind.times.length} h x ${levels.length} lv x ${lats.length}x${lons.length}`)

const vaac = parseVaacText(readFileSync(resolve(ROOT, 'data/raw/vaac/vaac-darwin-krakatau-2026-09.txt'), 'utf8'))
writeFileSync(resolve(OUT, 'vaac.json'), JSON.stringify(vaac, null, 1))
console.log(`vaac.json: ${vaac.map(a => a.nr).join(', ')}`)

copyFileSync(resolve(ROOT, 'data/raw/geo/indonesia-province-simple.json'), resolve(OUT, 'provinces.json'))
for (const name of ['eruption-source', 'events', 'places']) {
  const json = JSON.parse(readFileSync(resolve(ROOT, `data/curated/${name}.json`), 'utf8')) // validasi JSON
  writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(json, null, 1))
}
console.log('done')
```

- [ ] **Step 6: Jalankan & cek hasil**

Run: `npm run build:data`
Expected: log `wind.json: 96 h x 7 lv x 10x13`, `vaac.json: 2026/162, …, 2026/184`, `done`. Cek ukuran: `ls -la public/data` → wind.json ≈ 1,2 MB, vaac.json < 50 KB.

- [ ] **Step 7: Commit**

```bash
git add data/curated scripts tests/scripts public/data
git commit -m "Add curated event data and build-data pipeline"
```

---

### Task 5: windField (interpolasi 4D)

**Files:**
- Create: `src/engine/windField.js`
- Test: `tests/engine/windField.test.js`

**Interfaces:**
- Consumes: `WindDataset` (Task 4).
- Produces: `createWindField(dataset) → { sample(lat, lon, altKm, tMs) → {u, v} | null, timeStartMs, timeEndMs, bounds: {latMin, latMax, lonMin, lonMax}, levels, lats, lons, uvAt(t, l, i, j) → {u, v} }`. `sample` = bilinear lat/lon, linear ketinggian (clamp di bawah level terendah / di atas tertinggi), linear waktu; `null` kalau lat/lon di luar grid atau waktu di luar `[timeStartMs, timeEndMs]`. `uvAt` dipakai `WindArrowLayer` (Task 15).

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/windField.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createWindField } from '../../src/engine/windField.js'

// grid 2x2 (lat -7,-6; lon 105,106), 2 level, 2 jam; u = kode unik per sel biar gampang dicek
const levels = [{ name: '850hPa', altKm: 1.5 }, { name: '700hPa', altKm: 3.0 }]
const times = ['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z']
const ds = { lats: [-7, -6], lons: [105, 106], levels, times, u: [], v: [] }
for (let t = 0; t < 2; t++) for (let l = 0; l < 2; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
  ds.u.push(t * 1000 + l * 100 + i * 10 + j) // t=0,l=0,i=0,j=0 → 0 ; i=1 → 10 ; j=1 → 1
  ds.v.push(1)
}
const T0 = Date.parse(times[0])
const wf = createWindField(ds)

describe('createWindField', () => {
  it('returns exact value at grid nodes', () => {
    expect(wf.sample(-7, 105, 1.5, T0).u).toBeCloseTo(0, 6)
    expect(wf.sample(-6, 106, 1.5, T0).u).toBeCloseTo(11, 6)
    expect(wf.sample(-6, 106, 3.0, T0).u).toBeCloseTo(111, 6)
    expect(wf.sample(-6, 106, 3.0, T0 + 3600e3).u).toBeCloseTo(1111, 6)
  })
  it('averages at the horizontal cell centre', () => {
    expect(wf.sample(-6.5, 105.5, 1.5, T0).u).toBeCloseTo((0 + 1 + 10 + 11) / 4, 6)
  })
  it('interpolates linearly in altitude and clamps outside the level range', () => {
    expect(wf.sample(-7, 105, 2.25, T0).u).toBeCloseTo(50, 6)
    expect(wf.sample(-7, 105, 0, T0).u).toBeCloseTo(0, 6)
    expect(wf.sample(-7, 105, 20, T0).u).toBeCloseTo(100, 6)
  })
  it('interpolates linearly in time', () => {
    expect(wf.sample(-7, 105, 1.5, T0 + 1800e3).u).toBeCloseTo(500, 6)
  })
  it('returns null outside the domain or time range', () => {
    expect(wf.sample(-8, 105, 1.5, T0)).toBeNull()
    expect(wf.sample(-7, 107, 1.5, T0)).toBeNull()
    expect(wf.sample(-7, 105, 1.5, T0 - 1)).toBeNull()
    expect(wf.sample(-7, 105, 1.5, T0 + 3600e3 + 1)).toBeNull()
  })
  it('exposes bounds and time range', () => {
    expect(wf.bounds).toEqual({ latMin: -7, latMax: -6, lonMin: 105, lonMax: 106 })
    expect(wf.timeStartMs).toBe(T0); expect(wf.timeEndMs).toBe(T0 + 3600e3)
    expect(wf.uvAt(1, 1, 1, 1)).toEqual({ u: 1111, v: 1 })
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement windField.js**

```js
// Interpolasi angin 4D dari WindDataset (lihat scripts/lib/buildWind.mjs untuk layout)
export function createWindField(ds) {
  const lats = ds.lats, lons = ds.lons, levels = ds.levels
  const u = ds.u instanceof Float32Array ? ds.u : Float32Array.from(ds.u)
  const v = ds.v instanceof Float32Array ? ds.v : Float32Array.from(ds.v)
  const timeMs = ds.times.map(s => Date.parse(s))
  const NT = timeMs.length, NL = levels.length, NLAT = lats.length, NLON = lons.length
  const dLat = lats[1] - lats[0], dLon = lons[1] - lons[0], dT = timeMs[1] - timeMs[0]
  const bounds = { latMin: lats[0], latMax: lats[NLAT - 1], lonMin: lons[0], lonMax: lons[NLON - 1] }
  const altKm = levels.map(l => l.altKm)

  const idx = (t, l, i, j) => ((t * NL + l) * NLAT + i) * NLON + j

  function sample(lat, lon, alt, tMs) {
    if (lat < bounds.latMin || lat > bounds.latMax || lon < bounds.lonMin || lon > bounds.lonMax) return null
    if (tMs < timeMs[0] || tMs > timeMs[NT - 1]) return null
    // waktu
    let t0 = Math.min(NT - 2, Math.floor((tMs - timeMs[0]) / dT)); const ft = (tMs - timeMs[t0]) / dT
    // ketinggian (clamp)
    let l0 = 0
    if (alt >= altKm[NL - 1]) l0 = NL - 2
    else while (l0 < NL - 2 && alt >= altKm[l0 + 1]) l0++
    let fl = (alt - altKm[l0]) / (altKm[l0 + 1] - altKm[l0]); fl = Math.min(1, Math.max(0, fl))
    // horizontal
    let i0 = Math.min(NLAT - 2, Math.floor((lat - lats[0]) / dLat)); const fi = (lat - lats[i0]) / dLat
    let j0 = Math.min(NLON - 2, Math.floor((lon - lons[0]) / dLon)); const fj = (lon - lons[j0]) / dLon
    let su = 0, sv = 0
    for (let dt = 0; dt < 2; dt++) {
      const wt = dt ? ft : 1 - ft; if (!wt) continue
      for (let dl = 0; dl < 2; dl++) {
        const wl = dl ? fl : 1 - fl; if (!wl) continue
        for (let di = 0; di < 2; di++) {
          const wi = di ? fi : 1 - fi; if (!wi) continue
          for (let dj = 0; dj < 2; dj++) {
            const wj = dj ? fj : 1 - fj; if (!wj) continue
            const w = wt * wl * wi * wj, k = idx(t0 + dt, l0 + dl, i0 + di, j0 + dj)
            su += w * u[k]; sv += w * v[k]
          }
        }
      }
    }
    return { u: su, v: sv }
  }

  return {
    sample, bounds, levels, lats, lons,
    timeStartMs: timeMs[0], timeEndMs: timeMs[NT - 1],
    uvAt: (t, l, i, j) => ({ u: u[idx(t, l, i, j)], v: v[idx(t, l, i, j)] }),
  }
}
```

- [ ] **Step 3: Run → lulus, commit**

```bash
git add src/engine/windField.js tests/engine/windField.test.js
git commit -m "Add 4D wind field interpolation"
```

---

### Task 6: eruptionSource

**Files:**
- Create: `src/engine/eruptionSource.js`
- Test: `tests/engine/eruptionSource.test.js`

**Interfaces:**
- Consumes: `eruption-source.json` `series`, `simConfig.emission`.
- Produces: `createEruptionSource(series, emission) → { plumeHeightAt(tMs) → km, emissionCountAt(tMs, dtSec) → number (bisa pecahan) }`.

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/eruptionSource.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createEruptionSource } from '../../src/engine/eruptionSource.js'
import { simConfig } from '../../src/config/simConfig.js'

const series = [
  { timeUtc: '2026-09-04T00:00:00Z', heightKm: 1.5 },
  { timeUtc: '2026-09-04T16:30:00Z', heightKm: 13.7 },
  { timeUtc: '2026-09-04T17:50:00Z', heightKm: 15.2 },
  { timeUtc: '2026-09-06T02:00:00Z', heightKm: 6.1 },
]
const src = createEruptionSource(series, simConfig.emission)
const T = s => Date.parse(s)

describe('createEruptionSource', () => {
  it('holds the height until the next point (step function)', () => {
    expect(src.plumeHeightAt(T('2026-09-04T10:00:00Z'))).toBe(1.5)
    expect(src.plumeHeightAt(T('2026-09-04T16:30:00Z'))).toBe(13.7)
    expect(src.plumeHeightAt(T('2026-09-04T17:00:00Z'))).toBe(13.7)
    expect(src.plumeHeightAt(T('2026-09-05T12:00:00Z'))).toBe(15.2)
    expect(src.plumeHeightAt(T('2026-09-06T23:00:00Z'))).toBe(6.1)
  })
  it('uses the first height before the series starts', () => {
    expect(src.plumeHeightAt(T('2026-09-03T00:00:00Z'))).toBe(1.5)
  })
  it('emission scales with (H/ref)^2, floored at minFactor, per 600 s', () => {
    expect(src.emissionCountAt(T('2026-09-05T12:00:00Z'), 600)).toBeCloseTo(60, 6)
    expect(src.emissionCountAt(T('2026-09-05T12:00:00Z'), 300)).toBeCloseTo(30, 6)
    expect(src.emissionCountAt(T('2026-09-04T10:00:00Z'), 600)).toBeCloseTo(60 * 0.05, 6) // (1.5/15.2)^2 < 0.05
    expect(src.emissionCountAt(T('2026-09-06T12:00:00Z'), 600)).toBeCloseTo(60 * (6.1 / 15.2) ** 2, 6)
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement eruptionSource.js**

```js
// Deret tinggi kolom (tangga) → laju emisi partikel (spec §4.2)
export function createEruptionSource(series, emission) {
  const pts = series.map(s => ({ tMs: Date.parse(s.timeUtc), h: s.heightKm })).sort((a, b) => a.tMs - b.tMs)
  if (pts.length === 0) throw new Error('eruption series is empty')

  function plumeHeightAt(tMs) {
    let h = pts[0].h
    for (const p of pts) { if (p.tMs <= tMs) h = p.h; else break }
    return h
  }

  function emissionCountAt(tMs, dtSec) {
    const h = plumeHeightAt(tMs)
    const factor = Math.max(emission.minFactor, (h / emission.refHeightKm) ** 2)
    return emission.basePerStep * factor * (dtSec / 600)
  }

  return { plumeHeightAt, emissionCountAt }
}
```

- [ ] **Step 3: Run → lulus, commit**

```bash
git add src/engine/eruptionSource.js tests/engine/eruptionSource.test.js
git commit -m "Add eruption source height series and emission rate"
```

---

### Task 7: vaacAdvisories (advisory terakhir + vektor gerak per lapisan)

**Files:**
- Create: `src/engine/vaacAdvisories.js`
- Test: `tests/engine/vaacAdvisories.test.js`

**Interfaces:**
- Consumes: `Advisory[]` (Task 3), `headingToUV` (Task 2).
- Produces: `createVaacAdvisories(advisories) → { latestObsAt(tMs) → Advisory | null, layerForAltitude(advisory, altKm) → layer, layerMotionAt(tMs, altKm) → {u, v} m/s | null, all: Advisory[] }`. Pemilihan lapisan: lapisan dengan `topKm` terkecil yang `>= altKm`; kalau tidak ada, lapisan tertinggi. Advisory satu lapisan → lapisan itu untuk semua ketinggian.

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/vaacAdvisories.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createVaacAdvisories } from '../../src/engine/vaacAdvisories.js'

const KT = 0.514444
const advisories = [
  { nr: '2026/162', obsUtc: '2026-09-04T10:00:00Z', issuedUtc: '2026-09-04T10:25:00Z', forecasts: [],
    layers: [{ topFl: 50, topKm: 1.524, polygon: [], moveDeg: 225, moveKt: 5 }] },
  { nr: '2026/171', obsUtc: '2026-09-05T00:10:00Z', issuedUtc: '2026-09-05T00:30:00Z', forecasts: [],
    layers: [{ topFl: 200, topKm: 6.096, polygon: [], moveDeg: 135, moveKt: 10 },
             { topFl: 500, topKm: 15.24, polygon: [], moveDeg: 270, moveKt: 40 }] },
]
const va = createVaacAdvisories(advisories)
const T = s => Date.parse(s)

describe('createVaacAdvisories', () => {
  it('latestObsAt picks the last advisory at or before t', () => {
    expect(va.latestObsAt(T('2026-09-04T09:59:00Z'))).toBeNull()
    expect(va.latestObsAt(T('2026-09-04T10:00:00Z')).nr).toBe('2026/162')
    expect(va.latestObsAt(T('2026-09-05T03:00:00Z')).nr).toBe('2026/171')
  })
  it('chooses the layer by altitude', () => {
    const a = va.latestObsAt(T('2026-09-05T03:00:00Z'))
    expect(va.layerForAltitude(a, 3).topFl).toBe(200)
    expect(va.layerForAltitude(a, 6.096).topFl).toBe(200)
    expect(va.layerForAltitude(a, 10).topFl).toBe(500)
    expect(va.layerForAltitude(a, 20).topFl).toBe(500)
  })
  it('single-layer advisory applies to all altitudes', () => {
    const a = va.latestObsAt(T('2026-09-04T12:00:00Z'))
    expect(va.layerForAltitude(a, 12).topFl).toBe(50)
  })
  it('layerMotionAt returns m/s vector toward the movement heading', () => {
    const low = va.layerMotionAt(T('2026-09-05T03:00:00Z'), 3)
    expect(low.u).toBeCloseTo(10 * KT * Math.SQRT1_2, 4); expect(low.v).toBeCloseTo(-10 * KT * Math.SQRT1_2, 4)
    const high = va.layerMotionAt(T('2026-09-05T03:00:00Z'), 12)
    expect(high.u).toBeCloseTo(-40 * KT, 4); expect(high.v).toBeCloseTo(0, 4)
    expect(va.layerMotionAt(T('2026-09-04T00:00:00Z'), 3)).toBeNull()
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement vaacAdvisories.js**

```js
import { headingToUV } from './geo.js'

const MPS_PER_KT = 0.514444

export function createVaacAdvisories(advisories) {
  const all = advisories
    .map(a => ({ ...a, obsMs: Date.parse(a.obsUtc), layers: [...a.layers].sort((x, y) => x.topKm - y.topKm) }))
    .sort((a, b) => a.obsMs - b.obsMs)

  function latestObsAt(tMs) {
    let found = null
    for (const a of all) { if (a.obsMs <= tMs) found = a; else break }
    return found
  }

  // lapisan dengan puncak terendah yang masih >= altKm; kalau semua di bawah, ambil tertinggi
  function layerForAltitude(advisory, altKm) {
    return advisory.layers.find(l => l.topKm >= altKm) ?? advisory.layers[advisory.layers.length - 1]
  }

  function layerMotionAt(tMs, altKm) {
    const a = latestObsAt(tMs)
    if (!a) return null
    const layer = layerForAltitude(a, altKm)
    if (layer.moveDeg == null || layer.moveKt == null) return null
    return headingToUV(layer.moveDeg, layer.moveKt * MPS_PER_KT)
  }

  return { all, latestObsAt, layerForAltitude, layerMotionAt }
}
```

- [ ] **Step 3: Run → lulus, commit**

```bash
git add src/engine/vaacAdvisories.js tests/engine/vaacAdvisories.test.js
git commit -m "Add VAAC advisory lookup and layer motion vectors"
```

---

### Task 8: deposition grid

**Files:**
- Create: `src/engine/deposition.js`
- Test: `tests/engine/deposition.test.js`

**Interfaces:**
- Produces: `createDepositionGrid({ latMin, latMax, lonMin, lonMax, cellDeg }) → { rows, cols, cellDeg, latMin, lonMin, values: Float32Array, cellIndex(lat, lon) → int | -1, add(lat, lon, weight), max() → number, snapshot() → Float32Array, restore(arr), reset() }`. Baris 0 = `latMin` (selatan), kolom 0 = `lonMin`.

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/deposition.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createDepositionGrid } from '../../src/engine/deposition.js'

describe('createDepositionGrid', () => {
  const grid = createDepositionGrid({ latMin: -11, latMax: -2, lonMin: 100, lonMax: 112, cellDeg: 0.1 })
  it('has 90 rows x 120 cols', () => {
    expect(grid.rows).toBe(90); expect(grid.cols).toBe(120); expect(grid.values).toHaveLength(10800)
  })
  it('maps lat/lon to a cell, row 0 at the south edge', () => {
    expect(grid.cellIndex(-11, 100)).toBe(0)
    expect(grid.cellIndex(-10.95, 100.05)).toBe(0)
    expect(grid.cellIndex(-10.85, 100.05)).toBe(120)
    expect(grid.cellIndex(-2, 112)).toBe(10800 - 1) // tepi atas/kanan masuk sel terakhir
    expect(grid.cellIndex(-12, 100)).toBe(-1)
    expect(grid.cellIndex(-6, 113)).toBe(-1)
  })
  it('accumulates weights and reports max', () => {
    grid.add(-6.2, 106.85, 0.5); grid.add(-6.2, 106.85, 1.0); grid.add(-20, 106, 5)
    expect(grid.values[grid.cellIndex(-6.2, 106.85)]).toBeCloseTo(1.5, 6)
    expect(grid.max()).toBeCloseTo(1.5, 6)
  })
  it('snapshot/restore/reset', () => {
    const snap = grid.snapshot(); grid.reset(); expect(grid.max()).toBe(0)
    grid.restore(snap); expect(grid.max()).toBeCloseTo(1.5, 6)
    expect(snap).not.toBe(grid.values)
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement deposition.js**

```js
// Grid endapan kumulatif, satuan relatif (bobot kelas partikel)
export function createDepositionGrid({ latMin, latMax, lonMin, lonMax, cellDeg }) {
  const rows = Math.round((latMax - latMin) / cellDeg)
  const cols = Math.round((lonMax - lonMin) / cellDeg)
  const values = new Float32Array(rows * cols)

  function cellIndex(lat, lon) {
    if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return -1
    const r = Math.min(rows - 1, Math.floor((lat - latMin) / cellDeg + 1e-9))
    const c = Math.min(cols - 1, Math.floor((lon - lonMin) / cellDeg + 1e-9))
    return r * cols + c
  }

  return {
    rows, cols, cellDeg, latMin, lonMin, values,
    cellIndex,
    add(lat, lon, weight) { const k = cellIndex(lat, lon); if (k >= 0) values[k] += weight },
    max() { let m = 0; for (let k = 0; k < values.length; k++) if (values[k] > m) m = values[k]; return m },
    snapshot() { return Float32Array.from(values) },
    restore(arr) { values.set(arr) },
    reset() { values.fill(0) },
  }
}
```

- [ ] **Step 3: Run → lulus, commit**

```bash
git add src/engine/deposition.js tests/engine/deposition.test.js
git commit -m "Add deposition grid"
```

---

### Task 9: particleSystem

**Files:**
- Create: `src/engine/particleSystem.js`
- Test: `tests/engine/particleSystem.test.js`

**Interfaces:**
- Consumes: `windField.sample/timeStartMs/timeEndMs` (Task 5), `eruptionSource.plumeHeightAt/emissionCountAt` (Task 6), `vaacAdvisories.layerMotionAt` (Task 7), `deposition.add/snapshot/restore` (Task 8), `prng` (Task 2), `simConfig`.
- Produces: `createParticleSystem({ config, windField, eruptionSource, vaacAdvisories, deposition, prng })` →
  ```js
  { get timeMs, get aliveCount, maxParticles,
    reset(tMs),                       // kosongkan semua, set waktu
    spawn(lat, lon, altKm, classIndex) → index | -1,
    advance(dtSec),                   // emisi + gerak + endapan, lalu timeMs += dtSec*1000
    getFrame() → Float32Array,        // [lon, lat, altKm, ageHours] × aliveCount
    saveKeyframe() → Keyframe, restoreKeyframe(kf) }
  ```
  Keyframe = `{ timeMs, carry, prngState, lonQ: Int16Array(×100), latQ: Int16Array(×100), altQ: Uint8Array(×10), cls, alive, bornQ: Uint16Array (10-menit sejak start), free: Uint16Array, deposition: Float32Array }`.

Aturan per langkah persis spec §4.3. Nudge VAAC dihitung **sekali per langkah** untuk dua lapisan (`altKm ≤ config.lowLayerTopKm` → lapisan rendah, selain itu tinggi), bukan per partikel.

- [ ] **Step 1: Test (gagal dulu)**

`tests/engine/particleSystem.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createParticleSystem } from '../../src/engine/particleSystem.js'
import { createPrng } from '../../src/engine/prng.js'
import { createDepositionGrid } from '../../src/engine/deposition.js'
import { simConfig } from '../../src/config/simConfig.js'
import { metersPerDegLon } from '../../src/engine/geo.js'

const T0 = Date.parse(simConfig.startUtc)
const uniformWind = (u, v) => ({ sample: (lat, lon) => (lon > 111 ? null : { u, v }), timeStartMs: -Infinity, timeEndMs: Infinity })
const noVaac = { layerMotionAt: () => null }
const quietSource = { plumeHeightAt: () => 5, emissionCountAt: () => 0 }
const noDiffusion = { ...simConfig, maxParticles: 100, diffusion: { horizontalM2s: 0, verticalSigmaMPerStep: 0 }, vaacNudge: 0 }

function build({ config = noDiffusion, wind = uniformWind(10, 0), source = quietSource, vaac = noVaac, seed = 1 } = {}) {
  const deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
  const system = createParticleSystem({ config, windField: wind, eruptionSource: source, vaacAdvisories: vaac, deposition, prng: createPrng(seed) })
  system.reset(T0)
  return { system, deposition }
}

describe('createParticleSystem', () => {
  it('advects a particle with uniform eastward wind (~0.325° per hour at 6°S)', () => {
    const { system } = build()
    system.spawn(-6, 105, 3, 0)
    for (let i = 0; i < 6; i++) system.advance(600)
    const f = system.getFrame()
    expect(system.aliveCount).toBe(1)
    expect(f[0]).toBeCloseTo(105 + 36000 / metersPerDegLon(-6), 2)
    expect(f[1]).toBeCloseTo(-6, 3)
    expect(f[2]).toBeCloseTo(3 - 0.01 * 3600 / 1000, 3) // fine settles 36 m
    expect(f[3]).toBeCloseTo(1, 6) // umur 1 jam
    expect(system.timeMs).toBe(T0 + 3600e3)
  })
  it('coarse particle from 1 km deposits after ~33 min with weight 1.0', () => {
    const { system, deposition } = build({ wind: uniformWind(0, 0) })
    system.spawn(-6.2, 106.85, 1, 2)
    for (let i = 0; i < 3; i++) system.advance(600)
    expect(system.aliveCount).toBe(1)
    system.advance(600)
    expect(system.aliveCount).toBe(0)
    expect(deposition.values[deposition.cellIndex(-6.2, 106.85)]).toBeCloseTo(1.0, 6)
  })
  it('emits with fractional carry and assigns altitudes within [0.1H, H]', () => {
    const source = { plumeHeightAt: () => 10, emissionCountAt: () => 2.5 }
    const { system } = build({ source })
    system.advance(600); expect(system.aliveCount).toBe(2)
    system.advance(600); expect(system.aliveCount).toBe(5)
    const f = system.getFrame()
    for (let k = 0; k < system.aliveCount; k++) { expect(f[k * 4 + 2]).toBeGreaterThan(0.9); expect(f[k * 4 + 2]).toBeLessThanOrEqual(10) }
  })
  it('kills particles when wind is unavailable or outside the domain', () => {
    const { system } = build()
    system.spawn(-6, 111.05, 3, 0) // angin null di lon > 111
    system.advance(600)
    expect(system.aliveCount).toBe(0)
    const { system: s2 } = build({ wind: uniformWind(0, 200) })
    s2.spawn(-2.05, 105, 3, 0) // 200 m/s ke utara keluar domain
    s2.advance(600)
    expect(s2.aliveCount).toBe(0)
  })
  it('applies the VAAC nudge as a velocity blend', () => {
    const cfg = { ...noDiffusion, vaacNudge: 0.5 }
    const vaac = { layerMotionAt: (t, alt) => (alt <= cfg.lowLayerTopKm ? { u: -10, v: 0 } : { u: 30, v: 0 }) }
    const { system } = build({ config: cfg, vaac })
    system.spawn(-6, 105, 3, 0); system.spawn(-6, 105, 10, 0)
    system.advance(600)
    const f = system.getFrame()
    // rendah: 0.5*10 + 0.5*(-10) = 0 → diam ; tinggi: 0.5*10 + 0.5*30 = 20 m/s → 12 km
    expect(f[0]).toBeCloseTo(105, 4)
    expect(f[4]).toBeCloseTo(105 + 12000 / metersPerDegLon(-6), 3)
  })
  it('is deterministic for the same seed with diffusion on', () => {
    const cfg = { ...simConfig, maxParticles: 500 }
    const source = { plumeHeightAt: () => 8, emissionCountAt: () => 20 }
    const a = build({ config: cfg, source, seed: 5 }).system, b = build({ config: cfg, source, seed: 5 }).system
    for (let i = 0; i < 12; i++) { a.advance(600); b.advance(600) }
    expect(a.aliveCount).toBe(b.aliveCount)
    expect(Array.from(a.getFrame())).toEqual(Array.from(b.getFrame()))
  })
  it('restores a keyframe and continues within quantization tolerance', () => {
    const cfg = { ...simConfig, maxParticles: 500 }
    const source = { plumeHeightAt: () => 8, emissionCountAt: () => 20 }
    const { system, deposition } = build({ config: cfg, source, seed: 8 })
    for (let i = 0; i < 6; i++) system.advance(600)
    const kf = system.saveKeyframe()
    for (let i = 0; i < 6; i++) system.advance(600)
    const direct = Array.from(system.getFrame()), directAlive = system.aliveCount, directDep = deposition.max()
    system.restoreKeyframe(kf)
    expect(system.timeMs).toBe(T0 + 3600e3)
    for (let i = 0; i < 6; i++) system.advance(600)
    const replay = Array.from(system.getFrame())
    expect(system.aliveCount).toBe(directAlive)
    expect(replay.length).toBe(direct.length)
    for (let k = 0; k < replay.length; k += 4) {
      expect(Math.abs(replay[k] - direct[k])).toBeLessThan(0.02)
      expect(Math.abs(replay[k + 1] - direct[k + 1])).toBeLessThan(0.02)
      expect(Math.abs(replay[k + 2] - direct[k + 2])).toBeLessThan(0.15)
    }
    expect(Math.abs(deposition.max() - directDep)).toBeLessThan(1.5) // kuantisasi bisa geser 1 partikel ke sel tetangga
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement particleSystem.js**

```js
import { M_PER_DEG_LAT, metersPerDegLon } from './geo.js'

// Sistem partikel Lagrangian (spec §4.3). Typed arrays + free-list, deterministik lewat prng.
export function createParticleSystem({ config, windField, eruptionSource, vaacAdvisories, deposition, prng }) {
  const N = config.maxParticles
  const lon = new Float32Array(N), lat = new Float32Array(N), alt = new Float32Array(N)
  const cls = new Uint8Array(N), alive = new Uint8Array(N), bornMs = new Float64Array(N)
  const classes = config.sizeClasses
  const cumFraction = []
  classes.reduce((acc, c) => { cumFraction.push(acc + c.fraction); return acc + c.fraction }, 0)
  const { domain, emission: e, vent } = config
  const startMs = Date.parse(config.startUtc)

  let free = [], aliveCount = 0, timeMs = startMs, carry = 0

  function reset(tMs) {
    alive.fill(0); free = []
    for (let k = N - 1; k >= 0; k--) free.push(k) // pop → indeks kecil dulu
    aliveCount = 0; timeMs = tMs; carry = 0
  }
  reset(startMs)

  function spawn(la, lo, al, classIndex) {
    if (free.length === 0) return -1
    const k = free.pop()
    lat[k] = la; lon[k] = lo; alt[k] = al; cls[k] = classIndex; alive[k] = 1; bornMs[k] = timeMs
    aliveCount++
    return k
  }
  function kill(k) { alive[k] = 0; free.push(k); aliveCount-- }

  function pickClass() {
    const r = prng.next()
    for (let i = 0; i < cumFraction.length; i++) if (r < cumFraction[i]) return i
    return classes.length - 1
  }

  // emisi dari kawah: ketinggian di pita umbrella/bawah, offset radial acak
  function emit(count) {
    const H = eruptionSource.plumeHeightAt(timeMs)
    const R = e.umbrellaFactor * H * 1000
    const mPerDegLon = metersPerDegLon(vent.lat)
    for (let n = 0; n < count; n++) {
      const inUmbrella = prng.next() < e.umbrellaFraction
      const a = inUmbrella
        ? H * (e.umbrellaBandLow + prng.next() * (1 - e.umbrellaBandLow))
        : H * (e.lowBandFloor + prng.next() * (e.umbrellaBandLow - e.lowBandFloor))
      const r = R * prng.next(), th = prng.next() * 2 * Math.PI
      spawn(vent.lat + (r * Math.cos(th)) / M_PER_DEG_LAT, vent.lon + (r * Math.sin(th)) / mPerDegLon, a, pickClass())
    }
  }

  function advance(dtSec) {
    carry += eruptionSource.emissionCountAt(timeMs, dtSec)
    const n = Math.floor(carry); carry -= n
    emit(n)

    const sigmaH = Math.sqrt(2 * config.diffusion.horizontalM2s * dtSec)
    const sigmaZKm = (config.diffusion.verticalSigmaMPerStep * Math.sqrt(dtSec / 600)) / 1000
    const alpha = config.vaacNudge
    const tSample = Math.min(Math.max(timeMs, windField.timeStartMs), windField.timeEndMs)
    const nudgeLow = alpha > 0 ? vaacAdvisories.layerMotionAt(timeMs, 0) : null
    const nudgeHigh = alpha > 0 ? vaacAdvisories.layerMotionAt(timeMs, config.lowLayerTopKm + 0.001) : null

    for (let k = 0; k < N; k++) {
      if (!alive[k]) continue
      const w = windField.sample(lat[k], lon[k], alt[k], tSample)
      if (!w) { kill(k); continue }
      let u = w.u, v = w.v
      const nudge = alt[k] <= config.lowLayerTopKm ? nudgeLow : nudgeHigh
      if (nudge) { u = (1 - alpha) * u + alpha * nudge.u; v = (1 - alpha) * v + alpha * nudge.v }
      const dx = u * dtSec + (sigmaH ? sigmaH * prng.gauss() : 0)
      const dy = v * dtSec + (sigmaH ? sigmaH * prng.gauss() : 0)
      lat[k] += dy / M_PER_DEG_LAT
      lon[k] += dx / metersPerDegLon(lat[k])
      alt[k] += (sigmaZKm ? sigmaZKm * prng.gauss() : 0) - (classes[cls[k]].settleMps * dtSec) / 1000
      if (alt[k] <= 0) { deposition.add(lat[k], lon[k], classes[cls[k]].depositWeight); kill(k); continue }
      if (lat[k] < domain.latMin || lat[k] > domain.latMax || lon[k] < domain.lonMin || lon[k] > domain.lonMax) kill(k)
    }
    timeMs += Math.round(dtSec * 1000)
  }

  function getFrame() {
    const out = new Float32Array(aliveCount * 4)
    let o = 0
    for (let k = 0; k < N; k++) {
      if (!alive[k]) continue
      out[o++] = lon[k]; out[o++] = lat[k]; out[o++] = alt[k]; out[o++] = (timeMs - bornMs[k]) / 3600e3
    }
    return out
  }

  function saveKeyframe() {
    const lonQ = new Int16Array(N), latQ = new Int16Array(N), altQ = new Uint8Array(N), bornQ = new Uint16Array(N)
    for (let k = 0; k < N; k++) {
      lonQ[k] = Math.round(lon[k] * 100); latQ[k] = Math.round(lat[k] * 100)
      altQ[k] = Math.max(0, Math.min(255, Math.round(alt[k] * 10)))
      bornQ[k] = Math.round((bornMs[k] - startMs) / 600e3)
    }
    return { timeMs, carry, prngState: prng.getState(), lonQ, latQ, altQ, cls: cls.slice(), alive: alive.slice(), bornQ, free: Uint16Array.from(free), deposition: deposition.snapshot() }
  }

  function restoreKeyframe(kf) {
    for (let k = 0; k < N; k++) {
      lon[k] = kf.lonQ[k] / 100; lat[k] = kf.latQ[k] / 100; alt[k] = kf.altQ[k] / 10
      bornMs[k] = startMs + kf.bornQ[k] * 600e3
    }
    cls.set(kf.cls); alive.set(kf.alive)
    free = Array.from(kf.free)
    aliveCount = 0; for (let k = 0; k < N; k++) aliveCount += alive[k]
    timeMs = kf.timeMs; carry = kf.carry; prng.setState(kf.prngState)
    deposition.restore(kf.deposition)
  }

  return {
    get timeMs() { return timeMs }, get aliveCount() { return aliveCount }, maxParticles: N,
    reset, spawn, advance, getFrame, saveKeyframe, restoreKeyframe,
  }
}
```

- [ ] **Step 3: Run → lulus, commit**

Run: `npx vitest run tests/engine/particleSystem.test.js` → PASS (7 tests). Kalau test keyframe gagal di toleransi, cek bahwa `prng.setState` juga membuang cache gauss (`spare = null`).
```bash
git add src/engine/particleSystem.js tests/engine/particleSystem.test.js
git commit -m "Add Lagrangian particle system with keyframes"
```

---

### Task 10: simController + simWorker

**Files:**
- Create: `src/engine/simController.js`, `src/engine/simWorker.js`
- Test: `tests/engine/simController.test.js`

**Interfaces:**
- Consumes: particleSystem (Task 9) dan factory Task 5–8.
- Produces:
  - `createSimController({ system, startMs, endMs, stepSec, keyframeSec }) → { get timeMs, startMs, endMs, advanceTo(targetMs), seekTo(targetMs), keyframeCount() }`. Langkah tidak pernah melewati batas keyframe; keyframe disimpan tepat di kelipatan `keyframeSec` sejak `startMs` (termasuk `startMs`).
  - Protokol worker (spec §5.3). Main → worker: `{type:'init', datasets:{wind, vaac, eruptionSource}, config}`, `{type:'play', speed}`, `{type:'pause'}`, `{type:'seek', tMs}`, `{type:'setSpeed', speed}`. Worker → main: `{type:'ready', tMs}`, `{type:'frame', tMs, count, positions: Float32Array, deposition?: Float32Array, depositionMax?: number}`, `{type:'seeking', tMs}`, `{type:'error', message}`, `{type:'ended'}`. `speed` = jam-sim per detik nyata.

- [ ] **Step 1: Test controller (gagal dulu)**

`tests/engine/simController.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { createSimController } from '../../src/engine/simController.js'

const START = Date.parse('2026-09-04T00:00:00Z'), END = START + 72 * 3600e3

function fakeSystem() {
  const log = { steps: [], restored: [] }
  let timeMs = 0
  return { log, get timeMs() { return timeMs },
    reset(t) { timeMs = t }, advance(dtSec) { log.steps.push(dtSec); timeMs += dtSec * 1000 },
    saveKeyframe() { return { timeMs } }, restoreKeyframe(kf) { timeMs = kf.timeMs; log.restored.push(kf.timeMs) } }
}

describe('createSimController', () => {
  it('advances in 600 s steps and saves hourly keyframes (including start)', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    expect(c.keyframeCount()).toBe(1)
    c.advanceTo(START + 2 * 3600e3)
    expect(system.log.steps).toHaveLength(12)
    expect(system.log.steps.every(s => s === 600)).toBe(true)
    expect(c.keyframeCount()).toBe(3)
    expect(c.timeMs).toBe(START + 2 * 3600e3)
  })
  it('never steps across a keyframe boundary', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.advanceTo(START + 250e3)
    c.advanceTo(START + 3600e3 + 100e3)
    expect(system.log.steps).toEqual([250, 600, 600, 600, 600, 600, 350, 100])
    expect(c.keyframeCount()).toBe(2)
  })
  it('seeks backwards by restoring the latest keyframe at or before target', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.advanceTo(START + 3 * 3600e3)
    system.log.steps.length = 0
    c.seekTo(START + 90 * 60e3) // 1h30 → restore 1h, maju 3 langkah
    expect(system.log.restored).toEqual([START + 3600e3])
    expect(system.log.steps).toEqual([600, 600, 600])
    expect(c.timeMs).toBe(START + 90 * 60e3)
  })
  it('seeks forward without restoring and clamps to the time range', () => {
    const system = fakeSystem()
    const c = createSimController({ system, startMs: START, endMs: END, stepSec: 600, keyframeSec: 3600 })
    c.seekTo(START + 600e3)
    expect(system.log.restored).toEqual([])
    c.seekTo(START - 5e3); expect(c.timeMs).toBe(START)
    c.seekTo(END + 5e3); expect(c.timeMs).toBe(END)
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement simController.js**

```js
// Pengatur waktu: maju bertahap (≤ stepSec), keyframe tiap keyframeSec, seek mundur via keyframe
export function createSimController({ system, startMs, endMs, stepSec, keyframeSec }) {
  const kfMs = keyframeSec * 1000, stepMs = stepSec * 1000
  const keyframes = new Map()
  system.reset(startMs)
  keyframes.set(startMs, system.saveKeyframe())

  function saveIfBoundary() {
    const t = system.timeMs
    if ((t - startMs) % kfMs === 0 && !keyframes.has(t)) keyframes.set(t, system.saveKeyframe())
  }

  function advanceTo(targetMs) {
    targetMs = Math.min(endMs, Math.round(targetMs))
    while (system.timeMs < targetMs) {
      const nextKf = startMs + (Math.floor((system.timeMs - startMs) / kfMs) + 1) * kfMs
      const dtMs = Math.min(stepMs, targetMs - system.timeMs, nextKf - system.timeMs)
      system.advance(dtMs / 1000)
      saveIfBoundary()
    }
  }

  function seekTo(targetMs) {
    targetMs = Math.max(startMs, Math.min(endMs, Math.round(targetMs)))
    if (targetMs < system.timeMs) {
      let best = startMs
      for (const t of keyframes.keys()) if (t <= targetMs && t > best) best = t
      system.restoreKeyframe(keyframes.get(best))
    }
    advanceTo(targetMs)
  }

  return { get timeMs() { return system.timeMs }, startMs, endMs, advanceTo, seekTo, keyframeCount: () => keyframes.size }
}
```

- [ ] **Step 3: Run → lulus** (`npx vitest run tests/engine/simController.test.js`)

- [ ] **Step 4: Tulis simWorker.js** (adaptor tipis, tidak di-unit-test; diverifikasi di browser Task 12)

```js
import { createWindField } from './windField.js'
import { createEruptionSource } from './eruptionSource.js'
import { createVaacAdvisories } from './vaacAdvisories.js'
import { createDepositionGrid } from './deposition.js'
import { createPrng } from './prng.js'
import { createParticleSystem } from './particleSystem.js'
import { createSimController } from './simController.js'

const TICK_MS = 33
let system, controller, deposition
let playing = false, speed = 1, timer = null, lastTick = 0, lastDepositionMs = -Infinity

function post(msg, transfer) { self.postMessage(msg, transfer) }
function fail(err) { pause(); post({ type: 'error', message: String(err?.message ?? err) }) }

function init({ datasets, config }) {
  const windField = createWindField(datasets.wind)
  const eruptionSource = createEruptionSource(datasets.eruptionSource.series, config.emission)
  const vaacAdvisories = createVaacAdvisories(datasets.vaac)
  deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
  system = createParticleSystem({ config, windField, eruptionSource, vaacAdvisories, deposition, prng: createPrng(config.seed) })
  controller = createSimController({ system, startMs: Date.parse(config.startUtc), endMs: Date.parse(config.endUtc), stepSec: config.stepSec, keyframeSec: config.keyframeSec })
  post({ type: 'ready', tMs: controller.timeMs })
  postFrame(true)
}

function postFrame(withDeposition) {
  const positions = system.getFrame()
  const msg = { type: 'frame', tMs: controller.timeMs, count: system.aliveCount, positions }
  const transfer = [positions.buffer]
  if (withDeposition) {
    msg.deposition = deposition.snapshot(); msg.depositionMax = deposition.max()
    transfer.push(msg.deposition.buffer); lastDepositionMs = controller.timeMs
  }
  post(msg, transfer)
}

function tick() {
  try {
    const now = performance.now(), dtReal = (now - lastTick) / 1000; lastTick = now
    controller.advanceTo(controller.timeMs + dtReal * speed * 3600e3)
    postFrame(controller.timeMs - lastDepositionMs >= 3600e3)
    if (controller.timeMs >= controller.endMs) { pause(); post({ type: 'ended' }) }
  } catch (err) { fail(err) }
}

function play(s) {
  if (s) speed = s
  if (playing) return
  playing = true; lastTick = performance.now(); timer = setInterval(tick, TICK_MS)
}
function pause() { playing = false; if (timer) clearInterval(timer); timer = null }
function seek(tMs) { post({ type: 'seeking', tMs }); controller.seekTo(tMs); postFrame(true) }

self.onmessage = ({ data: msg }) => {
  try {
    switch (msg.type) {
      case 'init': init(msg); break
      case 'play': play(msg.speed); break
      case 'pause': pause(); break
      case 'seek': seek(msg.tMs); break
      case 'setSpeed': speed = msg.speed; break
      default: throw new Error(`Unknown message: ${msg.type}`)
    }
  } catch (err) { fail(err) }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/engine/simController.js src/engine/simWorker.js tests/engine/simController.test.js
git commit -m "Add sim controller with keyframe seeking and worker adapter"
```

---

### Task 11: composables useDatasets + useSimulation

**Files:**
- Create: `src/composables/useDatasets.js`, `src/composables/useSimulation.js`
- Test: `tests/composables/useSimulation.test.js`, `tests/composables/useDatasets.test.js`

**Interfaces:**
- Consumes: protokol worker (Task 10), file `public/data/*.json` (Task 4).
- Produces:
  - `useDatasets({ fetchFn?, baseUrl? }) → { status: Ref<'idle'|'loading'|'ready'|'error'>, error: Ref<string|null>, data: ShallowRef<{wind, vaac, eruptionSource, events, places, provinces}|null>, load() }`
  - `useSimulation({ createWorker? }) → { status, error, currentTimeMs, playing, speed, seeking, aliveCount (semua Ref), init(datasets, config), play(), pause(), seek(tMs), setSpeed(s), onFrame(handler) → unsubscribe, getLatestFrame() → frame|null, dispose() }`. `frame` = pesan `frame` worker apa adanya (`{tMs, count, positions, deposition?, depositionMax?}`), disimpan non-reaktif (`markRaw`). `currentTimeMs` di-throttle ≤10× per detik saat playing.

- [ ] **Step 1: Test useSimulation (gagal dulu)**

`tests/composables/useSimulation.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { useSimulation } from '../../src/composables/useSimulation.js'

function fakeWorker() {
  const w = { posted: [], onmessage: null, onerror: null, terminated: false,
    postMessage(m) { w.posted.push(m) }, terminate() { w.terminated = true },
    emit(msg) { w.onmessage({ data: msg }) } }
  return w
}
const datasets = { wind: { w: 1 }, vaac: [], eruptionSource: { series: [] }, events: {}, places: {}, provinces: {} }
const config = { seed: 1 }

describe('useSimulation', () => {
  it('init posts only the datasets the worker needs and becomes ready', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w })
    sim.init(datasets, config)
    expect(sim.status.value).toBe('loading')
    expect(w.posted[0]).toEqual({ type: 'init', datasets: { wind: { w: 1 }, vaac: [], eruptionSource: { series: [] } }, config })
    w.emit({ type: 'ready', tMs: 123 })
    expect(sim.status.value).toBe('ready'); expect(sim.currentTimeMs.value).toBe(123)
  })
  it('dispatches frames to handlers and updates time/count', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config)
    const handler = vi.fn(); const off = sim.onFrame(handler)
    const frame = { type: 'frame', tMs: 5000, count: 2, positions: new Float32Array(8) }
    w.emit(frame)
    expect(handler).toHaveBeenCalledWith(frame)
    expect(sim.currentTimeMs.value).toBe(5000); expect(sim.aliveCount.value).toBe(2)
    expect(sim.getLatestFrame()).toBe(frame)
    off(); w.emit({ ...frame, tMs: 6000 }); expect(handler).toHaveBeenCalledTimes(1)
  })
  it('play/pause/seek/setSpeed post messages and track state', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config); w.posted.length = 0
    sim.setSpeed(2); sim.play(); sim.seek(999); sim.pause()
    expect(w.posted).toEqual([{ type: 'setSpeed', speed: 2 }, { type: 'play', speed: 2 }, { type: 'seek', tMs: 999 }, { type: 'pause' }])
    expect(sim.speed.value).toBe(2); expect(sim.playing.value).toBe(false); expect(sim.currentTimeMs.value).toBe(999)
    w.emit({ type: 'seeking', tMs: 999 }); expect(sim.seeking.value).toBe(true)
    w.emit({ type: 'frame', tMs: 999, count: 0, positions: new Float32Array(0) }); expect(sim.seeking.value).toBe(false)
  })
  it('handles ended and error', () => {
    const w = fakeWorker(); const sim = useSimulation({ createWorker: () => w }); sim.init(datasets, config)
    sim.play(); w.emit({ type: 'ended' }); expect(sim.playing.value).toBe(false)
    w.emit({ type: 'error', message: 'boom' }); expect(sim.status.value).toBe('error'); expect(sim.error.value).toBe('boom')
    sim.dispose(); expect(w.terminated).toBe(true)
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement useSimulation.js**

```js
import { ref, markRaw } from 'vue'

function defaultCreateWorker() {
  return new Worker(new URL('../engine/simWorker.js', import.meta.url), { type: 'module' })
}

// Pemilik worker simulasi. Frame besar disimpan non-reaktif, cuma waktu/count yang jadi ref.
export function useSimulation({ createWorker = defaultCreateWorker } = {}) {
  const status = ref('idle'), error = ref(null)
  const currentTimeMs = ref(0), playing = ref(false), speed = ref(1), seeking = ref(false), aliveCount = ref(0)
  let worker = null, latestFrame = null, lastUiUpdate = 0
  const handlers = new Set()

  function handleMessage({ data: msg }) {
    switch (msg.type) {
      case 'ready': status.value = 'ready'; currentTimeMs.value = msg.tMs; break
      case 'frame': {
        latestFrame = markRaw(msg); seeking.value = false
        const now = performance.now()
        if (!playing.value || now - lastUiUpdate >= 100) { currentTimeMs.value = msg.tMs; aliveCount.value = msg.count; lastUiUpdate = now }
        for (const h of handlers) h(msg)
        break
      }
      case 'seeking': seeking.value = true; break
      case 'ended': playing.value = false; break
      case 'error': error.value = msg.message; status.value = 'error'; playing.value = false; break
    }
  }

  function init(datasets, config) {
    worker = createWorker()
    worker.onmessage = handleMessage
    worker.onerror = (e) => { error.value = e.message || 'Worker crashed'; status.value = 'error'; playing.value = false }
    status.value = 'loading'
    worker.postMessage({ type: 'init', datasets: { wind: datasets.wind, vaac: datasets.vaac, eruptionSource: datasets.eruptionSource }, config })
  }
  function play() { worker.postMessage({ type: 'play', speed: speed.value }); playing.value = true }
  function pause() { worker.postMessage({ type: 'pause' }); playing.value = false }
  function seek(tMs) { worker.postMessage({ type: 'seek', tMs }); currentTimeMs.value = tMs }
  function setSpeed(s) { speed.value = s; worker.postMessage({ type: 'setSpeed', speed: s }) }
  function onFrame(handler) { handlers.add(handler); return () => handlers.delete(handler) }
  function dispose() { worker?.terminate(); worker = null }

  return { status, error, currentTimeMs, playing, speed, seeking, aliveCount, init, play, pause, seek, setSpeed, onFrame, getLatestFrame: () => latestFrame, dispose }
}
```

- [ ] **Step 3: Test useDatasets (gagal dulu)**

`tests/composables/useDatasets.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { useDatasets } from '../../src/composables/useDatasets.js'

const okFetch = async (url) => ({ ok: true, json: async () => ({ url }) })

describe('useDatasets', () => {
  it('loads all six files relative to baseUrl', async () => {
    const ds = useDatasets({ fetchFn: okFetch, baseUrl: '/app/' })
    await ds.load()
    expect(ds.status.value).toBe('ready')
    expect(Object.keys(ds.data.value).sort()).toEqual(['eruptionSource', 'events', 'places', 'provinces', 'vaac', 'wind'])
    expect(ds.data.value.eruptionSource.url).toBe('/app/data/eruption-source.json')
  })
  it('reports which file failed', async () => {
    const ds = useDatasets({ fetchFn: async (url) => ({ ok: !url.endsWith('vaac.json'), status: 404, json: async () => ({}) }), baseUrl: '/' })
    await ds.load()
    expect(ds.status.value).toBe('error'); expect(ds.error.value).toMatch(/vaac\.json/)
  })
})
```

- [ ] **Step 4: Run → gagal**, lalu **implement useDatasets.js**

```js
import { ref, shallowRef } from 'vue'

const FILES = { wind: 'wind.json', vaac: 'vaac.json', eruptionSource: 'eruption-source.json', events: 'events.json', places: 'places.json', provinces: 'provinces.json' }

export function useDatasets({ fetchFn = (u) => fetch(u), baseUrl = import.meta.env.BASE_URL } = {}) {
  const status = ref('idle'), error = ref(null), data = shallowRef(null)
  async function load() {
    status.value = 'loading'; error.value = null
    try {
      const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
        const res = await fetchFn(`${baseUrl}data/${file}`)
        if (!res.ok) throw new Error(`Failed to load ${file} (HTTP ${res.status})`)
        return [key, await res.json()]
      }))
      data.value = Object.fromEntries(entries); status.value = 'ready'
    } catch (e) { error.value = e.message; status.value = 'error' }
  }
  return { status, error, data, load }
}
```

- [ ] **Step 5: Run semua → lulus, commit**

```bash
git add src/composables/useDatasets.js src/composables/useSimulation.js tests/composables
git commit -m "Add dataset loader and simulation worker composables"
```

---

### Task 12: projection, ParticleLayer, DepositionLayer, MapView, App shell

**Files:**
- Create: `src/map/projection.js`, `src/map/ParticleLayer.js`, `src/map/DepositionLayer.js`, `src/components/MapView.vue`
- Modify: `src/App.vue` (ganti placeholder Task 1)
- Test: `tests/map/projection.test.js`

**Interfaces:**
- Consumes: `useDatasets`, `useSimulation` (Task 11), `simConfig`.
- Produces:
  - `mercatorY(latDeg)`, `createProjector({ west, east, north, south, width, height }) → { toPixel(lon, lat) → [x, y] }`.
  - `new ParticleLayer({ lowTopKm })` (Leaflet layer): `setFrame(frame)`, `setVisibility({ low, high })`.
  - `new DepositionLayer()`: `setGrid({ values, max, rows, cols, cellDeg, latMin, lonMin })`.
  - `MapView.vue` props `{ datasets, simulation }`; expose `getMap()` (dipakai Task 13/15 lewat `ref`).
  - `App.vue` menyediakan `datasets`, `simulation`, dan layout dasar; komponen UI berikutnya ditambahkan ke sini.

- [ ] **Step 1: Test projection (gagal dulu)**

`tests/map/projection.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mercatorY, createProjector } from '../../src/map/projection.js'

describe('projection', () => {
  it('mercatorY is 0 at the equator and antisymmetric', () => {
    expect(mercatorY(0)).toBeCloseTo(0, 9)
    expect(mercatorY(-6)).toBeCloseTo(-mercatorY(6), 9)
  })
  it('maps viewport corners to pixel corners', () => {
    const p = createProjector({ west: 100, east: 112, north: -2, south: -11, width: 1200, height: 900 })
    expect(p.toPixel(100, -2)).toEqual([0, 0])
    const [x, y] = p.toPixel(112, -11); expect(x).toBeCloseTo(1200, 6); expect(y).toBeCloseTo(900, 6)
  })
  it('is linear in longitude', () => {
    const p = createProjector({ west: 100, east: 110, north: 0, south: -10, width: 1000, height: 1000 })
    expect(p.toPixel(105, 0)[0]).toBeCloseTo(500, 6)
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement projection.js**

```js
const DEG = Math.PI / 180

export function mercatorY(latDeg) {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * DEG) / 2))
}

// Proyeksi Web-Mercator viewport → pixel, tanpa Leaflet (biar bisa di-test & cepat di loop partikel)
export function createProjector({ west, east, north, south, width, height }) {
  const yN = mercatorY(north), yS = mercatorY(south)
  const sx = width / (east - west), sy = height / (yS - yN)
  return { toPixel(lon, lat) { return [(lon - west) * sx, (mercatorY(lat) - yN) * sy] } }
}
```

- [ ] **Step 3: Run → lulus**

- [ ] **Step 4: ParticleLayer.js**

```js
import L from 'leaflet'
import { createProjector } from './projection.js'

const ALT_BUCKETS = 8, AGE_BUCKETS = 3, MAX_ALT_KM = 16
// warna: rendah = abu gelap hangat, tinggi = abu terang kebiruan
const LOW_RGB = [96, 74, 54], HIGH_RGB = [190, 205, 222]
const AGE_ALPHA = [0.9, 0.6, 0.35] // < 6 jam, < 18 jam, sisanya

function bucketStyles() {
  const styles = []
  for (let a = 0; a < ALT_BUCKETS; a++) {
    const f = a / (ALT_BUCKETS - 1)
    const rgb = LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i] - lo) * f))
    for (let g = 0; g < AGE_BUCKETS; g++) styles.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${AGE_ALPHA[g]})`)
  }
  return styles
}

export const ParticleLayer = L.Layer.extend({
  initialize(options = {}) {
    L.setOptions(this, options)
    this._lowTopKm = options.lowTopKm ?? 6.1
    this._frame = null
    this._show = { low: true, high: true }
    this._styles = bucketStyles()
    this._buckets = Array.from({ length: ALT_BUCKETS * AGE_BUCKETS }, () => [])
  },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'ash-particle-canvas')
    this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this)
    this._reset()
  },
  onRemove(map) {
    map.off('moveend zoomend resize', this._reset, this)
    L.DomUtil.remove(this._canvas)
    this._map = null
  },
  setFrame(frame) { this._frame = frame; this._draw() },
  setVisibility({ low, high }) { this._show = { low, high }; this._draw() },
  _reset() {
    const size = this._map.getSize()
    this._canvas.width = size.x; this._canvas.height = size.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]))
    this._draw()
  },
  _draw() {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d')
    const { width, height } = this._canvas
    ctx.clearRect(0, 0, width, height)
    const frame = this._frame
    if (!frame || frame.count === 0) return
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    for (const bucket of this._buckets) bucket.length = 0
    const p = frame.positions
    for (let i = 0; i < frame.count * 4; i += 4) {
      const alt = p[i + 2]
      if (alt <= this._lowTopKm ? !this._show.low : !this._show.high) continue
      const [x, y] = proj.toPixel(p[i], p[i + 1])
      if (x < 0 || y < 0 || x > width || y > height) continue
      const a = Math.min(ALT_BUCKETS - 1, Math.floor((alt / MAX_ALT_KM) * ALT_BUCKETS))
      const age = p[i + 3], g = age < 6 ? 0 : age < 18 ? 1 : 2
      this._buckets[a * AGE_BUCKETS + g].push(x, y)
    }
    this._buckets.forEach((pts, k) => {
      if (!pts.length) return
      ctx.fillStyle = this._styles[k]
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i] - 1, pts[i + 1] - 1, 2, 2)
    })
  },
})
```

- [ ] **Step 5: DepositionLayer.js**

```js
import L from 'leaflet'
import { createProjector } from './projection.js'

// Endapan: sel grid diwarnai dengan alpha ∝ log(nilai)/log(maks)
export const DepositionLayer = L.Layer.extend({
  initialize(options = {}) { L.setOptions(this, options); this._grid = null; this._visible = true },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'ash-deposition-canvas')
    this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this)
    this._reset()
  },
  onRemove(map) { map.off('moveend zoomend resize', this._reset, this); L.DomUtil.remove(this._canvas); this._map = null },
  setGrid(grid) { this._grid = grid; this._draw() },
  setVisible(v) { this._visible = v; this._draw() },
  _reset() {
    const size = this._map.getSize()
    this._canvas.width = size.x; this._canvas.height = size.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]))
    this._draw()
  },
  _draw() {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d')
    const { width, height } = this._canvas
    ctx.clearRect(0, 0, width, height)
    const g = this._grid
    if (!this._visible || !g || !(g.max > 0)) return
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    const logMax = Math.log1p(g.max)
    ctx.fillStyle = 'rgb(214, 150, 48)'
    for (let r = 0; r < g.rows; r++) {
      const lat0 = g.latMin + r * g.cellDeg, lat1 = lat0 + g.cellDeg
      for (let c = 0; c < g.cols; c++) {
        const v = g.values[r * g.cols + c]
        if (v <= 0) continue
        const lon0 = g.lonMin + c * g.cellDeg
        const [x0, y0] = proj.toPixel(lon0, lat1), [x1, y1] = proj.toPixel(lon0 + g.cellDeg, lat0)
        if (x1 < 0 || y1 < 0 || x0 > width || y0 > height) continue
        ctx.globalAlpha = 0.15 + 0.7 * (Math.log1p(v) / logMax)
        ctx.fillRect(x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5)
      }
    }
    ctx.globalAlpha = 1
  },
})
```

- [ ] **Step 6: MapView.vue**

```vue
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
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 12,
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
```

- [ ] **Step 7: App.vue (shell sementara: load → init → tombol play + waktu mentah)**

```vue
<script setup>
import { onMounted, watch } from 'vue'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'

const datasets = useDatasets()
const simulation = useSimulation()

onMounted(() => datasets.load())
watch(() => datasets.status.value, (s) => { if (s === 'ready') simulation.init(datasets.data.value, simConfig) })

function toggle() { simulation.playing.value ? simulation.pause() : simulation.play() }
</script>

<template>
  <div class="app">
    <div v-if="datasets.status.value !== 'ready'" class="overlay">
      <p v-if="datasets.status.value === 'error'">Failed to load data: {{ datasets.error.value }}</p>
      <p v-else>Loading data…</p>
    </div>
    <template v-else>
      <MapView :datasets="datasets.data.value" :simulation="simulation" />
      <div class="debug">
        <button :disabled="simulation.status.value !== 'ready'" @click="toggle">{{ simulation.playing.value ? 'Pause' : 'Play' }}</button>
        <span>{{ new Date(simulation.currentTimeMs.value).toISOString() }} · {{ simulation.aliveCount.value }} particles</span>
        <span v-if="simulation.error.value" class="err">{{ simulation.error.value }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.app { position: fixed; inset: 0; font-family: system-ui, sans-serif; color: #e6e9ef; background: #0b0e13; }
.overlay { position: absolute; inset: 0; display: grid; place-items: center; }
.debug { position: absolute; left: 12px; bottom: 12px; z-index: 1000; display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,.6); padding: 8px 12px; border-radius: 6px; }
.err { color: #ff6b6b; }
</style>
```

- [ ] **Step 8: Verifikasi di browser**

Run: `npm run dev` (background), buka `http://localhost:5173`. Pakai Chrome DevTools MCP (`navigate_page`, `take_screenshot`, `list_console_messages`) atau manual. Expected: peta gelap terpusat Selat Sunda, batas provinsi, marker ▲ Anak Krakatau + kota; tombol Play jalan; partikel abu muncul dari kawah dan menyebar; setelah beberapa detik endapan kuning-cokelat muncul; tidak ada error konsol. Pan/zoom → partikel ikut (redraw di moveend).

- [ ] **Step 9: Commit**

```bash
git add src/map/projection.js src/map/ParticleLayer.js src/map/DepositionLayer.js src/components/MapView.vue src/App.vue tests/map
git commit -m "Add Leaflet map with particle and deposition canvas layers"
```

---

### Task 13: formatTime + TimelineBar

**Files:**
- Create: `src/utils/formatTime.js`, `src/components/TimelineBar.vue`
- Modify: `src/App.vue` (ganti `.debug` dengan `<TimelineBar>`)
- Test: `tests/utils/formatTime.test.js`

**Interfaces:**
- Produces: `formatWib(tMs) → 'Sat 5 Sep 2026 23:10 WIB'`, `formatWibShort(tMs) → 'Sat 23:10'`, `formatUtc(tMs) → '16:10 UTC'`, `WIB_OFFSET_MS = 7*3600e3`.
- `TimelineBar.vue` props `{ simulation, startMs, endMs, events }` (events = array dari `events.json`); memanggil `simulation.play/pause/seek/setSpeed` langsung. Slider resolusi 10 menit. `speed` pilihan `[0.5, 1, 2, 4]`.

- [ ] **Step 1: Test formatTime (gagal dulu)**

`tests/utils/formatTime.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { formatWib, formatWibShort, formatUtc } from '../../src/utils/formatTime.js'

const T = Date.parse('2026-09-05T16:10:00Z')
describe('formatTime', () => {
  it('formats WIB (UTC+7)', () => { expect(formatWib(T)).toBe('Sat 5 Sep 2026 23:10 WIB') })
  it('formats short WIB', () => { expect(formatWibShort(T)).toBe('Sat 23:10') })
  it('formats UTC', () => { expect(formatUtc(T)).toBe('16:10 UTC') })
  it('rolls over the day in WIB', () => { expect(formatWib(Date.parse('2026-09-05T18:30:00Z'))).toBe('Sun 6 Sep 2026 01:30 WIB') })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement formatTime.js**

```js
export const WIB_OFFSET_MS = 7 * 3600e3
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n) => String(n).padStart(2, '0')

// geser ke WIB lalu baca komponen UTC-nya (nggak bergantung timezone mesin)
function wibParts(tMs) {
  const d = new Date(tMs + WIB_OFFSET_MS)
  return { day: DAYS[d.getUTCDay()], date: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), hh: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()) }
}
export function formatWib(tMs) { const p = wibParts(tMs); return `${p.day} ${p.date} ${p.month} ${p.year} ${p.hh}:${p.mm} WIB` }
export function formatWibShort(tMs) { const p = wibParts(tMs); return `${p.day} ${p.hh}:${p.mm}` }
export function formatUtc(tMs) { const d = new Date(tMs); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` }
```

- [ ] **Step 3: Run → lulus**

- [ ] **Step 4: TimelineBar.vue**

```vue
<script setup>
import { computed } from 'vue'
import { formatWib, formatUtc, formatWibShort } from '../utils/formatTime.js'

const props = defineProps({
  simulation: { type: Object, required: true },
  startMs: { type: Number, required: true },
  endMs: { type: Number, required: true },
  events: { type: Array, default: () => [] },
})
const STEP_MS = 600e3
const SPEEDS = [0.5, 1, 2, 4]
const KIND_ICON = { eruption: '▲', advisory: '◆', ashfall: '●', aviation: '✈', report: '■' }

const maxStep = computed(() => Math.round((props.endMs - props.startMs) / STEP_MS))
const sliderValue = computed(() => Math.round((props.simulation.currentTimeMs.value - props.startMs) / STEP_MS))
const ticks = computed(() => props.events.map(e => {
  const t = Date.parse(e.timeUtc)
  return { ...e, tMs: t, pct: ((t - props.startMs) / (props.endMs - props.startMs)) * 100, icon: KIND_ICON[e.kind] ?? '•' }
}).filter(e => e.pct >= 0 && e.pct <= 100))

let seekTimer = null
function onInput(ev) {
  const t = props.startMs + Number(ev.target.value) * STEP_MS
  // throttle biar worker nggak kebanjiran seek saat slider di-drag
  if (seekTimer) return
  seekTimer = setTimeout(() => { seekTimer = null }, 60)
  props.simulation.seek(t)
}
function toggle() { props.simulation.playing.value ? props.simulation.pause() : props.simulation.play() }
</script>

<template>
  <div class="timeline">
    <button class="play" :disabled="simulation.status.value !== 'ready'" :aria-label="simulation.playing.value ? 'Pause' : 'Play'" @click="toggle">
      {{ simulation.playing.value ? '❚❚' : '▶' }}
    </button>
    <div class="speeds">
      <button v-for="s in SPEEDS" :key="s" :class="{ active: simulation.speed.value === s }" @click="simulation.setSpeed(s)">{{ s }}×</button>
    </div>
    <div class="track">
      <div class="ticks">
        <button v-for="e in ticks" :key="e.id" class="tick" :class="e.kind" :style="{ left: e.pct + '%' }" :title="`${formatWibShort(e.tMs)} — ${e.title}`" @click="simulation.seek(e.tMs)">{{ e.icon }}</button>
      </div>
      <input type="range" min="0" :max="maxStep" step="1" :value="sliderValue" @input="onInput" />
    </div>
    <div class="clock">
      <div class="wib">{{ formatWib(simulation.currentTimeMs.value) }}</div>
      <div class="utc">{{ formatUtc(simulation.currentTimeMs.value) }} · {{ simulation.aliveCount.value.toLocaleString() }} particles<span v-if="simulation.seeking.value"> · seeking…</span></div>
    </div>
  </div>
</template>

<style scoped>
.timeline { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 1000; display: flex; gap: 12px; align-items: center; padding: 10px 14px; background: rgba(12, 15, 21, .85); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; backdrop-filter: blur(6px); }
.play { width: 40px; height: 40px; border-radius: 50%; border: none; background: #ff5a3c; color: #fff; font-size: 14px; cursor: pointer; }
.play:disabled { opacity: .4; cursor: default; }
.speeds { display: flex; gap: 4px; }
.speeds button { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #cfd5df; border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
.speeds button.active { background: #cfd5df; color: #0b0e13; }
.track { flex: 1; position: relative; padding-top: 18px; }
.track input { width: 100%; margin: 0; accent-color: #ff5a3c; }
.ticks { position: absolute; left: 0; right: 0; top: 0; height: 16px; }
.tick { position: absolute; transform: translateX(-50%); background: none; border: none; color: #9aa3b2; font-size: 10px; cursor: pointer; padding: 0; }
.tick.eruption { color: #ff5a3c; } .tick.ashfall { color: #d69630; } .tick.aviation { color: #ffd166; } .tick.advisory { color: #7fd1ff; }
.clock { min-width: 220px; text-align: right; }
.wib { font-size: 15px; font-variant-numeric: tabular-nums; }
.utc { font-size: 11px; color: #9aa3b2; }
</style>
```

- [ ] **Step 5: Ubah App.vue** — import `TimelineBar`, hapus blok `.debug` dan fungsi `toggle`, ganti dengan:

```vue
<TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" />
```
dan di `<script setup>` tambah `const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)`.

- [ ] **Step 6: Verifikasi browser** — slider scrub maju/mundur mengubah partikel dan waktu; tick kejadian muncul di atas slider dengan tooltip; klik tick melompat ke waktunya; speed 4× jalan cepat.

- [ ] **Step 7: Commit**

```bash
git add src/utils/formatTime.js src/components/TimelineBar.vue src/App.vue tests/utils
git commit -m "Add timeline bar with scrubbing, speed and event ticks"
```

---

### Task 14: Poligon VAAC, marker kejadian, EventCard

**Files:**
- Create: `src/utils/events.js`, `src/components/EventCard.vue`
- Modify: `src/components/MapView.vue` (tambah grup VAAC + marker kejadian + watch waktu), `src/App.vue` (tambah `<EventCard>`)
- Test: `tests/utils/events.test.js`

**Interfaces:**
- Produces: `latestEventAt(events, tMs) → event | null`, `locatedEventsUpTo(events, tMs) → event[]` (hanya yang punya `location`, `timeUtc ≤ t`).
- `EventCard.vue` props `{ events, currentTimeMs }`.
- MapView: grup `vaacGroup` & `eventGroup` (dipakai toggle di Task 15 lewat `getOverlayGroups()`).

- [ ] **Step 1: Test events util (gagal dulu)**

`tests/utils/events.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { latestEventAt, locatedEventsUpTo } from '../../src/utils/events.js'

const events = [
  { id: 'a', timeUtc: '2026-09-04T16:07:00Z', kind: 'eruption' },
  { id: 'b', timeUtc: '2026-09-05T09:00:00Z', kind: 'ashfall', location: { lat: -5.4, lon: 105.3 } },
  { id: 'c', timeUtc: '2026-09-05T18:30:00Z', kind: 'aviation', location: { lat: -6.1, lon: 106.6 } },
]
describe('events util', () => {
  it('latestEventAt', () => {
    expect(latestEventAt(events, Date.parse('2026-09-04T00:00:00Z'))).toBeNull()
    expect(latestEventAt(events, Date.parse('2026-09-05T10:00:00Z')).id).toBe('b')
  })
  it('locatedEventsUpTo', () => {
    expect(locatedEventsUpTo(events, Date.parse('2026-09-05T10:00:00Z')).map(e => e.id)).toEqual(['b'])
    expect(locatedEventsUpTo(events, Date.parse('2026-09-06T00:00:00Z')).map(e => e.id)).toEqual(['b', 'c'])
  })
})
```

- [ ] **Step 2: Run → gagal**, lalu **implement events.js**

```js
const tOf = (e) => Date.parse(e.timeUtc)

export function latestEventAt(events, tMs) {
  let best = null
  for (const e of events) if (tOf(e) <= tMs && (!best || tOf(e) > tOf(best))) best = e
  return best
}

export function locatedEventsUpTo(events, tMs) {
  return events.filter(e => e.location && tOf(e) <= tMs).sort((a, b) => tOf(a) - tOf(b))
}
```

- [ ] **Step 3: Run → lulus**

- [ ] **Step 4: EventCard.vue**

```vue
<script setup>
import { computed } from 'vue'
import { latestEventAt } from '../utils/events.js'
import { formatWib } from '../utils/formatTime.js'

const props = defineProps({ events: { type: Array, required: true }, currentTimeMs: { type: Number, required: true } })
const current = computed(() => latestEventAt(props.events, props.currentTimeMs))
</script>

<template>
  <transition name="fade">
    <article v-if="current" :key="current.id" class="card" :class="current.kind">
      <div class="when">{{ formatWib(Date.parse(current.timeUtc)) }}</div>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
      <a :href="current.sourceUrl" target="_blank" rel="noopener">Source ↗</a>
    </article>
  </transition>
</template>

<style scoped>
.card { position: absolute; left: 12px; top: 84px; z-index: 1000; width: min(340px, calc(100vw - 24px)); padding: 12px 14px; background: rgba(12, 15, 21, .88); border-left: 3px solid #9aa3b2; border-radius: 6px; color: #e6e9ef; }
.card.eruption { border-color: #ff5a3c; } .card.ashfall { border-color: #d69630; } .card.aviation { border-color: #ffd166; } .card.advisory { border-color: #7fd1ff; }
.when { font-size: 11px; color: #9aa3b2; }
h3 { margin: 4px 0 6px; font-size: 15px; }
p { margin: 0 0 6px; font-size: 13px; line-height: 1.4; }
a { font-size: 12px; color: #7fd1ff; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 5: Modify MapView.vue** — tambah import, grup, dan watch:

```js
import { watch } from 'vue'                               // gabung dengan import vue yang ada
import { createVaacAdvisories } from '../engine/vaacAdvisories.js'
import { locatedEventsUpTo } from '../utils/events.js'
import { formatWibShort } from '../utils/formatTime.js'

const vaacAdvisories = createVaacAdvisories(props.datasets.vaac)
let vaacGroup, eventGroup, shownAdvisoryNr = null, shownEventIds = ''

function updateVaac(tMs) {
  const a = vaacAdvisories.latestObsAt(tMs)
  const nr = a?.nr ?? null
  if (nr === shownAdvisoryNr) return
  shownAdvisoryNr = nr; vaacGroup.clearLayers()
  if (!a) return
  for (const layer of a.layers) {
    const high = layer.topFl >= 500
    L.polygon(layer.polygon, { color: high ? '#ff4d4d' : '#ffa53c', weight: 1.5, dashArray: '6 4', fill: false, interactive: true })
      .bindTooltip(`VAAC ${a.nr} · obs ${a.obsUtc.slice(8, 10)}/${a.obsUtc.slice(11, 13)}${a.obsUtc.slice(14, 16)}Z · SFC/FL${layer.topFl}${layer.moveKt != null ? ` MOV ${layer.moveDeg}° ${layer.moveKt}KT` : ''}`, { sticky: true })
      .addTo(vaacGroup)
  }
}

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
```
Di dalam `onMounted` setelah `addPlaces(...)`:
```js
  vaacGroup = L.layerGroup().addTo(map)
  eventGroup = L.layerGroup().addTo(map)
  updateVaac(props.simulation.currentTimeMs.value); updateEventMarkers(props.simulation.currentTimeMs.value)
```
Di level `<script setup>` (setelah `onMounted`):
```js
watch(() => props.simulation.currentTimeMs.value, (t) => { if (map) { updateVaac(t); updateEventMarkers(t) } })
```
Tambah ke `defineExpose`: `getOverlayGroups: () => ({ vaacGroup, eventGroup })`.

- [ ] **Step 6: App.vue** — import `EventCard` dan tambah di dalam `<template v-else>`:
```vue
<EventCard :events="datasets.data.value.events.events" :current-time-ms="simulation.currentTimeMs.value" />
```

- [ ] **Step 7: Verifikasi browser** — pada 5 Sep 23:10 WIB (advisory 179) tampak dua poligon putus-putus (oranye FL200 sampai Jakarta–Jabar, merah FL500 ke barat); hover poligon → tooltip; marker hujan abu muncul di Lampung lalu Serang lalu Jakarta seiring waktu, hilang kalau scrub mundur; EventCard berganti sesuai waktu.

- [ ] **Step 8: Commit**

```bash
git add src/utils/events.js src/components/EventCard.vue src/components/MapView.vue src/App.vue tests/utils/events.test.js
git commit -m "Show VAAC polygons, event markers and event card by sim time"
```

---

### Task 15: useLayers, LayerPanel, Legend, WindArrowLayer

**Files:**
- Create: `src/composables/useLayers.js`, `src/map/WindArrowLayer.js`, `src/components/LayerPanel.vue`, `src/components/Legend.vue`
- Modify: `src/components/MapView.vue` (prop `layers`, watch toggle, wind layer), `src/App.vue` (panel kanan)

**Interfaces:**
- Produces: `useLayers() → reactive { lowAsh, highAsh, ashfall, vaac, wind, windLevel (index ke simConfig.levels, default 2 = 700hPa), provinces, places }` — default semua `true` kecuali `wind: false`.
- `new WindArrowLayer({ windField })`: `setState({ visible, levelIndex, tMs })`.
- MapView prop baru `layers` (objek reactive dari `useLayers`).

- [ ] **Step 1: useLayers.js**

```js
import { reactive } from 'vue'

export function useLayers() {
  return reactive({ lowAsh: true, highAsh: true, ashfall: true, vaac: true, wind: false, windLevel: 2, provinces: true, places: true })
}
```

- [ ] **Step 2: WindArrowLayer.js**

```js
import L from 'leaflet'
import { createProjector } from './projection.js'

const MAX_LEN_PX = 36, REF_SPEED = 30 // m/s → panjang panah maksimum
const HALF_HOUR = 1800e3

// Panah angin di simpul grid untuk satu level, diperbarui tiap 30 menit sim
export const WindArrowLayer = L.Layer.extend({
  initialize(options) { L.setOptions(this, options); this._windField = options.windField; this._state = { visible: false, levelIndex: 2, tMs: 0 }; this._slot = null },
  onAdd(map) {
    this._map = map
    this._canvas = L.DomUtil.create('canvas', 'wind-arrow-canvas'); this._canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(this._canvas)
    map.on('moveend zoomend resize', this._reset, this); this._reset()
  },
  onRemove(map) { map.off('moveend zoomend resize', this._reset, this); L.DomUtil.remove(this._canvas); this._map = null },
  setState({ visible, levelIndex, tMs }) {
    const slot = Math.floor(tMs / HALF_HOUR)
    const changed = visible !== this._state.visible || levelIndex !== this._state.levelIndex || slot !== this._slot
    this._state = { visible, levelIndex, tMs }; this._slot = slot
    if (changed) this._draw()
  },
  _reset() {
    const size = this._map.getSize(); this._canvas.width = size.x; this._canvas.height = size.y
    L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0])); this._draw()
  },
  _draw() {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d'); const { width, height } = this._canvas
    ctx.clearRect(0, 0, width, height)
    const { visible, levelIndex, tMs } = this._state
    if (!visible) return
    const wf = this._windField, alt = wf.levels[levelIndex].altKm
    const t = Math.min(Math.max(tMs, wf.timeStartMs), wf.timeEndMs)
    const b = this._map.getBounds()
    const proj = createProjector({ west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth(), width, height })
    ctx.strokeStyle = 'rgba(127, 209, 255, 0.85)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5
    for (const lat of wf.lats) for (const lon of wf.lons) {
      const w = wf.sample(lat, lon, alt, t); if (!w) continue
      const [x, y] = proj.toPixel(lon, lat); if (x < -40 || y < -40 || x > width + 40 || y > height + 40) continue
      const speed = Math.hypot(w.u, w.v), len = Math.min(MAX_LEN_PX, (speed / REF_SPEED) * MAX_LEN_PX)
      const dx = (w.u / (speed || 1)) * len, dy = (-w.v / (speed || 1)) * len // layar: y ke bawah
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke()
      const ang = Math.atan2(dy, dx)
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy)
      ctx.lineTo(x + dx - 6 * Math.cos(ang - 0.5), y + dy - 6 * Math.sin(ang - 0.5))
      ctx.lineTo(x + dx - 6 * Math.cos(ang + 0.5), y + dy - 6 * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill()
    }
  },
})
```

- [ ] **Step 3: LayerPanel.vue**

```vue
<script setup>
import { simConfig } from '../config/simConfig.js'
const props = defineProps({ layers: { type: Object, required: true } })
const levels = simConfig.levels
const rows = [
  ['lowAsh', 'Low ash (0–6 km)'], ['highAsh', 'High ash (6–16 km)'], ['ashfall', 'Ashfall'],
  ['vaac', 'VAAC polygons'], ['wind', 'Wind arrows'], ['provinces', 'Provinces'], ['places', 'Places'],
]
</script>

<template>
  <section class="panel">
    <h4>Layers</h4>
    <label v-for="[key, label] in rows" :key="key" class="row">
      <input type="checkbox" v-model="layers[key]" /> {{ label }}
    </label>
    <label class="row indent" v-if="layers.wind">
      Level
      <select v-model.number="layers.windLevel">
        <option v-for="(lv, i) in levels" :key="lv.name" :value="i">{{ lv.name }} · {{ lv.altKm }} km</option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.panel h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #9aa3b2; }
.row { display: flex; gap: 8px; align-items: center; font-size: 13px; padding: 3px 0; cursor: pointer; }
.row.indent { padding-left: 22px; }
select { background: #161b24; color: #e6e9ef; border: 1px solid rgba(255,255,255,.15); border-radius: 4px; padding: 2px 4px; }
</style>
```

- [ ] **Step 4: Legend.vue**

```vue
<script setup>
</script>

<template>
  <section class="legend">
    <h4>Legend</h4>
    <div class="row"><span class="ramp alt"></span><span>Ash altitude: 0 km → 16 km</span></div>
    <div class="row"><span class="ramp dep"></span><span>Ashfall (relative, log scale)</span></div>
    <div class="row"><span class="line low"></span><span>VAAC cloud, surface–FL200</span></div>
    <div class="row"><span class="line high"></span><span>VAAC cloud, surface–FL500</span></div>
    <div class="row"><span class="dot ashfall"></span><span>Ashfall report</span> <span class="dot aviation"></span><span>Airport closure</span></div>
    <p class="note">Particle count is illustrative, not mass. Winds are model data (Open-Meteo), not observations.</p>
  </section>
</template>

<style scoped>
.legend h4 { margin: 12px 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #9aa3b2; }
.row { display: flex; gap: 8px; align-items: center; font-size: 12px; padding: 2px 0; }
.ramp { width: 56px; height: 8px; border-radius: 2px; }
.ramp.alt { background: linear-gradient(90deg, rgb(96,74,54), rgb(190,205,222)); }
.ramp.dep { background: linear-gradient(90deg, rgba(214,150,48,.15), rgba(214,150,48,.85)); }
.line { width: 56px; height: 0; border-top: 2px dashed; }
.line.low { border-color: #ffa53c; } .line.high { border-color: #ff4d4d; }
.dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid; }
.dot.ashfall { border-color: #d69630; background: rgba(214,150,48,.35); } .dot.aviation { border-color: #ffd166; background: rgba(255,209,102,.35); }
.note { margin: 8px 0 0; font-size: 11px; color: #9aa3b2; line-height: 1.4; }
</style>
```

- [ ] **Step 5: Modify MapView.vue** — prop `layers`, wind layer, watch toggle.

Tambah prop: `layers: { type: Object, required: true }`. Import `createWindField` dari `../engine/windField.js` dan `WindArrowLayer`. Simpan layer provinsi & grup tempat ke variabel (`provinceLayer`, `placeGroup`; ubah `addPlaces` agar menambahkan ke `placeGroup = L.layerGroup().addTo(map)` alih-alih langsung ke `map`). Di `onMounted` setelah particle layer:
```js
  windArrowLayer = new WindArrowLayer({ windField: createWindField(props.datasets.wind) }).addTo(map)
  applyLayers()
```
Fungsi + watch (level `<script setup>`):
```js
function applyLayers() {
  const l = props.layers
  particleLayer.setVisibility({ low: l.lowAsh, high: l.highAsh })
  depositionLayer.setVisible(l.ashfall)
  toggleGroup(vaacGroup, l.vaac); toggleGroup(eventGroup, l.places); toggleGroup(placeGroup, l.places); toggleGroup(provinceLayer, l.provinces)
  windArrowLayer.setState({ visible: l.wind, levelIndex: l.windLevel, tMs: props.simulation.currentTimeMs.value })
}
function toggleGroup(layer, on) { if (!layer) return; if (on && !map.hasLayer(layer)) layer.addTo(map); if (!on && map.hasLayer(layer)) map.removeLayer(layer) }
watch(() => ({ ...props.layers }), () => { if (map) applyLayers() }, { deep: true })
```
Dan di watch `currentTimeMs` yang sudah ada tambahkan: `windArrowLayer.setState({ visible: props.layers.wind, levelIndex: props.layers.windLevel, tMs: t })`.

- [ ] **Step 6: App.vue** — `const layers = useLayers()`; `<MapView … :layers="layers" />`; panel kanan:
```vue
<aside class="side" :class="{ collapsed: sideCollapsed }">
  <button class="collapse" @click="sideCollapsed = !sideCollapsed">{{ sideCollapsed ? '◀' : '▶' }}</button>
  <div v-show="!sideCollapsed"><LayerPanel :layers="layers" /><Legend /></div>
</aside>
```
dengan `const sideCollapsed = ref(false)` dan CSS: `.side { position: absolute; right: 12px; top: 84px; z-index: 1000; width: 250px; padding: 12px; background: rgba(12,15,21,.88); border-radius: 8px; } .side.collapsed { width: auto; } .collapse { float: right; background: none; border: none; color: #9aa3b2; cursor: pointer; }`.

- [ ] **Step 7: Verifikasi browser** — tiap toggle bekerja (matikan Low ash → partikel rendah hilang; Wind arrows + level 200hPa → panah panjang ke barat; level 700hPa pada 6 Sep 01:00 WIB → panah pendek ke tenggara di sekitar Selat Sunda); panel bisa dilipat.

- [ ] **Step 8: Commit**

```bash
git add src/composables/useLayers.js src/map/WindArrowLayer.js src/components/LayerPanel.vue src/components/Legend.vue src/components/MapView.vue src/App.vue
git commit -m "Add layer toggles, legend and wind arrow layer"
```

---

### Task 16: Layout final, state awal, error UI, About, polesan visual

**Files:**
- Create: `src/components/AboutPanel.vue`
- Modify: `src/App.vue`, `src/components/MapView.vue` (tidak ada perubahan logika, hanya CSS bila perlu)

**Interfaces:**
- Consumes: semua komponen sebelumnya.
- Produces: `App.vue` final (spec §6, §7): header judul + subjudul + tombol About; layar loading/error dengan Retry; banner error worker dengan Reload; state awal 04 Sep 16:00Z paused; responsif < 768 px.

- [ ] **Step 1: AboutPanel.vue** (dialog sederhana, teks Inggris, batasan dari spec §9)

```vue
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
      <h3>Limitations</h3>
      <ul>
        <li>Winds are model data (Open-Meteo forecast archive), not observations.</li>
        <li>Particle counts are illustrative — they do not represent ash mass or concentration.</li>
        <li>VAAC advisories 163–182 are only partly available; the sim interpolates between the ones we have.</li>
        <li>No ground measurements of ash thickness were available; ashfall is relative.</li>
        <li>Plume height is held constant between reported values.</li>
      </ul>
      <h3>Data sources</h3>
      <ul>
        <li>Darwin VAAC volcanic ash advisories (via VolcanoDiscovery and bom.gov.au)</li>
        <li>Open-Meteo wind at 10 m, 850, 700, 500, 300, 200 and 100 hPa</li>
        <li>PVMBG / MAGMA Indonesia, BMKG statements, and Indonesian news reports for the event timeline</li>
        <li>Province boundaries: superpikar/indonesia-geojson (BAKOSURTANAL 1:250k)</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: absolute; inset: 0; z-index: 2000; background: rgba(0,0,0,.6); display: grid; place-items: center; }
.dialog { position: relative; width: min(560px, calc(100vw - 32px)); max-height: 80vh; overflow: auto; padding: 20px 24px; background: #121620; color: #e6e9ef; border-radius: 10px; font-size: 14px; line-height: 1.5; }
.close { position: absolute; right: 12px; top: 12px; background: none; border: none; color: #9aa3b2; font-size: 16px; cursor: pointer; }
h2 { margin: 0 0 8px; font-size: 18px; } h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #9aa3b2; }
ul { margin: 0; padding-left: 18px; }
</style>
```

- [ ] **Step 2: App.vue final**

```vue
<script setup>
import { onMounted, ref, watch } from 'vue'
import { useDatasets } from './composables/useDatasets.js'
import { useSimulation } from './composables/useSimulation.js'
import { useLayers } from './composables/useLayers.js'
import { simConfig } from './config/simConfig.js'
import MapView from './components/MapView.vue'
import TimelineBar from './components/TimelineBar.vue'
import EventCard from './components/EventCard.vue'
import LayerPanel from './components/LayerPanel.vue'
import Legend from './components/Legend.vue'
import AboutPanel from './components/AboutPanel.vue'

const INITIAL_UTC = '2026-09-04T16:00:00Z' // sesaat sebelum erupsi besar (spec §6)
const datasets = useDatasets()
const simulation = useSimulation()
const layers = useLayers()
const startMs = Date.parse(simConfig.startUtc), endMs = Date.parse(simConfig.endUtc)
const sideCollapsed = ref(window.innerWidth < 768)
const aboutOpen = ref(false)

onMounted(() => datasets.load())
watch(() => datasets.status.value, (s) => { if (s === 'ready') simulation.init(datasets.data.value, simConfig) })
watch(() => simulation.status.value, (s) => { if (s === 'ready') simulation.seek(Date.parse(INITIAL_UTC)) })

function reload() { window.location.reload() }
</script>

<template>
  <div class="app">
    <header class="header">
      <div>
        <h1>Anak Krakatau Ash Dispersion</h1>
        <p>4–6 September 2026 · particles driven by Open-Meteo winds, compared with Darwin VAAC</p>
      </div>
      <button class="about" @click="aboutOpen = true">About</button>
    </header>

    <div v-if="datasets.status.value !== 'ready'" class="overlay">
      <template v-if="datasets.status.value === 'error'">
        <p class="err">Failed to load data: {{ datasets.error.value }}</p>
        <button @click="datasets.load()">Retry</button>
      </template>
      <p v-else>Loading data…</p>
    </div>

    <template v-else>
      <MapView :datasets="datasets.data.value" :simulation="simulation" :layers="layers" />
      <EventCard :events="datasets.data.value.events.events" :current-time-ms="simulation.currentTimeMs.value" />
      <aside class="side" :class="{ collapsed: sideCollapsed }">
        <button class="collapse" :aria-label="sideCollapsed ? 'Show panel' : 'Hide panel'" @click="sideCollapsed = !sideCollapsed">{{ sideCollapsed ? '☰' : '✕' }}</button>
        <div v-show="!sideCollapsed"><LayerPanel :layers="layers" /><Legend /></div>
      </aside>
      <div v-if="simulation.status.value === 'error'" class="banner">
        Simulation stopped: {{ simulation.error.value }} <button @click="reload">Reload</button>
      </div>
      <TimelineBar :simulation="simulation" :start-ms="startMs" :end-ms="endMs" :events="datasets.data.value.events.events" />
    </template>

    <AboutPanel :open="aboutOpen" @close="aboutOpen = false" />
  </div>
</template>

<style scoped>
.app { position: fixed; inset: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #e6e9ef; background: #0b0e13; }
.header { position: absolute; left: 12px; top: 12px; right: 12px; z-index: 1000; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
.header > * { pointer-events: auto; }
h1 { margin: 0; font-size: 18px; letter-spacing: .01em; text-shadow: 0 0 8px #000; }
.header p { margin: 2px 0 0; font-size: 12px; color: #b5bdc9; text-shadow: 0 0 6px #000; }
.about { background: rgba(12,15,21,.85); border: 1px solid rgba(255,255,255,.15); color: #e6e9ef; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.overlay { position: absolute; inset: 0; display: grid; place-content: center; gap: 12px; text-align: center; }
.overlay button, .banner button { background: #ff5a3c; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
.err { color: #ff6b6b; }
.side { position: absolute; right: 12px; top: 84px; z-index: 1000; width: 250px; padding: 12px; background: rgba(12,15,21,.88); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; }
.side.collapsed { width: auto; padding: 6px; }
.collapse { float: right; background: none; border: none; color: #9aa3b2; cursor: pointer; font-size: 14px; }
.banner { position: absolute; left: 12px; right: 12px; bottom: 88px; z-index: 1100; padding: 8px 12px; background: #5a1e1e; border: 1px solid #ff6b6b; border-radius: 6px; display: flex; gap: 12px; align-items: center; }
@media (max-width: 767px) {
  h1 { font-size: 15px; } .header p { display: none; }
  .side { top: auto; bottom: 96px; right: 12px; max-height: 45vh; overflow: auto; }
}
</style>
```
Di `TimelineBar.vue` tambahkan media query: `@media (max-width: 767px) { .timeline { flex-wrap: wrap; gap: 8px; } .clock { min-width: 0; width: 100%; text-align: left; } }` dan di `EventCard.vue`: `@media (max-width: 767px) { .card { top: 56px; } }`.

- [ ] **Step 3: Polesan visual** — jalankan skill `frontend-design:frontend-design` dengan konteks "dark map dashboard, data-viz, ash palette (warm dark grey → cool light grey), accent #ff5a3c untuk erupsi". Terapkan hasilnya **hanya** ke CSS/warna/tipografi di komponen dan konstanta warna `LOW_RGB`/`HIGH_RGB`/`AGE_ALPHA` di `ParticleLayer.js` dan `Legend.vue` (jaga keduanya konsisten). Jangan ubah props, event, atau struktur komponen.

- [ ] **Step 4: Verifikasi browser** — saat dibuka: waktu 04 Sep 23:00 WIB, paused, zoom 7; tombol About membuka dialog; matikan jaringan ke `/data/` (DevTools → block request) lalu reload → layar error + Retry; ubah sementara `simWorker.js` agar `throw` di `init` → banner merah + Reload (kembalikan setelah cek); lebar 390 px (emulate mobile) → panel terlipat, timeline wrap, tidak ada scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/components
git commit -m "Finalize layout, initial state, error screens and about panel"
```

---

### Task 17: Kalibrasi (calibrate.mjs + docs/calibration.md)

**Files:**
- Create: `scripts/calibrate.mjs`, `docs/calibration.md`
- Modify (bila perlu): `src/config/simConfig.js` (hanya nilai parameter)

**Interfaces:**
- Consumes: engine lengkap (Task 5–10), `public/data/*.json`, `pointInPolygon` (Task 2).
- Produces: `npm run calibrate [-- --nudge=0.3 --kh=2000 --umbrella=2 --seed=1]` mencetak tabel overlap per advisory + waktu pertama abu rendah sampai Jakarta.

- [ ] **Step 1: scripts/calibrate.mjs**

```js
// Jalankan engine headless, ukur fraksi partikel di dalam poligon VAAC pada tiap waktu observasi (spec §8)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { simConfig } from '../src/config/simConfig.js'
import { createWindField } from '../src/engine/windField.js'
import { createEruptionSource } from '../src/engine/eruptionSource.js'
import { createVaacAdvisories } from '../src/engine/vaacAdvisories.js'
import { createDepositionGrid } from '../src/engine/deposition.js'
import { createPrng } from '../src/engine/prng.js'
import { createParticleSystem } from '../src/engine/particleSystem.js'
import { createSimController } from '../src/engine/simController.js'
import { pointInPolygon, metersPerDegLon, M_PER_DEG_LAT } from '../src/engine/geo.js'
import { formatWib } from '../src/utils/formatTime.js'

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, Number(v)] }))
const config = {
  ...simConfig,
  seed: args.seed ?? simConfig.seed,
  vaacNudge: args.nudge ?? simConfig.vaacNudge,
  diffusion: { ...simConfig.diffusion, horizontalM2s: args.kh ?? simConfig.diffusion.horizontalM2s },
  emission: { ...simConfig.emission, umbrellaFactor: args.umbrella ?? simConfig.emission.umbrellaFactor },
}
const ROOT = resolve(import.meta.dirname, '..')
const load = (f) => JSON.parse(readFileSync(resolve(ROOT, 'public/data', f), 'utf8'))

const windField = createWindField(load('wind.json'))
const vaac = createVaacAdvisories(load('vaac.json'))
const eruptionSource = createEruptionSource(load('eruption-source.json').series, config.emission)
const deposition = createDepositionGrid({ ...config.domain, cellDeg: config.deposition.cellDeg })
const system = createParticleSystem({ config, windField, eruptionSource, vaacAdvisories: vaac, deposition, prng: createPrng(config.seed) })
const controller = createSimController({ system, startMs: Date.parse(config.startUtc), endMs: Date.parse(config.endUtc), stepSec: config.stepSec, keyframeSec: config.keyframeSec })

const JAKARTA = { lat: -6.2, lon: 106.85 }, NEAR_KM = 30
let firstJakartaMs = null
function checkJakarta() {
  const f = system.getFrame()
  for (let i = 0; i < f.length; i += 4) {
    if (f[i + 2] > config.lowLayerTopKm) continue
    const dx = (f[i] - JAKARTA.lon) * metersPerDegLon(JAKARTA.lat), dy = (f[i + 1] - JAKARTA.lat) * M_PER_DEG_LAT
    if (Math.hypot(dx, dy) < NEAR_KM * 1000) { firstJakartaMs = controller.timeMs; return true }
  }
  return false
}

console.log(`nudge=${config.vaacNudge} kh=${config.diffusion.horizontalM2s} umbrella=${config.emission.umbrellaFactor} seed=${config.seed}`)
console.log('nr        | obs (WIB)              | low in/total (frac) | high in/total (frac) | alive')
const scores = []
for (const a of vaac.all) {
  if (a.obsMs < controller.startMs || a.obsMs > controller.endMs) continue
  // maju per jam supaya bisa cek Jakarta di sepanjang jalan
  while (controller.timeMs < a.obsMs) { controller.advanceTo(Math.min(a.obsMs, controller.timeMs + 3600e3)); if (!firstJakartaMs) checkJakarta() }
  const f = system.getFrame()
  let lowIn = 0, lowTot = 0, highIn = 0, highTot = 0
  for (let i = 0; i < f.length; i += 4) {
    const alt = f[i + 2], layer = vaac.layerForAltitude(a, alt)
    const inside = pointInPolygon(f[i + 1], f[i], layer.polygon)
    if (alt <= config.lowLayerTopKm) { lowTot++; if (inside) lowIn++ } else { highTot++; if (inside) highIn++ }
  }
  const lf = lowTot ? lowIn / lowTot : 0, hf = highTot ? highIn / highTot : 0
  scores.push({ nr: a.nr, lf, hf })
  console.log(`${a.nr.padEnd(9)} | ${formatWib(a.obsMs).padEnd(22)} | ${String(lowIn).padStart(5)}/${String(lowTot).padEnd(5)} (${lf.toFixed(2)}) | ${String(highIn).padStart(5)}/${String(highTot).padEnd(5)} (${hf.toFixed(2)}) | ${system.aliveCount}`)
}
console.log(`first low-level ash within ${NEAR_KM} km of Jakarta: ${firstJakartaMs ? formatWib(firstJakartaMs) : 'never'}`)
const target = scores.filter(s => ['2026/175', '2026/179', '2026/183', '2026/184'].includes(s.nr))
const pass = target.every(s => s.lf >= 0.5)
console.log(`target (low ≥ 0.5 on 175/179/183/184): ${pass ? 'PASS' : 'FAIL'}`)
```

- [ ] **Step 2: Jalankan baseline & variasi**

Run: `npm run calibrate` lalu variasi: `npm run calibrate -- --nudge=0`, `--nudge=0.5`, `--kh=1000`, `--kh=4000`, `--umbrella=1`, `--umbrella=3`.
Expected: tabel tercetak (< 30 detik per run). Catat semua hasil.

- [ ] **Step 3: Pilih parameter & tulis docs/calibration.md**

Kriteria: `low ≥ 0.5` pada 175/179/183/184 dan abu rendah sampai ≤ 30 km dari Jakarta antara 5 Sep 18:00 WIB dan 6 Sep 07:00 WIB. Kalau target tidak tercapai dengan `vaacNudge ≤ 0.5`, pilih kombinasi terbaik dan tulis alasannya. Perbarui `simConfig.js` hanya kalau nilai berubah. Format `docs/calibration.md`:

```markdown
# Kalibrasi v1 — <tanggal>

Perintah: `npm run calibrate -- …`

| nudge | K_h | umbrella | 175 low | 179 low | 183 low | 184 low | 179 high | Jakarta (WIB) |
|---|---|---|---|---|---|---|---|---|
| 0 | 2000 | 2 | … | … | … | … | … | … |
| 0.3 | 2000 | 2 | … | … | … | … | … | … |
| … |

Dipilih: nudge=…, K_h=…, umbrella=… — alasan: …
Catatan: …
```

- [ ] **Step 4: Test masih hijau, commit**

Run: `npx vitest run` → PASS.
```bash
git add scripts/calibrate.mjs docs/calibration.md src/config/simConfig.js
git commit -m "Add calibration script and record v1 parameters"
```

---

### Task 18: Verifikasi akhir + README

**Files:**
- Create: `README.md`
- Modify: tidak ada kode (kecuali bug yang ketemu — perbaiki di file terkait dengan test)

- [ ] **Step 1: Verifikasi browser penuh** (Chrome DevTools MCP atau manual, catat hasil):
  1. `npm run build && npm run preview` → buka URL preview (bukan dev) — memastikan `base: './'` dan worker ter-bundle.
  2. Play 1× dari awal sampai `ended` (≈72 detik) tanpa error konsol; partikel ≤ 20.000; FPS terasa lancar (DevTools performance trace: main thread idle > 60 %).
  3. Scrub mundur ke 5 Sep 12:00 WIB lalu maju lagi → gambar konsisten dengan play.
  4. Pada 5 Sep 23:00 – 6 Sep 10:00 WIB abu rendah terlihat di atas Jakarta; poligon VAAC 179/183 cocok kasar dengan partikel rendah.
  5. Semua toggle, About, Retry, mobile 390 px.
  Kalau ada bug: tulis test yang gagal dulu di modul terkait, perbaiki, commit terpisah (`Fix …`).

- [ ] **Step 2: README.md**

```markdown
# Anak Krakatau Ash Dispersion — 4–6 September 2026

Interactive map replaying how volcanic ash from the September 2026 Anak Krakatau eruption spread across the Sunda Strait, Lampung, Banten and Jakarta. Ash particles are released at the plume height reported by Darwin VAAC, carried by Open-Meteo model winds at seven altitude levels, diffused, nudged toward the official VAAC movement vectors and settled by gravity. Official VAAC ash polygons can be overlaid for comparison.

Built with Vue 3, Vite and Leaflet. No backend.

## Run

    npm install
    npm run build:data   # raw + curated data → public/data (already committed)
    npm run dev          # http://localhost:5173
    npm test             # vitest
    npm run calibrate    # headless run, overlap vs VAAC polygons
    npm run build        # static site in dist/

## Data

Raw inputs and their provenance are documented in `data/SOURCES.md`. Curated timeline/places live in `data/curated/`. Physics parameters are in `src/config/simConfig.js`; calibration results in `docs/calibration.md`. Design spec: `docs/superpowers/specs/2026-09-06-krakatau-ash-dispersion-sim-design.md`.

## Limitations

Winds are model data, not observations; particle counts are illustrative, not mass; several VAAC advisories (163–182) are missing; no ground ash-thickness data was available.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add README"
```

---

## Self-review (dilakukan saat menulis plan)

- **Spec coverage:** §2 replay/kontrol → T10, T13; partikel & endapan → T8–T9, T12; VAAC overlay → T14–T15; panah angin → T15; timeline & marker → T13–T14; batas/marker → T12; §3 pipeline → T4; §4 parameter → T2 (semua nilai persis spec); §4.5 keyframe → T9–T10; §5.2 throttle & transferable → T10–T11; §6 layout, state awal, About → T16; §7 error → T3 (parser throw), T9 (null wind), T11 (worker error), T16 (UI); §8 test & kalibrasi → semua task + T17; §9 batasan di UI → T16; §11 urutan → T1–T18.
- **Placeholder:** tidak ada TBD/TODO; tiap langkah kode berisi kode.
- **Konsistensi nama:** `sample/timeStartMs/timeEndMs/lats/lons/levels` (T5) dipakai T9, T15, T17; `layerMotionAt/latestObsAt/layerForAltitude/all` (T7) dipakai T9, T14, T17; `setFrame/setVisibility` (T12) dipakai T15; `setVisible` (DepositionLayer) dipakai T15; `seeking/aliveCount/currentTimeMs` (T11) dipakai T13; `locatedEventsUpTo/latestEventAt` (T14); `formatWib/formatWibShort/formatUtc` (T13) dipakai T14, T17.
