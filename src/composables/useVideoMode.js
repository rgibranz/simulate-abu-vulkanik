// Mode render video: ?video=portrait|landscape|square&variant=regional|ciangsana|teaser|split
// UI disembunyikan, layout kartu/strip untuk sosmed (lihat VideoFrame.vue & scripts/render-video.mjs)
export const SIZES = { portrait: [1080, 1920], landscape: [1920, 1080], square: [1080, 1080] }
export const VARIANTS = ['regional', 'ciangsana', 'teaser', 'split']
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
  split: { landscape: { center: [-6.3, 106.4], zoom: 8 } },
}

export function useVideoMode(search = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search)
  const orientation = params.get('video'), variant = params.get('variant') ?? 'regional'
  const enabled = Boolean(orientation && SIZES[orientation] && VARIANTS.includes(variant))
  if (!enabled) return { enabled: false, orientation: null, variant: null, view: null, focus: null }
  const viewSet = VIEWS[variant === 'teaser' ? 'regional' : variant]
  const base = viewSet[orientation] ?? viewSet.landscape ?? viewSet.portrait
  const [width, height] = SIZES[orientation]
  return { enabled, orientation, variant, view: { ...base, width, height }, focus: FOCUS_POINTS[variant] ?? null }
}
