import { describe, it, expect } from 'vitest'
import { pickFrame } from '../../src/utils/satelliteFrames.js'

const frames = [
  { time: '2026-09-05T00:00:00Z', file: 'a.jpg' },
  { time: '2026-09-05T01:00:00Z', file: 'b.jpg' },
  { time: '2026-09-05T03:00:00Z', file: 'c.jpg' },
]
describe('pickFrame', () => {
  it('returns the latest frame at or before t', () => {
    expect(pickFrame(frames, Date.parse('2026-09-05T01:30:00Z')).file).toBe('b.jpg')
    expect(pickFrame(frames, Date.parse('2026-09-05T01:00:00Z')).file).toBe('b.jpg')
  })
  it('returns null before the first frame or when the gap is too large', () => {
    expect(pickFrame(frames, Date.parse('2026-09-04T23:00:00Z'))).toBeNull()
    expect(pickFrame(frames, Date.parse('2026-09-05T02:45:00Z'))).toBeNull() // 1h45 setelah b, > 90 menit
    expect(pickFrame(frames, Date.parse('2026-09-05T02:45:00Z'), 3 * 3600e3).file).toBe('b.jpg')
  })
})
