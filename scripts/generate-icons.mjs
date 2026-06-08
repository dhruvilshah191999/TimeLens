// Generates the TimeLens extension icons — a "lens" mark (concentric ring +
// focal dot) on a diagonal violet gradient, rounded-square. Anti-aliased via
// 4x supersampling. Zero deps (Node's built-in zlib for PNG). Run: `pnpm icons`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons')
const SS = 4 // supersampling factor

// --- PNG encoding (RGBA) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
function encodePNG(size, rgba) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Palette (matches the in-app brand gradient) ---
const GRAD_TL = [0x6f, 0x5e, 0xf0] // indigo (top-left)
const GRAD_BR = [0x9a, 0x5c, 0xee] // violet (bottom-right)
const WHITE = [255, 255, 255]
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/** Signed distance from a point to a rounded rectangle (negative = inside). */
function roundedRectSDF(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius)
  const qy = Math.abs(py) - (half - radius)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius
}

/** Render the icon at hi-res, then box-downsample to `size` for anti-aliasing. */
function drawIcon(size) {
  const hi = size * SS
  const hiBuf = Buffer.alloc(hi * hi * 4)
  const c = hi / 2
  const half = hi / 2 - hi * 0.04 // rounded-square half-extent (small margin)
  const corner = hi * 0.235

  // Lens geometry (fractions of full size).
  const ringR = hi * 0.34
  const ringW = hi * 0.075 // ring half-thickness
  const innerR = hi * 0.18
  const innerW = hi * 0.035
  const dotR = hi * 0.072
  // focal accent dot, upper-right just inside the ring
  const accAng = -Math.PI / 4
  const accDist = hi * 0.34
  const accX = c + Math.cos(accAng) * accDist
  const accY = c + Math.sin(accAng) * accDist
  const accR = hi * 0.05

  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < hi; x++) {
      const i = (y * hi + x) * 4
      const sdf = roundedRectSDF(x + 0.5 - c, y + 0.5 - c, half, corner)
      if (sdf > 0.5) {
        hiBuf[i] = hiBuf[i + 1] = hiBuf[i + 2] = hiBuf[i + 3] = 0
        continue
      }
      // background diagonal gradient
      const t = clamp01((x + y) / (2 * hi))
      let r = lerp(GRAD_TL[0], GRAD_BR[0], t)
      let g = lerp(GRAD_TL[1], GRAD_BR[1], t)
      let b = lerp(GRAD_TL[2], GRAD_BR[2], t)

      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c)
      const onRing = Math.abs(d - ringR) <= ringW
      const onInner = Math.abs(d - innerR) <= innerW
      const inDot = d <= dotR
      const inAcc = Math.hypot(x + 0.5 - accX, y + 0.5 - accY) <= accR
      if (onRing || onInner || inDot || inAcc) {
        r = WHITE[0]
        g = WHITE[1]
        b = WHITE[2]
      }
      hiBuf[i] = r
      hiBuf[i + 1] = g
      hiBuf[i + 2] = b
      hiBuf[i + 3] = 255
    }
  }

  // Downsample (box filter) → anti-aliased output.
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const hi_i = ((y * SS + sy) * hi + (x * SS + sx)) * 4
          const af = hiBuf[hi_i + 3]
          r += hiBuf[hi_i] * af
          g += hiBuf[hi_i + 1] * af
          b += hiBuf[hi_i + 2] * af
          a += af
        }
      }
      const o = (y * size + x) * 4
      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
      } else {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
        out[o + 3] = Math.round(a / (SS * SS))
      }
    }
  }
  return out
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, drawIcon(size))
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), png)
  console.log(`wrote icon-${size}.png (${png.length} bytes)`)
}
