export const WIB_OFFSET_MS = 7 * 3600e3
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const pad = (n) => String(n).padStart(2, '0')

// geser ke WIB lalu baca komponen UTC-nya (nggak bergantung timezone mesin)
function wibParts(tMs) {
  const d = new Date(tMs + WIB_OFFSET_MS)
  return { day: DAYS[d.getUTCDay()], date: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), hh: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()) }
}
export function formatWib(tMs) { const p = wibParts(tMs); return `${p.day} ${p.date} ${p.month} ${p.year} ${p.hh}:${p.mm} WIB` }
export function formatWibShort(tMs) { const p = wibParts(tMs); return `${p.day} ${p.hh}:${p.mm}` }
export function formatUtc(tMs) { const d = new Date(tMs); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` }
