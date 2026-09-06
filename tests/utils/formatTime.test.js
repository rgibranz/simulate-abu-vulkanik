import { describe, it, expect } from 'vitest'
import { formatWib, formatWibShort, formatUtc } from '../../src/utils/formatTime.js'

const T = Date.parse('2026-09-05T16:10:00Z')
describe('formatTime', () => {
  it('formats WIB (UTC+7) in Indonesian', () => { expect(formatWib(T)).toBe('Sab 5 Sep 2026 23:10 WIB') })
  it('formats short WIB', () => { expect(formatWibShort(T)).toBe('Sab 23:10') })
  it('formats UTC', () => { expect(formatUtc(T)).toBe('16:10 UTC') })
  it('rolls over the day in WIB', () => { expect(formatWib(Date.parse('2026-09-05T18:30:00Z'))).toBe('Min 6 Sep 2026 01:30 WIB') })
  it('uses Indonesian month names', () => { expect(formatWib(Date.parse('2026-05-01T00:00:00Z'))).toBe('Jum 1 Mei 2026 07:00 WIB') })
})
