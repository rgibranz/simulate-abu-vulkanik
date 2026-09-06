# Sumber Data — Erupsi Anak Krakatau 4–6 September 2026

Semua data mentah ada di `data/raw/`. Diambil 6 Sep 2026 (WIB). File di sini **jangan diedit manual** — kalau perlu bentuk lain, turunkan ke `data/processed/` (belum ada).

## 1. VAAC Darwin — advisory awan abu (`raw/vaac/`)

`vaac-darwin-krakatau-2026-09.txt` — teks mentah advisory (format ICAO). Tiap advisory punya:
- `OBS VA CLD` : poligon awan abu teramati per lapisan (`SFC/FL200` = permukaan–20.000 ft, `SFC/FL500` = permukaan–50.000 ft), koordinat `S0606 E10525` = 6°06'S 105°25'E, arah + kecepatan gerak (knot).
- `FCST VA CLD +6/+12/+18 HR` : prakiraan poligon dari model dispersi.

| Nr | OBS DTG (UTC) | WIB | Lapisan | Catatan |
|---|---|---|---|---|
| 162 | 04/1000Z | 4 Sep 17:00 | SFC/FL050 | sebelum erupsi besar, gerak SW 5 kt |
| 164 | 04/1630Z | 4 Sep 23:30 | SFC/FL450 | awal erupsi besar, gerak W 5 kt |
| 171 | 05/0010Z | 5 Sep 07:10 | FL200 SE 10 kt, FL500 W 40 kt | dua lapisan mulai terpisah |
| 175 | 05/0810Z | 5 Sep 15:10 | FL200 SE 10 kt, FL500 W 30 kt | |
| 179 | 05/1610Z | 5 Sep 23:10 | FL200 SE 10 kt, FL500 W 30 kt | poligon FL200 sudah mencakup Jakarta |
| 183 | 06/0010Z | 6 Sep 07:10 | FL200 E 10 kt, FL500 W 30 kt | |
| 184 | 06/0310Z | 6 Sep 10:10 | FL200 W 10 kt, FL500 SW 20 kt | FL500 lepas dari gunung; sisa abu lama masih hanyut ke E |

Yang **bolong**: 163, 165–170, 172–174, 176–178, 180–182 (VolcanoDiscovery cuma repost sebagian; BOM cuma expose advisory terkini). Dari Watchers: 163 = FL070 @ 04/1600Z; 165 = FL480 W 93 km/jam @ 04/1640Z; 167 = FL480 W 74 km/jam + FL180 S 19 km/jam @ 04/1850Z.

Sumber:
- 162–183: https://www.volcanodiscovery.com/krakatau/news.html (halaman per advisory: `/krakatau/news/<id>/vaac-advisory-2026-<nr>.html`)
- 184: `POST https://www.bom.gov.au/aviation/php/process.php` body `page=volcanic-ash-darwin&javascript=1` → JSON advisory terkini (disimpan `bom-darwin-current-*.json`), grafik `https://www.bom.gov.au/fwo/IDY65305.png`
- Ringkasan 163–167: https://watchers.news/2026/09/04/high-level-eruption-at-anak-krakatau-ejects-ash-over-15-km-50-000-feet-a-s-l-indonesia/

## 2. Angin per ketinggian (`raw/wind/`)

Open-Meteo Forecast API (data model, bukan observasi — tapi VAAC juga pakai model guidance). Level: 10 m, 850 hPa (~1,5 km), 700 (~3 km), 500 (~5,5 km), 300 (~9 km), 200 (~12 km), 100 (~16 km). Satuan km/jam, arah = dari mana angin datang (meteorologis).

- `open-meteo-krakatau-point-2026-09-04_07.json` — 1 titik (−6.102, 105.423), jam WIB (`timezone=Asia/Jakarta`).
- `open-meteo-grid-1deg-2026-09-04_07.json` — grid 1° lat −2…−11, lon 100…112 (130 titik), **jam UTC**. Array of point objects.

URL: `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&hourly=wind_speed_10m,wind_direction_10m,wind_speed_850hPa,…,wind_direction_100hPa&start_date=2026-09-04&end_date=2026-09-07&wind_speed_unit=kmh`

## 3. Kualitas udara (`raw/air-quality/`)

`open-meteo-cams-jakarta-serang-lampung.json` — CAMS (Copernicus) pm10, pm2_5, dust, AOD per jam UTC, 3–7 Sep, titik: Jakarta Pusat, Tangerang/Soetta (satu grid dengan Jakarta), Depok/Jaksel, Bandar Lampung, Serang. Data model, cuma indikasi: Serang puncak PM10 ≈140 µg/m³ @ 05/2000Z (6 Sep 03:00 WIB), Jakarta naik 52 → 82 antara 05/2100Z–06/0000Z. Lampung nggak kelihatan lonjakan (model nggak nangkep abunya).

## 4. Batas provinsi (`raw/geo/`)

- `indonesia-province-simple.json` (185 KB, 32 provinsi, disederhanakan) — https://github.com/superpikar/indonesia-geojson
- `indonesia-prov.geojson` (728 KB, 34 provinsi) — https://github.com/ans-4175/peta-indonesia-geojson

Properti nama: `Propinsi` (huruf besar, misal `DKI JAKARTA`, `JAWA BARAT`, `LAMPUNG`, `BANTEN`/`PROBANTEN`).

## 5. Fakta kejadian (dari berita, kualitatif)

| Waktu (WIB) | Kejadian | Sumber |
|---|---|---|
| Jum 4 Sep 23:07 | Erupsi besar mulai, tremor 21.600 s amplitudo 70 mm | Bridge Note, TIMES |
| Sab 5 Sep 00:50 | Kolom ±15 km (JMA/VAAC) | Watchers |
| Sab 5 Sep 02:00 UTC | VONA RED (MAGMA #22575) | magma.esdm.go.id |
| Sab 5 Sep sore–malam | Hujan abu Bandar Lampung, Lampung Selatan, Pesawaran, Pringsewu, Tanggamus, Pesisir Barat | Lampung77 |
| Sab 5 Sep 17:00 | Hujan abu Cinangka, Kab. Serang (Pasauran) | Koran Jakarta |
| Min 6 Sep 01:30 | Soetta tutup (NOTAM A3341/26), diperpanjang 05:30 → 09:30 → 13:30 | Bridge Note |
| Min 6 Sep 03:53, 07:10 | Erupsi lanjutan (amp 46 mm/30 s; 50 mm/16 s) | PVMBG via Bridge Note |
| Min 6 Sep 04:00 | BMKG (Himawari-9): klaster 1 SFC–20.000 ft arah NE–S mencakup sebagian DKI, Bogor, Depok, Banten, Jabar; klaster 2 –50.000 ft arah SW–NW: Banten, Lampung, Bengkulu, Samudra Hindia | detik, CNN, RRI |
| Min 6 Sep subuh | Debu di Jaksel dan Cilangkap (Jaktim) | Liputan6 |
| Min 6 Sep 07:00–10:00 | Radin Inten II (Lampung) tutup; Halim tutup 07:20 | Bridge Note |
| 6–8 Sep | Prakiraan BMKG: angin dari E–SE 31–37 km/jam | CNBC |

Link:
- https://service.bridgenote.asia/news/anak-krakatau-eruption-september-2026-jakarta-airport
- https://news.detik.com/berita/d-8650368/bmkg-ungkap-2-klaster-sebaran-abu-anak-krakatau-arah-lampung-dan-jakarta
- https://www.cnnindonesia.com/nasional/20260906054533-20-1400506/sebaran-abu-vulkanik-gunung-anak-krakatau-sampai-ke-jakarta
- https://rri.co.id/nasional/2709909/fakta-fakta-abu-anak-krakatau-menyebar-hingga-jakarta
- https://www.cnbcindonesia.com/tech/20260906094900-37-765422/abu-krakatau-meluas-sampai-jakarta-banten-jabar-cek-peringatan-bmkg
- https://www.liputan6.com/news/read/8285637/abu-anak-krakatau-sampai-jakarta-warga-mengeluh-udara-lebih-sesak
- https://koran-jakarta.com/2026-09-06/hujan-abu-anak-krakatau-melanda-serang-mata-warga-perih-hingga-sekolah-terganggu
- https://lampung77.com/lampung/hujan-abu-vulkanik-anak-krakatau-di-lampung-warga-keluhkan-mata-perih-hingga-imbauan-bpbd/
- https://gdacs.org/report.aspx?eventid=1000148&episodeid=2&eventtype=VO (GDACS VO 1000148, GLIDE VO-2026-000171-IDN)
- https://magma.esdm.go.id/v1/vona?code=KRA

## 6. Konstanta

- Kawah Anak Krakatau: 6.102°S, 105.423°E (VAAC `S0606 E10525`), elevasi 155 m (VAAC) / puncak ±285 m.
- Konversi: FL = ratusan kaki; FL200 ≈ 6,1 km, FL500 ≈ 15,2 km. 1 kt = 1,852 km/jam.
