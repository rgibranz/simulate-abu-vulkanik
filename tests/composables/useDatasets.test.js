import { describe, it, expect } from 'vitest'
import { useDatasets } from '../../src/composables/useDatasets.js'

const okFetch = async (url) => ({ ok: true, json: async () => ({ url }) })

describe('useDatasets', () => {
  it('loads all seven files relative to baseUrl', async () => {
    const ds = useDatasets({ fetchFn: okFetch, baseUrl: '/app/' })
    await ds.load()
    expect(ds.status.value).toBe('ready')
    expect(Object.keys(ds.data.value).sort()).toEqual(['airQuality', 'eruptionSource', 'events', 'himawari', 'places', 'provinces', 'vaac', 'wind'])
    expect(ds.data.value.eruptionSource.url).toBe('/app/data/eruption-source.json')
  })
  it('loadWind fetches model files once and reuses the default', async () => {
    const calls = []
    const ds = useDatasets({ fetchFn: async (url) => { calls.push(url); return { ok: true, json: async () => ({ url }) } }, baseUrl: '/' })
    await ds.load()
    const n = calls.length
    expect(await ds.loadWind('best')).toBe(ds.data.value.wind)
    const ecmwf = await ds.loadWind('ecmwf'); await ds.loadWind('ecmwf')
    expect(ecmwf.url).toBe('/data/wind-ecmwf.json'); expect(calls.length).toBe(n + 1)
    await expect(ds.loadWind('nope')).rejects.toThrow(/Unknown wind model/)
  })
  it('tolerates a missing optional dataset', async () => {
    const ds = useDatasets({ fetchFn: async (url) => ({ ok: !url.includes('himawari'), status: 404, json: async () => ({ url }) }), baseUrl: '/' })
    await ds.load()
    expect(ds.status.value).toBe('ready'); expect(ds.data.value.himawari).toBeNull()
  })
  it('reports which file failed', async () => {
    const ds = useDatasets({ fetchFn: async (url) => ({ ok: !url.endsWith('vaac.json'), status: 404, json: async () => ({}) }), baseUrl: '/' })
    await ds.load()
    expect(ds.status.value).toBe('error'); expect(ds.error.value).toMatch(/vaac\.json/)
  })
})
