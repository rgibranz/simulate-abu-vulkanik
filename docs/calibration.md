# Kalibrasi v1 — 2026-09-06

Perintah: `npm run calibrate -- --nudge=<α> --kh=<m²/s> --umbrella=<faktor> --umbrellaFraction=<0..1> --near=<km>`

Metrik (spec §8): fraksi partikel lapisan rendah (≤ 6,1 km) di dalam poligon `SFC/FL200` VAAC dan lapisan tinggi di dalam `SFC/FL500`, pada waktu observasi advisory; plus waktu pertama ada partikel rendah dalam radius 60 km dari Jakarta (−6.2, 106.85) dan jumlahnya pada tiap waktu observasi. Seed tetap `20260904`.

Acuan kejadian nyata: poligon VAAC 179 mencakup Jakarta pada Sab 5 Sep 23:10 WIB; Soetta ditutup Min 6 Sep 01:30 WIB; warga Jakarta melihat debu Minggu subuh (~05:00 WIB).

## Hasil sweep (umbrella = 2, umbrellaFraction = 0,6 kecuali disebut)

| nudge | K_h | 175 low | 179 low | 183 low | 184 low | 179 high | Jakarta ≤60 km pertama | rendah dekat JKT @179/183/184 |
|---|---|---|---|---|---|---|---|---|
| 0 | 2000 | 0.40 | 0.16 | 0.42 | 0.90 | 1.00 | — | 0/0/0 |
| 0.3 | 2000 | 0.52 | 0.44 | 0.66 | 0.91 | 1.00 | — | 0/0/0 |
| 0.5 | 2000 | 0.69 | 0.63 | 0.76 | 0.93 | 1.00 | — | — |
| 0.5 | 4000 | 0.67 | 0.63 | 0.74 | 0.92 | 1.00 | Sab 22:10 | 1/4/5 |
| 0.5 | 6000 | — | 0.64 | 0.75 | 0.94 | 1.00 | Sab 22:10 | 1/10/18 |
| 0.7 | 2000 | 0.77 | 0.76 | 0.82 | 0.96 | 1.00 | — | — |
| 0.7 | 4000 | 0.78 | 0.76 | 0.82 | 0.96 | 1.00 | Sab 20:10 | 2/2/21 |
| **0.7** | **6000** | — | **0.76** | **0.82** | **0.95** | **1.00** | **Sab 19:10** | **13/6/26** |
| 0.7 | 8000 | — | 0.76 | 0.82 | 0.96 | 1.00 | Sab 17:10 | 10/7/34 |
| 1.0 | 2000 | 0.81 | 0.83 | 0.86 | 0.96 | 1.00 | Min 10:10 (30 km) | — |
| 1.0 | 6000 | — | 0.83 | 0.84 | 0.95 | 1.00 | Sab 13:10 | 3/2/71 |
| 1.0 | 4000, fraction 0,4 | — | 0.85 | 0.87 | 0.96 | 1.00 | Sab 15:10 | 1/2/103 |

Catatan: dengan radius 30 km hampir semua kombinasi "never" atau baru Minggu pagi — jumlah partikel rendah (~2.000) terlalu sedikit untuk metrik sekecil itu, makanya dipakai 60 km.

## Dipilih

`vaacNudge = 0.7`, `K_h = 6000 m²/s`, `umbrellaFactor = 2`, `umbrellaFraction = 0.6` (dua terakhir tetap default).

Alasan:
- Semua target poligon lolos dengan margin (0.76 / 0.82 / 0.95 ≥ 0.5), lapisan tinggi 1.00.
- Abu rendah mencapai ≤ 60 km dari Jakarta Sabtu 19:10 WIB — sejalan dengan poligon VAAC 179 (23:10 WIB) dan penutupan Soetta dini hari Minggu.
- Masih menyisakan 30 % angin model, jadi bentuk awan tetap mengikuti medan angin (bukan sekadar geser poligon). `nudge = 1` lebih cocok ke poligon tapi mematikan fisika dan menaruh abu di Jakarta terlalu awal (Sabtu siang).
- K_h 6000 m²/s masih dalam rentang difusivitas efektif yang dipakai model dispersi regional (10³–10⁴ m²/s); di bawah 4000 abu rendah tidak pernah menyentuh Jakarta.

## Yang belum memuaskan

- Kepadatan abu rendah di atas Jakarta tetap tipis (puluhan partikel), karena hanya ~13 % emisi yang berada di bawah 6,1 km. Menaikkan `umbrellaFraction` ke 0,4 tidak memperbaiki waktu tiba. Kandidat v2: emisi lapisan rendah terpisah atau lebih banyak partikel.
- Angin model di 850 hPa mendorong ke barat 15–30 km/jam; komponen timur hanya ada di 700 hPa (≈3 km). Kalau nanti dapat data angin analisis (ERA5/BMKG), ulangi sweep ini.

## Addendum 6 Sep 2026 — per model angin (nudge 0,7, K_h 6000, radius Jakarta 60 km)

| model | 175 low | 179 low | 183 low | 184 low | Jakarta ≤60 km pertama | rendah dekat JKT @179/183/184 |
|---|---|---|---|---|---|---|
| best (Open-Meteo) | 0.77 | 0.76 | 0.82 | 0.95 | Sab 19:10 | 13/6/26 |
| ECMWF IFS 0,25° | 0.77 | 0.76 | 0.81 | 0.96 | Sab 19:10 | 13/11/29 |
| GFS | 0.78 | 0.74 | 0.81 | 0.95 | Sab 20:10 | 1/1/26 |
| ICON | 0.77 | 0.76 | 0.82 | 0.95 | Sab 19:10 | 13/6/26 |

Perbedaan antarmodel kecil karena nudge 0,7 mendominasi lapisan rendah; "best match" Open-Meteo ternyata identik dengan ICON di wilayah ini. ECMWF sedikit lebih banyak menaruh abu rendah dekat Jakarta pada 6 Sep 07:10 WIB. Default tetap `best`; pengguna bisa mengganti model di panel lapisan. ERA5 belum tersedia (jeda ±5 hari) — ulangi tabel ini kalau sudah ada.
