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
// PM10/PM2.5 CAMS per titik → air-quality.json (Tangerang dilewati: satu sel grid dengan Jakarta)
const STATIONS = [{ index: 0, name: 'Jakarta' }, { index: 2, name: 'Depok' }, { index: 3, name: 'Bandar Lampung' }, { index: 4, name: 'Serang' }]
const cams = JSON.parse(readFileSync(resolve(ROOT, 'data/raw/air-quality/open-meteo-cams-jakarta-serang-lampung.json'), 'utf8'))
const airQuality = {
  source: 'Open-Meteo Air Quality API (CAMS), model data',
  unit: 'µg/m³',
  stations: STATIONS.map(({ index, name }) => {
    const p = cams[index]
    return { name, lat: p.latitude, lon: p.longitude, times: p.hourly.time.map(t => (t.length === 16 ? `${t}:00Z` : t)), pm10: p.hourly.pm10, pm25: p.hourly.pm2_5 }
  }),
}
writeFileSync(resolve(OUT, 'air-quality.json'), JSON.stringify(airQuality))
console.log(`air-quality.json: ${airQuality.stations.map(s => s.name).join(', ')} x ${airQuality.stations[0].times.length} h`)
console.log('done')
