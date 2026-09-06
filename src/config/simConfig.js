// Semua parameter simulasi (spec §4). Kalibrasi = ubah angka di sini.
export const simConfig = {
  seed: 20260904,
  startUtc: '2026-09-04T00:00:00Z',
  endUtc: '2026-09-07T00:00:00Z',
  stepSec: 600,
  keyframeSec: 3600,
  maxParticles: 20000,
  vent: { lat: -6.102, lon: 105.423 },
  domain: { latMin: -11, latMax: -2, lonMin: 100, lonMax: 112 },
  emission: {
    basePerStep: 60, // partikel per 10 menit saat H = refHeightKm
    refHeightKm: 15.2,
    minFactor: 0.05,
    umbrellaFraction: 0.6, // porsi partikel di pita [0.7H, H]
    umbrellaBandLow: 0.7,
    lowBandFloor: 0.1,
    umbrellaFactor: 2, // R_umbrella (km) = umbrellaFactor * H
  },
  sizeClasses: [
    { name: 'fine', fraction: 0.5, settleMps: 0.01, depositWeight: 0.2 },
    { name: 'medium', fraction: 0.35, settleMps: 0.1, depositWeight: 0.5 },
    { name: 'coarse', fraction: 0.15, settleMps: 0.5, depositWeight: 1.0 },
  ],
  // hasil kalibrasi v1 (docs/calibration.md): K_h 6000, nudge 0.7
  diffusion: { horizontalM2s: 6000, verticalSigmaMPerStep: 100 },
  vaacNudge: 0.7,
  lowLayerTopKm: 6.1,
  deposition: { cellDeg: 0.1 },
  levels: [
    { name: '10m', altKm: 0.01 },
    { name: '850hPa', altKm: 1.5 },
    { name: '700hPa', altKm: 3.0 },
    { name: '500hPa', altKm: 5.6 },
    { name: '300hPa', altKm: 9.2 },
    { name: '200hPa', altKm: 11.8 },
    { name: '100hPa', altKm: 16.2 },
  ],
}
