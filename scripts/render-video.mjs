// Render video sosmed: Chrome headless (puppeteer-core + Chrome lokal) memotret mode video app per langkah sim → ffmpeg MP4
// Pakai: node scripts/render-video.mjs [--preset=all|regional-portrait,ciangsana-portrait,…] [--quick] [--no-build] [--port=4174]
//        override per run: --hoursPerSec=2 --fps=30 --intro=2 --outro=2 --start=… --end=…
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const SIZES = { portrait: [1080, 1920], landscape: [1920, 1080], square: [1080, 1080] }
const DEFAULTS = { start: '2026-09-04T16:00:00Z', end: '2026-09-07T00:00:00Z', hoursPerSec: 2, fps: 30, intro: 2, outro: 2 }
// tiap preset = orientasi + varian tampilan + jendela waktu + kecepatan
const PRESETS = {
  'regional-portrait': { orientation: 'portrait', variant: 'regional' },
  'regional-landscape': { orientation: 'landscape', variant: 'regional' },
  'regional-square': { orientation: 'square', variant: 'regional' },
  'regional-portrait-60s': { orientation: 'portrait', variant: 'regional', hoursPerSec: 1 }, // 56 s + kartu = 60 s
  'regional-landscape-60s': { orientation: 'landscape', variant: 'regional', hoursPerSec: 1 },
  'ciangsana-portrait': { orientation: 'portrait', variant: 'ciangsana', start: '2026-09-05T05:00:00Z', end: '2026-09-06T12:00:00Z', hoursPerSec: 1.5 },
  'ciangsana-square': { orientation: 'square', variant: 'ciangsana', start: '2026-09-05T05:00:00Z', end: '2026-09-06T12:00:00Z', hoursPerSec: 1.5 },
  'teaser-portrait': { orientation: 'portrait', variant: 'teaser', start: '2026-09-05T12:00:00Z', end: '2026-09-06T03:00:00Z', hoursPerSec: 1.5, intro: 1.5, outro: 1.5 },
  'split-landscape': { orientation: 'landscape', variant: 'split' },
  'wind-portrait': { orientation: 'portrait', variant: 'wind', scenes: true, intro: 1.5, outro: 1.5 }, // jendela waktu per adegan dari app (window.__sim.scenes)
}

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] }))
const presetNames = !args.preset || args.preset === 'all' ? Object.keys(PRESETS) : String(args.preset).split(',')
const port = Number(args.port ?? 4174)
const OUT = resolve(ROOT, 'output')
mkdirSync(OUT, { recursive: true })

const pad5 = (n) => String(n).padStart(5, '0')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// tunggu canvas digambar & semua citra satelit termuat
async function settle(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-satellite-pane img')].every(img => !img.src || (img.complete && img.naturalWidth > 0)), { timeout: 8000 }).catch(() => {})
}

async function renderPreset(browser, name) {
  const preset = PRESETS[name]
  if (!preset) throw new Error(`Preset tidak dikenal: ${name} (pilihan: ${Object.keys(PRESETS).join(', ')})`)
  const cfg = { ...DEFAULTS, ...preset }
  for (const k of ['hoursPerSec', 'fps', 'intro', 'outro']) if (args[k] != null) cfg[k] = Number(args[k])
  for (const k of ['start', 'end']) if (args[k]) cfg[k] = args[k]
  const startMs = Date.parse(cfg.start), endMs = args.quick ? startMs + 6 * 3600e3 : Date.parse(cfg.end)
  const [width, height] = SIZES[cfg.orientation]
  const dir = resolve(OUT, `frames-${name}`)
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })

  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:${port}/?video=${cfg.orientation}&variant=${cfg.variant}`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForFunction(() => window.__sim && window.__sim.ready, { timeout: 60000 })
  await page.evaluate(t => window.__sim.seek(t), startMs)
  await sleep(1500); await settle(page) // tile peta & font

  let n = 0
  const shot = async () => page.screenshot({ type: 'jpeg', quality: 92 })
  const write = (buf, copies = 1) => { for (let k = 0; k < copies; k++) writeFileSync(resolve(dir, `${pad5(n++)}.jpg`), buf) }

  await page.evaluate(() => window.__sim.setPhase('intro')); await settle(page)
  write(await shot(), Math.round(cfg.intro * cfg.fps))

  await page.evaluate(() => window.__sim.setPhase('main')); await settle(page)
  // adegan terprogram (varian wind) atau satu jendela linear
  const scenes = cfg.scenes ? await page.evaluate(() => window.__sim.scenes) : [{ start: cfg.start, end: args.quick ? new Date(endMs).toISOString() : cfg.end, hoursPerSec: cfg.hoursPerSec }]
  const t0 = Date.now()
  for (let s = 0; s < scenes.length; s++) {
    const sc = scenes[s]
    if (cfg.scenes) { await page.evaluate(i => window.__sim.setScene(i), s) }
    const sStart = Date.parse(sc.start), sEnd = Date.parse(sc.end), stepMs = (sc.hoursPerSec * 3600e3) / cfg.fps
    const frames = Math.floor((sEnd - sStart) / stepMs) + 1
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.__sim.seek(t), sStart + i * stepMs)
      await settle(page)
      write(await shot())
      if (i % 150 === 0) console.log(`${name}: scene ${s + 1}/${scenes.length} frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
    }
  }
  if (cfg.scenes) await page.evaluate(() => window.__sim.setScene(null))

  await page.evaluate(() => window.__sim.setPhase('outro')); await settle(page)
  write(await shot(), Math.round(cfg.outro * cfg.fps))
  await page.close()

  const out = resolve(OUT, `krakatau-ash-${name}${args.quick ? '-quick' : ''}.mp4`)
  const ff = spawnSync('ffmpeg', ['-y', '-framerate', String(cfg.fps), '-i', resolve(dir, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['ignore', 'ignore', 'pipe'] })
  if (ff.status !== 0) throw new Error(`ffmpeg failed: ${ff.stderr?.toString().slice(-800)}`)
  rmSync(dir, { recursive: true, force: true })
  console.log(`${name}: ${n} frames → ${out} (${(n / cfg.fps).toFixed(1)} s)`)
  return out
}

async function main() {
  if (!args['no-build']) {
    console.log('vite build…')
    const b = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
    if (b.status !== 0) throw new Error('build failed')
  }
  if (!existsSync(resolve(ROOT, 'dist/index.html'))) throw new Error('dist/ belum ada, jalankan npm run build')
  const server = await preview({ root: ROOT, preview: { port, strictPort: true }, logLevel: 'silent' })
  const browser = await puppeteer.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars', '--force-device-scale-factor=1'] })
  try {
    for (const name of presetNames) await renderPreset(browser, name)
  } finally {
    await browser.close(); await server.close()
  }
}
main().catch(err => { console.error(err); process.exit(1) })
