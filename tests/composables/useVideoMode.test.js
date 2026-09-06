import { describe, it, expect } from 'vitest'
import { useVideoMode } from '../../src/composables/useVideoMode.js'

describe('useVideoMode', () => {
  it('is disabled without a valid query', () => {
    expect(useVideoMode('').enabled).toBe(false)
    expect(useVideoMode('?video=nope').enabled).toBe(false)
    expect(useVideoMode('?video=portrait&variant=nope').enabled).toBe(false)
  })
  it('enables portrait, landscape and square with sizes', () => {
    const p = useVideoMode('?video=portrait'); expect(p.enabled).toBe(true); expect(p.variant).toBe('regional'); expect(p.view.width).toBe(1080); expect(p.view.height).toBe(1920)
    const l = useVideoMode('?video=landscape'); expect(l.view.zoom).toBe(8); expect(l.view.width).toBe(1920)
    const s = useVideoMode('?video=square'); expect(s.view.width).toBe(1080); expect(s.view.height).toBe(1080)
  })
  it('ciangsana zooms in and carries a focus point', () => {
    const c = useVideoMode('?video=portrait&variant=ciangsana')
    expect(c.view.zoom).toBe(9); expect(c.focus.name).toMatch(/Ciangsana/); expect(c.focus.radiusKm).toBe(30)
  })
  it('teaser reuses the regional view; split falls back to landscape view', () => {
    expect(useVideoMode('?video=portrait&variant=teaser').view.zoom).toBe(8)
    const sp = useVideoMode('?video=landscape&variant=split'); expect(sp.variant).toBe('split'); expect(sp.focus).toBeNull()
  })
})
