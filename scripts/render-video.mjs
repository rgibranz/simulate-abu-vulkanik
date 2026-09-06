// Render video sosmed: Chrome headless (puppeteer-core + Chrome lokal) memotret mode video app per langkah sim → ffmpeg MP4
// Pakai: node scripts/render-video.mjs [--orientation=portrait,landscape] [--hoursPerSec=2] [--fps=30] [--intro=2] [--outro=2]
//        [--start=2026-09-04T16:00:00Z] [--end=2026-09-07T00:00:00Z] [--quick] [--no-build] [--port=4174]
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true] }))
const orientations = String(args.orientation ?? 'portrait,landscape').split(',')
const hoursPerSec = Number(args.hoursPerSec ?? 2), fps = Number(args.fps ?? 30)
const introSec = Number(args.intro ?? 2), outroSec = Number(args.outro ?? 2)
const startMs = Date.parse(args.start ?? '2026-09-04T16:00:00Z')
const endMs = args.quick ? startMs + 6 * 3600e3 : Date.parse(args.end ?? '2026-09-07T00:00:00Z')
const port = Number(args.port ?? 4174)
const SIZES = { portrait: [1080, 1920], landscape: [1920, 1080] }
const OUT = resolve(ROOT, 'output')
mkdirSync(OUT, { recursive: true })

const pad5 = (n) => String(n).padStart(5, '0')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// tunggu canvas digambar & citra satelit termuat
async function settle(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForFunction(() => {
    const img = document.querySelector('.leaflet-satellite-pane img')
    return !img || !img.src || (img.complete && img.naturalWidth > 0)
  }, { timeout: 8000 }).catch(() => {})
}

async function renderOrientation(browser, orientation) {
  const [width, height] = SIZES[orientation]
  const dir = resolve(OUT, `frames-${orientation}`)
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.goto(`http://localhost:${port}/?video=${orientation}`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForFunction(() => window.__sim && window.__sim.ready, { timeout: 60000 })
  await page.evaluate(t => window.__sim.seek(t), startMs)
  await sleep(1500); await settle(page) // tile peta & font

  let n = 0
  const shot = async () => page.screenshot({ type: 'jpeg', quality: 92 })
  const write = (buf, copies = 1) => { for (let k = 0; k < copies; k++) writeFileSync(resolve(dir, `${pad5(n++)}.jpg`), buf) }

  await page.evaluate(() => window.__sim.setPhase('intro')); await settle(page)
  write(await shot(), Math.round(introSec * fps))

  await page.evaluate(() => window.__sim.setPhase('main')); await settle(page)
  const stepMs = (hoursPerSec * 3600e3) / fps
  const frames = Math.floor((endMs - startMs) / stepMs) + 1
  const t0 = Date.now()
  for (let i = 0; i < frames; i++) {
    const t = startMs + i * stepMs
    await page.evaluate(t => window.__sim.seek(t), t)
    await settle(page)
    write(await shot())
    if (i % 100 === 0) console.log(`${orientation}: frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }

  await page.evaluate(() => window.__sim.setPhase('outro')); await settle(page)
  write(await shot(), Math.round(outroSec * fps))
  await page.close()

  const out = resolve(OUT, `krakatau-ash-${orientation}${args.quick ? '-quick' : ''}.mp4`)
  const ff = spawnSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', resolve(dir, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['ignore', 'ignore', 'pipe'] })
  if (ff.status !== 0) throw new Error(`ffmpeg failed: ${ff.stderr?.toString().slice(-800)}`)
  console.log(`${orientation}: ${n} frames → ${out} (${(n / fps).toFixed(1)} s)`)
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
    for (const o of orientations) await renderOrientation(browser, o)
  } finally {
    await browser.close(); await server.close()
  }
}
main().catch(err => { console.error(err); process.exit(1) })
