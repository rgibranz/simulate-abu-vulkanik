import { describe, it, expect } from 'vitest'
import { useDatasets } from '../../src/composables/useDatasets.js'

const okFetch = async (url) => ({ ok: true, json: async () => ({ url }) })

describe('useDatasets', () => {
  it('loads all six files relative to baseUrl', async () => {
    const ds = useDatasets({ fetchFn: okFetch, baseUrl: '/app/' })
    await ds.load()
    expect(ds.status.value).toBe('ready')
    expect(Object.keys(ds.data.value).sort()).toEqual(['eruptionSource', 'events', 'places', 'provinces', 'vaac', 'wind'])
    expect(ds.data.value.eruptionSource.url).toBe('/app/data/eruption-source.json')
  })
  it('reports which file failed', async () => {
    const ds = useDatasets({ fetchFn: async (url) => ({ ok: !url.endsWith('vaac.json'), status: 404, json: async () => ({}) }), baseUrl: '/' })
    await ds.load()
    expect(ds.status.value).toBe('error'); expect(ds.error.value).toMatch(/vaac\.json/)
  })
})
