// Unduh tile Himawari-9 (RAMMB/CIRA SLIDER) per jam, reproyeksi ke Web Mercator, simpan JPEG + index.json
// Pakai: node scripts/build-himawari.mjs [--start=2026-09-04T16:00Z] [--end=2026-09-07T00:00Z] [--step=60] [--probe] [--force]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PNG } from 'pngjs'
import jpeg from 'jpeg-js'
import { latLonToGridPx, gridToSlider } from './lib/geos.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const RAW = resolve(ROOT, 'data/raw/himawari') // cache tile mentah (gitignored, ~200 MB)
const OUT = resolve(ROOT, 'public/data/himawari')
const BASE = 'https://slider.cira.colostate.edu'
const PRODUCT = 'geocolor', ZOOM = 3, TILE = 688
const BBOX = { west: 100, east: 112, south: -11, north: -2 }
const OUT_W = 960, JPEG_QUALITY = 80

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] }))
const startMs = Date.parse(args.start ?? '2026-09-04T16:00:00Z'), endMs = Date.parse(args.end ?? '2026-09-07T00:00:00Z')
const stepMs = Number(args.step ?? 60) * 60e3
const probe = Boolean(args.probe), force = Boolean(args.force)

mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true })

// grid output Web Mercator
const mercY = (latDeg) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360))
const pxPerRad = OUT_W / ((BBOX.east - BBOX.west) * Math.PI / 180)
const yN = mercY(BBOX.north), yS = mercY(BBOX.south)
const OUT_H = Math.round((yN - yS) * pxPerRad)

// tile mana saja yang dibutuhkan: proyeksikan sampel di sepanjang tepi bbox
function neededTiles() {
  const set = new Set()
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const lon = BBOX.west + (i / 24) * (BBOX.east - BBOX.west), lat = BBOX.south + (j / 24) * (BBOX.north - BBOX.south)
    const g = latLonToGridPx(lat, lon); if (!g) continue
    const t = gridToSlider(g.col, g.line, { zoom: ZOOM, tilePx: TILE })
    set.add(`${t.tileRow},${t.tileCol}`)
  }
  return [...set].map(s => s.split(',').map(Number))
}
const TILES = neededTiles()

const pad = (n, w = 2) => String(n).padStart(w, '0')
const stamp = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00` }
const dayPath = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}` }

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (krakatau-ash-sim)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

// timestamp SLIDER terdekat ke jam bulat (per hari ada daftar per 10 menit)
const byHourCache = new Map()
async function availableStamp(ms) {
  const d = new Date(ms), day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  if (!byHourCache.has(day)) {
    try { byHourCache.set(day, JSON.parse((await fetchBuffer(`${BASE}/data/json/himawari/full_disk/${PRODUCT}/${day}_by_hour.json`)).toString('utf8')).timestamps_int) }
    catch { byHourCache.set(day, null) }
  }
  const list = byHourCache.get(day)?.[pad(d.getUTCHours())]
  if (!list || !list.length) return stamp(ms)
  const want = Number(stamp(ms))
  return String(list.reduce((best, t) => (Math.abs(t - want) < Math.abs(best - want) ? t : best), list[0]))
}

// pngjs nggak suka byte sisa setelah IEND
function decodePng(buf) {
  const i = buf.indexOf(Buffer.from('IEND'))
  return PNG.sync.read(i > 0 ? buf.subarray(0, i + 8) : buf)
}

async function loadTiles(ts, dayDir) {
  const tiles = new Map()
  for (const [row, col] of TILES) {
    const file = resolve(RAW, `${PRODUCT}_${ts}_${ZOOM}_${pad(row, 3)}_${pad(col, 3)}.png`)
    if (!existsSync(file)) writeFileSync(file, await fetchBuffer(`${BASE}/data/imagery/${dayDir}/himawari---full_disk/${PRODUCT}/${ts}/${pad(ZOOM, 2)}/${pad(row, 3)}_${pad(col, 3)}.png`))
    tiles.set(`${row},${col}`, decodePng(readFileSync(file)))
  }
  return tiles
}

function reproject(tiles) {
  const out = Buffer.alloc(OUT_W * OUT_H * 4)
  for (let j = 0; j < OUT_H; j++) {
    const lat = ((2 * Math.atan(Math.exp(yN - (j + 0.5) / pxPerRad)) - Math.PI / 2) * 180) / Math.PI
    for (let i = 0; i < OUT_W; i++) {
      const lon = BBOX.west + ((i + 0.5) / OUT_W) * (BBOX.east - BBOX.west)
      const g = latLonToGridPx(lat, lon)
      const o = (j * OUT_W + i) * 4
      if (!g) { out[o + 3] = 255; continue }
      const t = gridToSlider(g.col, g.line, { zoom: ZOOM, tilePx: TILE })
      const png = tiles.get(`${t.tileRow},${t.tileCol}`)
      if (!png) { out[o + 3] = 255; continue }
      const x = Math.min(png.width - 1, Math.floor(t.du)), y = Math.min(png.height - 1, Math.floor(t.dv))
      const s = (y * png.width + x) * 4
      out[o] = png.data[s]; out[o + 1] = png.data[s + 1]; out[o + 2] = png.data[s + 2]; out[o + 3] = 255
    }
  }
  return out
}

// penanda kecil buat cek georeferensi saat --probe
function drawCross(buf, lat, lon) {
  const i = Math.round(((lon - BBOX.west) / (BBOX.east - BBOX.west)) * OUT_W), j = Math.round((yN - mercY(lat)) * pxPerRad)
  for (let d = -8; d <= 8; d++) for (const [x, y] of [[i + d, j], [i, j + d]]) {
    if (x < 0 || y < 0 || x >= OUT_W || y >= OUT_H) continue
    const o = (y * OUT_W + x) * 4; buf[o] = 255; buf[o + 1] = 40; buf[o + 2] = 40
  }
}

async function main() {
  console.log(`region ${BBOX.west}–${BBOX.east}E ${BBOX.south}–${BBOX.north}N → ${OUT_W}x${OUT_H}px, zoom ${ZOOM}, tiles ${TILES.map(t => t.join('/')).join(' ')}`)
  const frames = []
  const times = probe ? [startMs] : Array.from({ length: Math.floor((endMs - startMs) / stepMs) + 1 }, (_, k) => startMs + k * stepMs)
  for (const ms of times) {
    const ts = await availableStamp(ms)
    const file = `${ts}.jpg`, outPath = probe ? resolve(RAW, `probe_${ts}.jpg`) : resolve(OUT, file)
    if (!force && !probe && existsSync(outPath)) { frames.push({ time: new Date(ms).toISOString(), file, obs: ts }); continue }
    try {
      const tiles = await loadTiles(ts, dayPath(ms))
      const rgba = reproject(tiles)
      if (probe) { drawCross(rgba, -6.102, 105.423); drawCross(rgba, -6.2, 106.85); drawCross(rgba, -5.43, 105.26) }
      writeFileSync(outPath, jpeg.encode({ data: rgba, width: OUT_W, height: OUT_H }, JPEG_QUALITY).data)
      frames.push({ time: new Date(ms).toISOString(), file, obs: ts })
      console.log(`${new Date(ms).toISOString()} ← ${ts} ok`)
    } catch (err) { console.log(`${new Date(ms).toISOString()} skipped: ${err.message}`) }
  }
  if (!probe) {
    writeFileSync(resolve(OUT, 'index.json'), JSON.stringify({ product: PRODUCT, source: 'Himawari-9 via RAMMB/CIRA SLIDER', bounds: [[BBOX.south, BBOX.west], [BBOX.north, BBOX.east]], width: OUT_W, height: OUT_H, frames }, null, 1))
    console.log(`index.json: ${frames.length} frames`)
  } else console.log(`probe written to ${resolve(RAW, 'probe_*.jpg')}`)
}
main().catch(err => { console.error(err); process.exit(1) })
