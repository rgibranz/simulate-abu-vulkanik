import { describe, it, expect } from 'vitest'
import { formatWib, formatWibShort, formatUtc } from '../../src/utils/formatTime.js'

const T = Date.parse('2026-09-05T16:10:00Z')
describe('formatTime', () => {
  it('formats WIB (UTC+7)', () => { expect(formatWib(T)).toBe('Sat 5 Sep 2026 23:10 WIB') })
  it('formats short WIB', () => { expect(formatWibShort(T)).toBe('Sat 23:10') })
  it('formats UTC', () => { expect(formatUtc(T)).toBe('16:10 UTC') })
  it('rolls over the day in WIB', () => { expect(formatWib(Date.parse('2026-09-05T18:30:00Z'))).toBe('Sun 6 Sep 2026 01:30 WIB') })
})
