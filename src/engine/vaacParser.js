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
