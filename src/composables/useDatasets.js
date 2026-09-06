import { ref, shallowRef } from 'vue'

const FILES = { wind: 'wind.json', vaac: 'vaac.json', eruptionSource: 'eruption-source.json', events: 'events.json', places: 'places.json', provinces: 'provinces.json', airQuality: 'air-quality.json' }

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
