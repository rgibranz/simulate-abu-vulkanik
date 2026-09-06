import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseVaacText, parseCloudLayers, parseCoordPair } from '../../src/engine/vaacParser.js'

const SAMPLE = `######## a
FVAU04 at 00:31 UTC, 05/09/26 from ADRM
VA ADVISORY
DTG: 20260905/0030Z
VAAC: DARWIN
VOLCANO: KRAKATAU 262000
PSN: S0606 E10525
ADVISORY NR: 2026/171
ERUPTION DETAILS: VA TO FL500 MOV W, VA TO FL200 MOV S TO
        ESE
OBS VA DTG: 05/0010Z
OBS VA CLD: SFC/FL200 S0552 E10510 - S0552 E10605 - S0643
        E10655 - S0732 E10559 - S0654 E10419 MOV SE 10KT SFC/FL500
        S0623 E10548 - S0736 E10204 - S0702 E10046 - S0529 E10047 -
        S0448 E10304 - S0540 E10548 MOV W 40KT
FCST VA CLD +6 HR: 05/0610Z SFC/FL500 S0625 E10548 - S0910
        E09757 - S0604 E09634 SFC/FL200 S0546 E10511 - S0622 E10737
        - S0754 E10738
FCST VA CLD +12 HR: 05/1210Z NOT AVBL
FCST VA CLD +18 HR: 05/1810Z NOT AVBL
RMK: CONTINUOUS VA.
NXT ADVISORY: NO LATER THAN 20260905/0230Z=

######## b (BOM style, no indentation)
FVAU04 ADRM 040330
VA ADVISORY
DTG: 20260904/1025Z
ADVISORY NR: 2026/162
OBS VA DTG: 04/1000Z
OBS VA CLD: SFC/FL050 S0603 E10533 - S0726 E10439 - S0710
E10354 - S0625 E10350 - S0555 E10527 MOV SW 05KT
FCST VA CLD +6 HR: 04/1600Z SFC/FL050 S0611 E10530 - S0623
E10406 - S0542 E10342
RMK: X
NXT ADVISORY: NO LATER THAN 20260904/1625Z=
`

describe('parseCoordPair', () => {
  it('converts S0606 E10525 to decimal degrees', () => {
    expect(parseCoordPair('S0606', 'E10525')).toEqual([-6.1, 105.4167])
  })
})

describe('parseCloudLayers', () => {
  it('splits two layers with motion', () => {
    const layers = parseCloudLayers('SFC/FL200 S0552 E10510 - S0552 E10605 MOV SE 10KT SFC/FL500 S0623 E10548 - S0736 E10204 MOV W 40KT')
    expect(layers).toHaveLength(2)
    expect(layers[0]).toMatchObject({ topFl: 200, moveDeg: 135, moveKt: 10 })
    expect(layers[0].topKm).toBeCloseTo(6.096, 3)
    expect(layers[0].polygon).toEqual([[-5.8667, 105.1667], [-5.8667, 106.0833]])
    expect(layers[1]).toMatchObject({ topFl: 500, moveDeg: 270, moveKt: 40 })
  })
  it('returns [] for NOT AVBL', () => {
    expect(parseCloudLayers('NOT AVBL')).toEqual([])
  })
})

describe('parseVaacText', () => {
  const advisories = parseVaacText(SAMPLE)
  it('parses both blocks sorted by obs time', () => {
    expect(advisories.map(a => a.nr)).toEqual(['2026/162', '2026/171'])
  })
  it('parses times', () => {
    const a = advisories[1]
    expect(a.issuedUtc).toBe('2026-09-05T00:30:00Z')
    expect(a.obsUtc).toBe('2026-09-05T00:10:00Z')
  })
  it('parses obs layers across wrapped lines', () => {
    const a = advisories[1]
    expect(a.layers).toHaveLength(2)
    expect(a.layers[0].polygon).toHaveLength(5)
    expect(a.layers[1].polygon).toHaveLength(6)
    expect(a.layers[1].moveDeg).toBe(270)
  })
  it('parses forecasts and skips NOT AVBL', () => {
    const a = advisories[1]
    expect(a.forecasts.map(f => f.hours)).toEqual([6, 12, 18])
    expect(a.forecasts[0].validUtc).toBe('2026-09-05T06:10:00Z')
    expect(a.forecasts[0].layers.map(l => l.topFl)).toEqual([500, 200])
    expect(a.forecasts[1].layers).toEqual([])
  })
  it('handles BOM style continuation without indent', () => {
    expect(advisories[0].layers[0].polygon).toHaveLength(5)
    expect(advisories[0].layers[0].moveDeg).toBe(225)
  })
  it('parses the real raw file', () => {
    const text = readFileSync('data/raw/vaac/vaac-darwin-krakatau-2026-09.txt', 'utf8')
    const all = parseVaacText(text)
    expect(all.map(a => a.nr)).toEqual(['2026/162', '2026/164', '2026/171', '2026/175', '2026/179', '2026/183', '2026/184'])
    const last = all.at(-1)
    expect(last.obsUtc).toBe('2026-09-06T03:10:00Z')
    expect(last.layers.map(l => l.topFl)).toEqual([200, 500])
    expect(last.layers[0].polygon).toHaveLength(5)
    expect(last.layers[0].moveDeg).toBe(270)
    expect(last.layers[1].moveDeg).toBe(225)
  })
})
