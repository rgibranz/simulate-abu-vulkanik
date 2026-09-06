# Anak Krakatau Ash Dispersion — 4–6 September 2026

Interactive map replaying how volcanic ash from the September 2026 Anak Krakatau eruption spread across the Sunda Strait, Lampung, Banten and Jakarta. Ash particles are released at the plume height reported by Darwin VAAC, carried by Open-Meteo model winds at seven altitude levels, diffused, nudged toward the official VAAC movement vectors and settled by gravity. Official VAAC ash polygons can be overlaid for comparison.

Built with Vue 3, Vite and Leaflet. No backend — the whole thing is a static site.

## Run

    npm install
    npm run build:data   # raw + curated data → public/data (already committed)
    npm run dev          # http://localhost:5173
    npm test             # vitest
    npm run calibrate    # headless run, overlap vs VAAC polygons
    npm run build        # static site in dist/

## Data

Raw inputs and their provenance are documented in `data/SOURCES.md`. Curated timeline and places live in `data/curated/`. Physics parameters are in `src/config/simConfig.js`; calibration results in `docs/calibration.md`. Design spec: `docs/superpowers/specs/2026-09-06-krakatau-ash-dispersion-sim-design.md`.

## Limitations

Winds are model data, not observations; particle counts are illustrative, not mass; several VAAC advisories (163–182) are missing; no ground ash-thickness data was available. See the About panel in the app for the full list.
