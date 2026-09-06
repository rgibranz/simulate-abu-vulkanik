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
