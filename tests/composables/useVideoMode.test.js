import { describe, it, expect } from 'vitest'
import { useVideoMode } from '../../src/composables/useVideoMode.js'

describe('useVideoMode', () => {
  it('is disabled without the query param', () => {
    expect(useVideoMode('')).toEqual({ enabled: false, orientation: null, view: null })
    expect(useVideoMode('?video=nope').enabled).toBe(false)
  })
  it('enables portrait and landscape with their views', () => {
    const p = useVideoMode('?video=portrait'); expect(p.enabled).toBe(true); expect(p.view.width).toBe(1080); expect(p.view.height).toBe(1920)
    const l = useVideoMode('?video=landscape'); expect(l.orientation).toBe('landscape'); expect(l.view.zoom).toBe(8)
  })
})
