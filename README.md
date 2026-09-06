# Sebaran Abu Anak Krakatau — 4–6 September 2026

Peta interaktif yang memutar ulang sebaran abu vulkanik erupsi Anak Krakatau September 2026 dari Selat Sunda ke Lampung, Banten, dan Jakarta. Partikel abu dilepaskan setinggi kolom yang dilaporkan VAAC Darwin, dibawa angin model di tujuh level ketinggian, disebar difusi, didorong ke vektor gerak resmi VAAC, dan diendapkan gravitasi. Pembanding yang bisa ditampilkan: poligon abu VAAC (observasi + prakiraan), citra Himawari-9 per jam, PM10 model CAMS, dan laporan hujan abu dari berita/BPBD.

Dibangun dengan Vue 3, Vite, dan Leaflet. Tanpa backend — situs statis.

## Menjalankan

    npm install
    npm run dev            # http://localhost:5173
    npm test               # vitest
    npm run build          # situs statis di dist/ (menjalankan build:data dulu)

Data turunan di `public/data/` sudah di-commit, jadi `npm run dev` langsung jalan. Untuk membangun ulang:

    npm run build:data     # data/raw + data/curated → public/data/*.json
    npm run build:himawari # unduh tile Himawari-9 dari RAMMB/CIRA SLIDER, reproyeksi → public/data/himawari/
    npm run calibrate -- --wind=ecmwf --nudge=0.7 --kh=6000 --near=60   # uji overlap vs poligon VAAC

## Deploy ke GitHub Pages

Workflow `.github/workflows/deploy.yml` membangun dan menerbitkan `dist/` setiap push ke `main`. Sekali saja: di repo GitHub buka **Settings → Pages → Build and deployment → Source: GitHub Actions**. `base: './'` di `vite.config.js` membuat aset relatif, jadi jalan di `https://<user>.github.io/<repo>/`.

## Data

Asal-usul data mentah ada di `data/SOURCES.md`; kronologi dan tempat yang dikurasi di `data/curated/`. Parameter fisika di `src/config/simConfig.js`; hasil kalibrasi di `docs/calibration.md`. Spec desain: `docs/superpowers/specs/2026-09-06-krakatau-ash-dispersion-sim-design.md`.

## Batasan

Angin adalah data model (Open-Meteo best match, ECMWF IFS, GFS, ICON), bukan pengamatan; ERA5 belum tersedia saat dibuat. Jumlah partikel hanya ilustrasi, bukan massa. Sebagian advisory VAAC (163–182) tidak tersedia. Tidak ada data ketebalan abu di darat; jam laporan hujan abu sebagian perkiraan dari berita. Lihat panel "Tentang" di aplikasi.
