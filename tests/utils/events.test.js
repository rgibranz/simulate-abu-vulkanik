import { describe, it, expect } from 'vitest'
import { latestEventAt, locatedEventsUpTo } from '../../src/utils/events.js'

const events = [
  { id: 'a', timeUtc: '2026-09-04T16:07:00Z', kind: 'eruption' },
  { id: 'b', timeUtc: '2026-09-05T09:00:00Z', kind: 'ashfall', location: { lat: -5.4, lon: 105.3 } },
  { id: 'c', timeUtc: '2026-09-05T18:30:00Z', kind: 'aviation', location: { lat: -6.1, lon: 106.6 } },
]
describe('events util', () => {
  it('latestEventAt', () => {
    expect(latestEventAt(events, Date.parse('2026-09-04T00:00:00Z'))).toBeNull()
    expect(latestEventAt(events, Date.parse('2026-09-05T10:00:00Z')).id).toBe('b')
  })
  it('locatedEventsUpTo', () => {
    expect(locatedEventsUpTo(events, Date.parse('2026-09-05T10:00:00Z')).map(e => e.id)).toEqual(['b'])
    expect(locatedEventsUpTo(events, Date.parse('2026-09-06T00:00:00Z')).map(e => e.id)).toEqual(['b', 'c'])
  })
})
