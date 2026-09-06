import { ref, shallowRef } from 'vue'

const FILES = { wind: 'wind.json', vaac: 'vaac.json', eruptionSource: 'eruption-source.json', events: 'events.json', places: 'places.json', provinces: 'provinces.json', airQuality: 'air-quality.json' }
// file angin per model (lihat scripts/build-data.mjs)
export const WIND_MODELS = [
  { key: 'best', label: 'Best match (Open-Meteo)', file: 'wind.json' },
  { key: 'ecmwf', label: 'ECMWF IFS 0,25°', file: 'wind-ecmwf.json' },
  { key: 'gfs', label: 'GFS (NOAA)', file: 'wind-gfs.json' },
  { key: 'icon', label: 'ICON (DWD)', file: 'wind-icon.json' },
]

export function useDatasets({ fetchFn = (u) => fetch(u), baseUrl = import.meta.env.BASE_URL } = {}) {
  const status = ref('idle'), error = ref(null), data = shallowRef(null)
  const windCache = new Map()

  async function fetchJson(file) {
    const res = await fetchFn(`${baseUrl}data/${file}`)
    if (!res.ok) throw new Error(`Failed to load ${file} (HTTP ${res.status})`)
    return res.json()
  }

  // dataset opsional: kalau nggak ada, jadi null (bukan error)
  const OPTIONAL_FILES = { himawari: 'himawari/index.json' }

  async function load() {
    status.value = 'loading'; error.value = null
    try {
      const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => [key, await fetchJson(file)]))
      const optional = await Promise.all(Object.entries(OPTIONAL_FILES).map(async ([key, file]) => [key, await fetchJson(file).catch(() => null)]))
      data.value = Object.fromEntries([...entries, ...optional])
      windCache.set('best', data.value.wind)
      status.value = 'ready'
    } catch (e) { error.value = e.message; status.value = 'error' }
  }

  // dataset angin per model, di-cache; 'best' = yang sudah dimuat di load()
  async function loadWind(modelKey) {
    if (windCache.has(modelKey)) return windCache.get(modelKey)
    const model = WIND_MODELS.find(m => m.key === modelKey)
    if (!model) throw new Error(`Unknown wind model: ${modelKey}`)
    const wind = await fetchJson(model.file)
    windCache.set(modelKey, wind)
    return wind
  }

  return { status, error, data, load, loadWind }
}
