// Mode render video: ?video=portrait|landscape|square&variant=regional|ciangsana|teaser|split|wind
// UI disembunyikan, layout kartu/strip untuk sosmed (lihat VideoFrame.vue & scripts/render-video.mjs)
export const SIZES = { portrait: [1080, 1920], landscape: [1920, 1080], square: [1080, 1080] }
export const VARIANTS = ['regional', 'ciangsana', 'teaser', 'split', 'wind']
export const FOCUS_POINTS = { ciangsana: { name: 'Ciangsana, Gunung Putri', lat: -6.38, lon: 106.93, radiusKm: 30 } }

// center/zoom per varian × orientasi; strip teks menutupi ±30 % bagian bawah (portrait/square)
const VIEWS = {
  regional: {
    portrait: { center: [-6.7, 106.2], zoom: 8 },
    landscape: { center: [-6.3, 106.4], zoom: 8 },
    square: { center: [-6.5, 106.3], zoom: 8 },
  },
  ciangsana: {
    portrait: { center: [-6.45, 106.2], zoom: 9 },
    landscape: { center: [-6.3, 106.4], zoom: 9 },
    square: { center: [-6.35, 106.2], zoom: 9 },
  },
  split: {
    landscape: { center: [-6.3, 106.4], zoom: 8 }, // dua panel berdampingan, 960 px tiap panel
    portrait: { center: [-6.4, 106.3], zoom: 8 }, // dua panel bertumpuk, 1080×960 tiap panel
  },
}

// varian "wind": adegan terprogram — tiap adegan punya jendela waktu, level panah angin, dan layer sendiri
// windLevel = indeks simConfig.levels (1 = 850 hPa, 2 = 700 hPa, 5 = 200 hPa)
// durasi pendek buat Threads: 4 adegan × ±4 detik
export const WIND_SCENES = [
  { id: 'high', start: '2026-09-05T00:00:00Z', end: '2026-09-05T06:00:00Z', hoursPerSec: 1.5,
    layers: { wind: true, windLevel: 5, lowAsh: false, highAsh: true, ashfall: false, vaac: false },
    level: '12 km (200 hPa)', title: 'Di 12 km, angin dari timur 60–100 km/jam', text: 'Abu tinggi, sampai 15 km, terbawa ke barat: Lampung, Bengkulu, Samudra Hindia.' },
  { id: 'low850', start: '2026-09-05T06:00:00Z', end: '2026-09-05T12:00:00Z', hoursPerSec: 1.5,
    layers: { wind: true, windLevel: 1, lowAsh: true, highAsh: false, ashfall: false, vaac: false },
    level: '1,5 km (850 hPa)', title: 'Di 1,5 km masih ke barat, 15–30 km/jam', text: 'Kalau cuma ini, Jakarta aman.' },
  { id: 'low700', start: '2026-09-05T12:00:00Z', end: '2026-09-06T00:00:00Z', hoursPerSec: 3,
    layers: { wind: true, windLevel: 2, lowAsh: true, highAsh: false, ashfall: false, vaac: true },
    level: '3 km (700 hPa)', title: 'Tapi di ±3 km ada angin tipis ke tenggara–timur, 8–19 km/jam', text: 'Abu rendah numpang di lapisan ini. Pelan, tapi arahnya ke Jakarta.' },
  { id: 'arrive', start: '2026-09-05T16:00:00Z', end: '2026-09-06T04:00:00Z', hoursPerSec: 3,
    layers: { wind: false, windLevel: 2, lowAsh: true, highAsh: false, ashfall: true, vaac: true },
    level: '', title: 'Sabtu 23:10 WIB, awan VAAC sampai Jakarta', text: 'Minggu 01:30 Soekarno-Hatta ditutup. Menjelang subuh warga Jakarta, Depok, dan Bogor menemukan debu di teras.' },
]

export function useVideoMode(search = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search)
  const orientation = params.get('video'), variant = params.get('variant') ?? 'regional'
  const enabled = Boolean(orientation && SIZES[orientation] && VARIANTS.includes(variant))
  if (!enabled) return { enabled: false, orientation: null, variant: null, view: null, focus: null, scenes: null }
  const viewSet = VIEWS[variant] ?? VIEWS.regional
  const base = viewSet[orientation] ?? viewSet.landscape ?? viewSet.portrait
  const [width, height] = SIZES[orientation]
  return { enabled, orientation, variant, view: { ...base, width, height }, focus: FOCUS_POINTS[variant] ?? null, scenes: variant === 'wind' ? WIND_SCENES : null }
}
